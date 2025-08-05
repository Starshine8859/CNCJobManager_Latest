import { useState, useEffect } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { JobWithMaterials, JobMaterial, RecutEntry } from "@shared/schema";

interface JobPopupProps {
  jobId: number;
  onClose: () => void;
}

export function JobPopup({ jobId, onClose }: JobPopupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [liveTimerSeconds, setLiveTimerSeconds] = useState<number>(0);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);

  // Optimistic updates for immediate visual feedback
  const [optimisticSheetStatuses, setOptimisticSheetStatuses] = useState<Record<string, Record<number, string>>>({});
  
  // Loading states for individual sheet buttons - separate for cut and skip
  const [loadingCutButtons, setLoadingCutButtons] = useState<Record<string, Set<number>>>({});
  const [loadingSkipButtons, setLoadingSkipButtons] = useState<Record<string, Set<number>>>({});

  // Loading states for individual recut sheet buttons - separate for cut and skip
  const [loadingRecutCutButtons, setLoadingRecutCutButtons] = useState<Record<string, Set<number>>>({});
  const [loadingRecutSkipButtons, setLoadingRecutSkipButtons] = useState<Record<string, Set<number>>>({});

  // NO optimistic updates in popup - use server state only for reliability

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Live timer updates every second - copied from working job-details-modal-new.tsx
  useEffect(() => {
    if (!timerStartTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - timerStartTime.getTime()) / 1000);
      setLiveTimerSeconds(elapsedSeconds);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerStartTime]);

  // Manual refresh function
  const refreshData = () => {
    queryClient.refetchQueries({ queryKey: [`/api/jobs/${jobId}`] });
    queryClient.refetchQueries({ queryKey: [`/api/materials`] });
  };

  const { data: job, isLoading } = useQuery<JobWithMaterials>({
    queryKey: [`/api/jobs/${jobId}`],
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
    refetchIntervalInBackground: true,
    staleTime: 1000, // Keep data fresh for 1 second only
  });

  // Timer mutations for starting/stopping job timer
  const startTimerMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest('POST', `/api/jobs/${jobId}/start-timer`),
    onError: () => {
      console.error('Failed to start job timer');
    }
  });

  const stopTimerMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest('POST', `/api/jobs/${jobId}/stop-timer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: () => {
      console.error('Failed to stop job timer');
    }
  });

  // Start timer when popup opens - exactly like main modal
  useEffect(() => {
    if (job?.id) {
      const startTime = new Date();
      setTimerStartTime(startTime);
      setLiveTimerSeconds(0);
      startTimerMutation.mutate(job.id);
    }
    
    // Stop timer when popup closes
    return () => {
      if (job?.id) {
        stopTimerMutation.mutate(job.id);
        setTimerStartTime(null);
        setLiveTimerSeconds(0);
      }
    };
  }, [job?.id]);

  // No optimistic state management needed in popup

  // Direct server updates with optimistic updates and loading states
  const updateSheetMutation = useMutation({
    mutationFn: ({ materialId, sheetIndex, status }: { 
      materialId: number; 
      sheetIndex: number; 
      status: 'cut' | 'skip' | 'pending';
    }) => {
      return apiRequest('PUT', `/api/materials/${materialId}/sheet-status`, { sheetIndex, status });
    },
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
      
      // Immediately update the UI optimistically
      setOptimisticSheetStatuses(prev => ({
        ...prev,
        [materialId]: {
          ...prev[materialId],
          [sheetIndex]: status
        }
      }));
      
      // Return context for rollback if needed
      return { materialId, sheetIndex, previousStatus: optimisticSheetStatuses[materialId]?.[sheetIndex], action: status };
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
      
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
    },
    onError: (error: any, variables, context) => {
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
      
      // Rollback optimistic update on error
      if (context) {
        setOptimisticSheetStatuses(prev => ({
          ...prev,
          [context.materialId]: {
            ...prev[context.materialId],
            [context.sheetIndex]: context.previousStatus || 'pending'
          }
        }));
      }
      
      toast({ title: "Error", description: "Failed to update sheet status" });
    }
  });

  const updateRecutSheetStatusMutation = useMutation({
    mutationFn: ({ recutId, sheetIndex, status, actionType }: { 
      recutId: number; 
      sheetIndex: number; 
      status: 'cut' | 'skip' | 'pending';
      actionType: 'cut' | 'skip';
    }) => {
      return apiRequest('PUT', `/api/recuts/${recutId}/sheet-status`, { sheetIndex, status });
    },
    onMutate: ({ recutId, sheetIndex, status, actionType }) => {
      // Set loading state based on which button was clicked
      if (actionType === 'cut') {
        setLoadingRecutCutButtons(prev => ({
          ...prev,
          [recutId]: new Set([...Array.from(prev[recutId] || []), sheetIndex])
        }));
      } else if (actionType === 'skip') {
        setLoadingRecutSkipButtons(prev => ({
          ...prev,
          [recutId]: new Set([...Array.from(prev[recutId] || []), sheetIndex])
        }));
      }
    },
    onSuccess: (_, variables) => {
      // Clear loading state based on which button was clicked
      if (variables.actionType === 'cut') {
        setLoadingRecutCutButtons(prev => ({
          ...prev,
          [variables.recutId]: new Set(Array.from(prev[variables.recutId] || []).filter(i => i !== variables.sheetIndex))
        }));
      } else if (variables.actionType === 'skip') {
        setLoadingRecutSkipButtons(prev => ({
          ...prev,
          [variables.recutId]: new Set(Array.from(prev[variables.recutId] || []).filter(i => i !== variables.sheetIndex))
        }));
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
    },
    onError: (error: any, variables) => {
      // Clear loading state based on which button was clicked
      if (variables.actionType === 'cut') {
        setLoadingRecutCutButtons(prev => ({
          ...prev,
          [variables.recutId]: new Set(Array.from(prev[variables.recutId] || []).filter(i => i !== variables.sheetIndex))
        }));
      } else if (variables.actionType === 'skip') {
        setLoadingRecutSkipButtons(prev => ({
          ...prev,
          [variables.recutId]: new Set(Array.from(prev[variables.recutId] || []).filter(i => i !== variables.sheetIndex))
        }));
      }
      
      toast({ title: "Error", description: "Failed to update recut status" });
    }
  });

  // Handle sheet cut - with toggle behavior
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
    
    // Get the current status (optimistic or server)
    const optimisticStatus = optimisticSheetStatuses[materialId]?.[sheetIndex];
    const serverStatuses = material.sheetStatuses || [];
    const serverStatus = serverStatuses[sheetIndex] || 'pending';
    const currentStatus = optimisticStatus !== undefined ? optimisticStatus : serverStatus;
    
    // Toggle: if already cut, set to pending; otherwise set to cut
    const newStatus = currentStatus === 'cut' ? 'pending' : 'cut';
    updateSheetMutation.mutate({ materialId, sheetIndex, status: newStatus });
  };

  // Handle sheet skip - with toggle behavior
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
    
    // Get the current status (optimistic or server)
    const optimisticStatus = optimisticSheetStatuses[materialId]?.[sheetIndex];
    const serverStatuses = material.sheetStatuses || [];
    const serverStatus = serverStatuses[sheetIndex] || 'pending';
    const currentStatus = optimisticStatus !== undefined ? optimisticStatus : serverStatus;
    
    // Toggle: if already skipped, set to pending; otherwise set to skip
    const newStatus = currentStatus === 'skip' ? 'pending' : 'skip';
    updateSheetMutation.mutate({ materialId, sheetIndex, status: newStatus });
  };

  // Handle recut cut - exactly like regular sheet handlers
  const handleRecutCut = (recutId: number, sheetIndex: number, currentStatus: string) => {
    // Toggle: if already cut, set to pending; otherwise set to cut
    const newStatus = currentStatus === 'cut' ? 'pending' : 'cut';
    updateRecutSheetStatusMutation.mutate({ recutId, sheetIndex, status: newStatus, actionType: 'cut' });
  };

  // Handle recut skip - exactly like regular sheet handlers  
  const handleRecutSkip = (recutId: number, sheetIndex: number, currentStatus: string) => {
    // Toggle: if already skipped, set to pending; otherwise set to skip
    const newStatus = currentStatus === 'skip' ? 'pending' : 'skip';
    updateRecutSheetStatusMutation.mutate({ recutId, sheetIndex, status: newStatus, actionType: 'skip' });
  };

  // Format duration - copied exactly from working job-details-modal-new.tsx
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Calculate total duration including live timer - copied from working modal
  const currentDuration = () => {
    const baseDuration = job?.totalDuration || 0;
    return baseDuration + liveTimerSeconds;
  };

  // Handle popup close with timer stop
  const handleClose = () => {
    if (job?.id) {
      stopTimerMutation.mutate(job.id);
      setTimerStartTime(null);
      setLiveTimerSeconds(0);
    }
    onClose();
  };


  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-lg shadow-lg border m-2">
        <div className="p-4">Loading job data...</div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div 
      className="w-full bg-white rounded-lg shadow-lg border m-2"
      style={{ 
        contain: 'layout style paint',
        willChange: 'transform'
      }}
    >
      {/* Stay on Top Indicator - Moved inside container for full visibility */}
      <div className="bg-green-500 text-white text-xs px-4 py-3 rounded-t-lg flex items-center justify-center space-x-2 shadow-lg border-b-2 border-green-400">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        <span className="font-medium text-center">Position this window over your label program • Press Ctrl+Space to refocus</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-blue-50">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-sm text-blue-900 truncate">
            📋 {job.customerName} - {job.jobName}
          </h3>
          <Badge variant="outline" className="text-xs bg-blue-100">
            {job.status}
          </Badge>
        </div>
        {/* Timer Display - Copied from working job-details-modal-new.tsx */}
        <div className="flex items-center space-x-2 text-xs text-blue-800 font-mono">
          <span className="bg-blue-200 px-2 py-1 rounded font-semibold">
            {timerStartTime ? (
              <span className="text-blue-600">
                {formatDuration(currentDuration())} (Active)
              </span>
            ) : (
              formatDuration(job?.totalDuration || 0) || 'Not started'
            )}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            className="h-6 w-6 p-0"
            title="Refresh data"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 p-0"
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
          {/* Materials - Fixed order to prevent jumping */}
          {job.cutlists?.map((cutlist) =>
            cutlist.materials?.map((material) => (
              <div key={`stable-${material.id}`} className="space-y-2">
                {/* Material Header */}
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <div className="flex items-center space-x-2">
                    {/* Show texture image if available, otherwise fallback to color */}
                    {(material as any).color?.texture ? (
                      <img
                        src={(material as any).color.texture}
                        alt={(material as any).color?.name}
                        className="w-5 h-5 rounded border-2 border-gray-300 object-cover"
                      />
                    ) : (
                      <div
                        className="w-5 h-5 rounded border-2 border-gray-300"
                        style={{ backgroundColor: (material as any).color?.hexColor || '#ccc' }}
                      />
                    )}
                    <h4 className="text-sm font-semibold text-gray-800">{(material as any).color?.name || 'Material'}</h4>
                  </div>
                  <div className="text-xs">
                    <div className="text-blue-600 font-bold">
                      {material.sheetStatuses?.filter(s => s === 'cut').length || 0}/{material.totalSheets}
                    </div>
                    {(() => {
                      let recutTotal = 0;
                      let recutCompleted = 0;
                      
                      material.recutEntries?.forEach(recut => {
                        const recutStatuses = recut.sheetStatuses || [];
                        const recutCutCount = recutStatuses.filter(status => status === 'cut').length;
                        
                        recutTotal += recut.quantity;
                        recutCompleted += recutCutCount;
                      });
                      
                      if (recutTotal > 0) {
                        return (
                          <div className="text-orange-600 font-bold">
                            {recutCompleted}/{recutTotal} recut
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                
                {/* Sheet Grid - Exactly like main modal with Cut/Skip buttons */}
                <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded border">
                  {Array.from({ length: material.totalSheets }).map((_, index) => {
                    // Use optimistic status if available, otherwise fall back to server status
                    const optimisticStatus = optimisticSheetStatuses[material.id]?.[index];
                    const serverStatuses = material.sheetStatuses || [];
                    const serverStatus = serverStatuses[index] || 'pending';
                    const status = optimisticStatus !== undefined ? optimisticStatus : serverStatus;
                    const isCutLoading = loadingCutButtons[material.id]?.has(index) || false;
                    const isSkipLoading = loadingSkipButtons[material.id]?.has(index) || false;
                    
                    return (
                      <div key={`sheet-${material.id}-${index}`} className="flex flex-col space-y-1">
                        <div className="text-xs text-center font-medium text-gray-600">
                          Sheet {index + 1}
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleSheetCut(material.id, index)}
                            disabled={isCutLoading}
                            className={`px-2 py-1 rounded text-xs font-medium flex-1 transition-colors flex items-center justify-center gap-1 ${
                              isCutLoading 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-75'
                                : status === 'cut' 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {isCutLoading ? (
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : null}
                            Cut
                          </button>
                          <button
                            onClick={() => handleSheetSkip(material.id, index)}
                            disabled={isSkipLoading}
                            className={`px-2 py-1 rounded text-xs font-medium flex-1 transition-colors flex items-center justify-center gap-1 ${
                              isSkipLoading 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-75'
                                : status === 'skip' 
                                  ? 'bg-red-600 text-white' 
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {isSkipLoading ? (
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : null}
                            Skip
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Inline Recuts */}
                <InlineRecuts 
                  materialId={material.id} 
                  onRecutClick={handleRecutCut} 
                  onRecutSkip={handleRecutSkip}
                  disabled={updateRecutSheetStatusMutation.isPending}
                  loadingRecutCutButtons={loadingRecutCutButtons}
                  loadingRecutSkipButtons={loadingRecutSkipButtons}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface MaterialSectionProps {
  material: JobMaterial;
  onSheetClick: (materialId: number, sheetIndex: number, currentStatus: string) => void;
  disabled: boolean;
  jobId: number;
  onRecutClick: (recutId: number, sheetIndex: number, currentStatus: string) => void;
  recutDisabled: boolean;
}

// Simple inline recuts component
function InlineRecuts({ 
  materialId, 
  onRecutClick, 
  onRecutSkip, 
  disabled,
  loadingRecutCutButtons,
  loadingRecutSkipButtons
}: { 
  materialId: number; 
  onRecutClick: (recutId: number, sheetIndex: number, currentStatus: string) => void;
  onRecutSkip: (recutId: number, sheetIndex: number, currentStatus: string) => void;
  disabled: boolean;
  loadingRecutCutButtons: Record<string, Set<number>>;
  loadingRecutSkipButtons: Record<string, Set<number>>;
}) {
  const { data: recuts } = useQuery<RecutEntry[]>({
    queryKey: [`/api/materials/${materialId}/recuts`],
    refetchInterval: 500, // Refresh every 0.5 seconds for faster updates
    staleTime: 250, // Keep data fresh for 0.25 seconds only
  });

  if (!recuts || recuts.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {recuts.map((recut, recutIndex) => (
        <div key={`recut-${recut.id}`} className="p-2 bg-orange-50 rounded border-l-4 border-orange-400">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-orange-800">
              🔄 Recut #{recutIndex + 1} - {recut.quantity} sheets
            </span>
            <span className="text-sm font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded">
              {recut.sheetStatuses?.filter((s: string) => s === 'cut').length || 0}/{recut.quantity}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 p-2 bg-orange-100 rounded">
            {Array.from({ length: recut.quantity }).map((_, sheetIndex) => {
              // Use server status only - no optimistic state for recuts like main modal
              const serverStatuses = recut.sheetStatuses || [];
              const status = serverStatuses[sheetIndex] || 'pending';
              const isCutLoading = loadingRecutCutButtons[recut.id]?.has(sheetIndex) || false;
              const isSkipLoading = loadingRecutSkipButtons[recut.id]?.has(sheetIndex) || false;
              
              return (
                <div key={`recut-sheet-${recut.id}-${sheetIndex}`} className="flex flex-col space-y-1">
                  <div className="text-xs text-center font-medium text-orange-800">
                    Sheet {sheetIndex + 1}
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => onRecutClick(recut.id, sheetIndex, status)}
                      disabled={disabled || isCutLoading}
                      className={`px-2 py-1 rounded text-xs font-medium flex-1 transition-colors flex items-center justify-center gap-1 ${
                        isCutLoading 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-75'
                          : status === 'cut' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {isCutLoading ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                      ) : null}
                      Cut
                    </button>
                    <button
                      onClick={() => onRecutSkip(recut.id, sheetIndex, status)}
                      disabled={disabled || isSkipLoading}
                      className={`px-2 py-1 rounded text-xs font-medium flex-1 transition-colors flex items-center justify-center gap-1 ${
                        isSkipLoading 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-75'
                          : status === 'skip' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {isSkipLoading ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                      ) : null}
                      Skip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}