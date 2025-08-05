import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Pause, Check, Plus, X, Scissors } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { JobWithMaterials } from "@shared/schema";

interface JobDetailsModalProps {
  job: JobWithMaterials | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function JobDetailsModal({ job, open, onOpenChange }: JobDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Optimistic updates for immediate visual feedback - separate for regular and recut sheets
  const [optimisticSheetStatuses, setOptimisticSheetStatuses] = useState<Record<number, string[]>>({});
  const [optimisticRecutStatuses, setOptimisticRecutStatuses] = useState<Record<number, string[]>>({});

  // Loading states for individual sheet buttons - separate for cut and skip
  const [loadingCutButtons, setLoadingCutButtons] = useState<Record<string, Set<number>>>({});
  const [loadingSkipButtons, setLoadingSkipButtons] = useState<Record<string, Set<number>>>({});

  // Clear optimistic state when job changes (modal open/close)
  useEffect(() => {
    if (!open) {
      setOptimisticSheetStatuses({});
      setOptimisticRecutStatuses({});
    }
  }, [open]);

  // Clear optimistic state when job data is updated from server
  useEffect(() => {
    setOptimisticSheetStatuses({});
    setOptimisticRecutStatuses({});
  }, [job?.cutlists]);

  const updateMaterialMutation = useMutation({
    mutationFn: ({ materialId, completedSheets }: { materialId: number; completedSheets: number }) =>
      apiRequest('PUT', `/api/materials/${materialId}/progress`, { completedSheets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Progress Updated", description: "Sheet status updated successfully" });
    },
  });

  const updateSheetStatusMutation = useMutation({
    mutationFn: ({ materialId, sheetIndex, status }: { materialId: number; sheetIndex: number; status: string }) =>
      apiRequest('PUT', `/api/materials/${materialId}/sheet-status`, { sheetIndex, status }),
    onMutate: ({ materialId, sheetIndex, status }) => {
      // Set loading state based on action type
      if (status === 'cut') {
        setLoadingCutButtons(prev => ({
          ...prev,
          [materialId]: new Set([...Array.from(prev[materialId] || []), sheetIndex])
        }));
      } else if (status === 'skip') {
        setLoadingSkipButtons(prev => ({
          ...prev,
          [materialId]: new Set([...Array.from(prev[materialId] || []), sheetIndex])
        }));
      }

      // Find material across all cutlists
      let material = null;
      if (job?.cutlists) {
        for (const cutlist of job.cutlists) {
          material = cutlist.materials?.find(m => m.id === materialId);
          if (material) break;
        }
      }
      if (!material) return Promise.resolve();
      
      // For now, treat all sheets in the main grid as regular sheets
      // Recuts will be handled separately in their own section below
      const isRecutSheet = false;
      
      if (isRecutSheet) {
        // This is a recut sheet - use recut optimistic state
        const recutIndex = sheetIndex - material.totalSheets;
        setOptimisticRecutStatuses(prev => {
          const currentStatuses = prev[materialId] || [...((material as any).recutStatuses || [])];
          const newStatuses = [...currentStatuses];
          
          // Ensure array is long enough
          while (newStatuses.length <= recutIndex) {
            newStatuses.push('pending');
          }
          
          newStatuses[recutIndex] = status;
          
          return {
            ...prev,
            [materialId]: newStatuses
          };
        });
      } else {
        // This is a regular sheet - use regular optimistic state
        setOptimisticSheetStatuses(prev => {
          const currentStatuses = prev[materialId] || [...(material.sheetStatuses || [])];
          const newStatuses = [...currentStatuses];
          
          // Ensure array is long enough
          while (newStatuses.length <= sheetIndex) {
            newStatuses.push('pending');
          }
          
          newStatuses[sheetIndex] = status;
          
          return {
            ...prev,
            [materialId]: newStatuses
          };
        });
      }
      
      return Promise.resolve();
    },
    onSuccess: (_, variables) => {
      // Clear loading state based on action type
      if (variables.status === 'cut') {
        setLoadingCutButtons(prev => ({
          ...prev,
          [variables.materialId]: new Set(Array.from(prev[variables.materialId] || []).filter(i => i !== variables.sheetIndex))
        }));
      } else if (variables.status === 'skip') {
        setLoadingSkipButtons(prev => ({
          ...prev,
          [variables.materialId]: new Set(Array.from(prev[variables.materialId] || []).filter(i => i !== variables.sheetIndex))
        }));
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error, variables) => {
      // Clear loading state based on action type
      if (variables.status === 'cut') {
        setLoadingCutButtons(prev => ({
          ...prev,
          [variables.materialId]: new Set(Array.from(prev[variables.materialId] || []).filter(i => i !== variables.sheetIndex))
        }));
      } else if (variables.status === 'skip') {
        setLoadingSkipButtons(prev => ({
          ...prev,
          [variables.materialId]: new Set(Array.from(prev[variables.materialId] || []).filter(i => i !== variables.sheetIndex))
        }));
      }
      
      toast({ title: "Error", description: "Failed to update sheet status" });
      setOptimisticSheetStatuses({});
      setOptimisticRecutStatuses({});
    }
  });

  const addRecutMutation = useMutation({
    mutationFn: ({ materialId, recutSheets }: { materialId: number; recutSheets: number }) =>
      apiRequest('POST', `/api/materials/${materialId}/recut`, { recutSheets }),
    onSuccess: () => {
      // Clear optimistic state before invalidating to prevent conflicts
      setOptimisticSheetStatuses({});
      setOptimisticRecutStatuses({});
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Recut Added", description: "Additional sheet added successfully" });
    },
  });

  const updateRecutStatusMutation = useMutation({
    mutationFn: ({ materialId, recutIndex, status }: { materialId: number; recutIndex: number; status: string }) =>
      apiRequest('PUT', `/api/materials/${materialId}/recut-status`, { recutIndex, status }),
    onMutate: ({ materialId, recutIndex, status }) => {
      // Find material across all cutlists
      let material = null;
      if (job?.cutlists) {
        for (const cutlist of job.cutlists) {
          material = cutlist.materials?.find((m: any) => m.id === materialId);
          if (material) break;
        }
      }
      if (!material) return Promise.resolve();
      
      // This is a recut sheet - use recut optimistic state
      setOptimisticRecutStatuses(prev => {
        const currentStatuses = prev[materialId] || [...((material as any).recutStatuses || [])];
        const newStatuses = [...currentStatuses];
        
        // Ensure array is long enough
        while (newStatuses.length <= recutIndex) {
          newStatuses.push('pending');
        }
        
        newStatuses[recutIndex] = status;
        
        return {
          ...prev,
          [materialId]: newStatuses
        };
      });
      
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update recut status" });
      setOptimisticRecutStatuses({});
    }
  });

  const pauseJobMutation = useMutation({
    mutationFn: () => job ? apiRequest('POST', `/api/jobs/${job.id}/pause`) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job Paused", description: "Job has been paused" });
    },
  });

  const startJobMutation = useMutation({
    mutationFn: () => job ? apiRequest('POST', `/api/jobs/${job.id}/start`) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job Started", description: "Job is now in progress" });
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: () => job ? apiRequest('POST', `/api/jobs/${job.id}/complete`) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      onOpenChange(false);
      toast({ title: "Job Completed", description: "Job has been marked as complete" });
    },
  });

  if (!job) return null;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-gray-100 text-gray-600';
      case 'in_progress': return 'bg-orange-100 text-orange-600';
      case 'paused': return 'bg-yellow-100 text-yellow-600';
      case 'done': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const totalSheets = job?.cutlists?.reduce((sum, cutlist) => 
    sum + (cutlist.materials?.reduce((materialSum, m) => materialSum + m.totalSheets, 0) || 0), 0) || 0;
  const completedSheets = job?.cutlists?.reduce((sum, cutlist) => 
    sum + (cutlist.materials?.reduce((materialSum, m) => materialSum + m.completedSheets, 0) || 0), 0) || 0;
  const progress = totalSheets > 0 ? Math.round((completedSheets / totalSheets) * 100) : 0;

  const handleSheetCut = (materialId: number, sheetIndex: number) => {
    // Find material across all cutlists
    let material = null;
    if (job?.cutlists) {
      for (const cutlist of job.cutlists) {
        material = cutlist.materials?.find(m => m.id === materialId);
        if (material) break;
      }
    }
    if (!material) return;
    
    // For now, treat all sheets in the main grid as regular sheets
    // Recuts will be handled separately in their own section below
    const isRecutSheet = false;
    
    let currentStatus;
    if (isRecutSheet) {
      const recutIndex = sheetIndex - material.totalSheets;
      const optimisticRecutStats = optimisticRecutStatuses[materialId];
      const serverRecutStatuses = (material as any).recutStatuses || [];
      currentStatus = optimisticRecutStats && optimisticRecutStats[recutIndex] !== undefined 
        ? optimisticRecutStats[recutIndex] 
        : (serverRecutStatuses[recutIndex] || 'pending');
    } else {
      const optimisticStats = optimisticSheetStatuses[materialId];
      const serverStatuses = material.sheetStatuses || [];
      currentStatus = optimisticStats && optimisticStats[sheetIndex] !== undefined 
        ? optimisticStats[sheetIndex] 
        : (serverStatuses[sheetIndex] || 'pending');
    }
    
    // Toggle: if already cut, set to pending; otherwise set to cut
    const newStatus = currentStatus === 'cut' ? 'pending' : 'cut';
    updateSheetStatusMutation.mutate({ materialId, sheetIndex, status: newStatus });
  };

  const handleSheetSkip = (materialId: number, sheetIndex: number) => {
    // Find material across all cutlists
    let material = null;
    if (job?.cutlists) {
      for (const cutlist of job.cutlists) {
        material = cutlist.materials?.find(m => m.id === materialId);
        if (material) break;
      }
    }
    if (!material) return;
    
    // For now, treat all sheets in the main grid as regular sheets
    // Recuts will be handled separately in their own section below
    const isRecutSheet = false;
    
    let currentStatus;
    if (isRecutSheet) {
      const recutIndex = sheetIndex - material.totalSheets;
      const optimisticRecutStats = optimisticRecutStatuses[materialId];
      const serverRecutStatuses = (material as any).recutStatuses || [];
      currentStatus = optimisticRecutStats && optimisticRecutStats[recutIndex] !== undefined 
        ? optimisticRecutStats[recutIndex] 
        : (serverRecutStatuses[recutIndex] || 'pending');
    } else {
      const optimisticStats = optimisticSheetStatuses[materialId];
      const serverStatuses = material.sheetStatuses || [];
      currentStatus = optimisticStats && optimisticStats[sheetIndex] !== undefined 
        ? optimisticStats[sheetIndex] 
        : (serverStatuses[sheetIndex] || 'pending');
    }
    
    // Toggle: if already skipped, set to pending; otherwise set to skip
    const newStatus = currentStatus === 'skip' ? 'pending' : 'skip';
    updateSheetStatusMutation.mutate({ materialId, sheetIndex, status: newStatus });
  };

  const handleRecutCut = (materialId: number, recutIndex: number) => {
    // Find material across all cutlists
    let material = null;
    if (job?.cutlists) {
      for (const cutlist of job.cutlists) {
        material = cutlist.materials?.find(m => m.id === materialId);
        if (material) break;
      }
    }
    if (!material) return;
    
    const optimisticRecutStats = optimisticRecutStatuses[materialId];
    const serverRecutStatuses = (material as any).recutStatuses || [];
    const currentStatus = optimisticRecutStats && optimisticRecutStats[recutIndex] !== undefined 
      ? optimisticRecutStats[recutIndex] 
      : (serverRecutStatuses[recutIndex] || 'pending');
    
    // Toggle: if already cut, set to pending; otherwise set to cut
    const newStatus = currentStatus === 'cut' ? 'pending' : 'cut';
    updateRecutStatusMutation.mutate({ materialId, recutIndex, status: newStatus });
  };

  const handleRecutSkip = (materialId: number, recutIndex: number) => {
    // Find material across all cutlists
    let material = null;
    if (job?.cutlists) {
      for (const cutlist of job.cutlists) {
        material = cutlist.materials?.find(m => m.id === materialId);
        if (material) break;
      }
    }
    if (!material) return;
    
    const optimisticRecutStats = optimisticRecutStatuses[materialId];
    const serverRecutStatuses = (material as any).recutStatuses || [];
    const currentStatus = optimisticRecutStats && optimisticRecutStats[recutIndex] !== undefined 
      ? optimisticRecutStats[recutIndex] 
      : (serverRecutStatuses[recutIndex] || 'pending');
    
    // Toggle: if already skipped, set to pending; otherwise set to skip
    const newStatus = currentStatus === 'skip' ? 'pending' : 'skip';
    updateRecutStatusMutation.mutate({ materialId, recutIndex, status: newStatus });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{job.jobName}</DialogTitle>
              <p className="text-gray-600">{job.customerName}</p>
            </div>
            <Badge className={getStatusBadgeColor(job.status)}>
              {job.status.replace('_', ' ')}
            </Badge>
          </div>
        </DialogHeader>

        {/* Job Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-600">Status</div>
            <div className="text-lg font-semibold text-blue-700 mt-1">
              {job.status.replace('_', ' ')}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-600">Progress</div>
            <div className="text-lg font-semibold text-green-700 mt-1">
              {completedSheets}/{totalSheets} sheets
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-600">Time</div>
            <div className="text-lg font-semibold text-orange-700 mt-1">
              {job.totalDuration ? formatDuration(job.totalDuration) : "Not started"}
            </div>
          </div>
        </div>

        {/* Job Actions */}
        <div className="flex items-center space-x-3 mb-6">
          {job.status === 'waiting' && (
            <Button 
              onClick={() => startJobMutation.mutate()}
              disabled={startJobMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Job
            </Button>
          )}
          
          {job.status === 'in_progress' && (
            <Button 
              onClick={() => pauseJobMutation.mutate()}
              disabled={pauseJobMutation.isPending}
              variant="outline"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause Job
            </Button>
          )}
          
          {job.status === 'paused' && (
            <Button 
              onClick={() => startJobMutation.mutate()}
              disabled={startJobMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Resume Job
            </Button>
          )}
          
          {job.status !== 'done' && (
            <Button 
              onClick={() => completeJobMutation.mutate()}
              disabled={completeJobMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Complete Job
            </Button>
          )}
        </div>

        {/* Individual Sheet Tracking */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Sheet Cutting Checklist</h3>
          <p className="text-sm text-gray-600">Click on each sheet to mark as cut or not cut. Sheets that can't be cut can be skipped.</p>
          
          {job.cutlists?.flatMap((cutlist) => 
            cutlist.materials || []
          ).map((material: any) => (
            <div key={material.id} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: material.color.hexColor }}
                  />
                  <div>
                    <h4 className="font-medium text-gray-900">{material.color.name}</h4>
                    <p className="text-sm text-gray-500">
                      {material.totalSheets} sheets total
                      {material.recutSheets > 0 && (
                        <span className="text-orange-600 ml-1">
                          (+{material.recutSheets} recuts)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      addRecutMutation.mutate({ materialId: material.id, recutSheets: 1 });
                    }}
                    disabled={addRecutMutation.isPending}
                    className="h-8 px-3"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Recut
                  </Button>
                </div>
              </div>

              <div className="mb-4">
                <Progress value={(material.completedSheets / material.totalSheets) * 100} className="mb-2" />
                <div className="text-sm text-gray-600">
                  Progress: {material.completedSheets}/{material.totalSheets} completed
                </div>
              </div>

              {/* Individual sheet tracking grid */}
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {Array.from({ length: material.totalSheets }, (_, index) => {
                  const sheetNumber = index + 1;
                  // Get current sheet status with optimistic state taking priority
                  const optimisticStatuses = optimisticSheetStatuses[material.id];
                  const serverStatuses = (material as any).sheetStatuses || [];
                  
                  // Use optimistic state if it exists for this specific sheet, otherwise use server state
                  const currentStatus = optimisticStatuses && optimisticStatuses[index] !== undefined 
                    ? optimisticStatuses[index] 
                    : (serverStatuses[index] || 'pending');
                    
                  const isCut = currentStatus === 'cut';
                  const isSkipped = currentStatus === 'skip';
                  

                  
                  return (
                    <div key={index} className="text-center">
                      <div className="text-xs text-gray-500 mb-2">Sheet {sheetNumber}</div>
                      <div className="flex flex-col space-y-1">
                        <button
                          className={`h-10 px-3 text-xs font-medium rounded border-2 transition-colors flex flex-col items-center justify-center ${
                            isCut 
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-300 text-gray-600 hover:border-green-400'
                          } ${loadingCutButtons[material.id]?.has(index) ? 'opacity-75' : ''}`}
                          onClick={() => handleSheetCut(material.id, index)}
                          disabled={loadingCutButtons[material.id]?.has(index)}
                        >
                          {loadingCutButtons[material.id]?.has(index) ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Scissors className="h-3 w-3" />
                              <span className="text-xs mt-1">Cut</span>
                            </>
                          )}
                        </button>
                        <button
                          className={`h-10 px-3 text-xs font-medium rounded border-2 transition-colors flex flex-col items-center justify-center ${
                            isSkipped 
                              ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-white border-gray-300 text-gray-600 hover:border-red-400'
                          } ${loadingSkipButtons[material.id]?.has(index) ? 'opacity-75' : ''}`}
                          onClick={() => handleSheetSkip(material.id, index)}
                          disabled={loadingSkipButtons[material.id]?.has(index)}
                        >
                          {loadingSkipButtons[material.id]?.has(index) ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <X className="h-3 w-3" />
                              <span className="text-xs mt-1">Skip</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {material.recutSheets > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-orange-600 font-medium mb-3">
                    Recut Sheets ({material.recutSheets} added)
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {Array.from({ length: material.recutSheets }, (_, index) => {
                      // For recut sheets, just use the recut index directly - no calculation needed
                      // We'll handle this separately from regular sheets
                      
                      // Get current recut sheet status with optimistic recut state taking priority
                      const optimisticRecutStats = optimisticRecutStatuses[material.id];
                      const serverRecutStatuses = (material as any).recutStatuses || [];
                      
                      // Use optimistic recut state if it exists for this specific recut sheet, otherwise use server recut state
                      const currentStatus = optimisticRecutStats && optimisticRecutStats[index] !== undefined 
                        ? optimisticRecutStats[index] 
                        : (serverRecutStatuses[index] || 'pending');
                        
                      const isCut = currentStatus === 'cut';
                      const isSkipped = currentStatus === 'skip';
                      
                      return (
                        <div key={`recut-${index}`} className="text-center">
                          <div className="text-xs text-orange-500 mb-2">Recut {index + 1}</div>
                          <div className="flex flex-col space-y-1">
                            <button
                              className={`h-10 px-3 text-xs font-medium rounded border-2 transition-colors flex flex-col items-center justify-center ${
                                isCut 
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'bg-white border-orange-300 text-orange-600 hover:border-green-400'
                              }`}
                              onClick={() => handleRecutCut(material.id, index)}
                              disabled={updateRecutStatusMutation.isPending}
                            >
                              <Scissors className="h-3 w-3" />
                              <span className="text-xs mt-1">Cut</span>
                            </button>
                            <button
                              className={`h-10 px-3 text-xs font-medium rounded border-2 transition-colors flex flex-col items-center justify-center ${
                                isSkipped 
                                  ? 'bg-red-500 border-red-500 text-white'
                                  : 'bg-white border-gray-300 text-gray-600 hover:border-red-400'
                              }`}
                              onClick={() => handleRecutSkip(material.id, index)}
                              disabled={updateRecutStatusMutation.isPending}
                            >
                              <X className="h-3 w-3" />
                              <span className="text-xs mt-1">Skip</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}