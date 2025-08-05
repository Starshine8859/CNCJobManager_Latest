import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, X, Trash2, ArrowRight, RotateCcw, Calendar, User, Palette, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
import { TextureSwatch } from "@/components/ui/texture-swatch";
import type { JobWithMaterials, ColorWithGroup } from "@shared/schema";

interface JobDetailsModalProps {
  job: JobWithMaterials | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewOnlyMode?: boolean;
  onOpenPopup?: (jobId: number) => void;
}

interface RecutHistorySectionProps {
  materialId: number;
}

function RecutHistorySection({ materialId }: RecutHistorySectionProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: recutEntries = [], isLoading } = useQuery({
    queryKey: [`/api/materials/${materialId}/recuts`],
    enabled: !!materialId
  });

  // Type-safe access to recut entries
  const entries = Array.isArray(recutEntries) ? recutEntries : [];

  // Loading states for individual recut sheet buttons - separate for cut and skip
  const [loadingRecutCutButtons, setLoadingRecutCutButtons] = useState<Record<string, Set<number>>>({});
  const [loadingRecutSkipButtons, setLoadingRecutSkipButtons] = useState<Record<string, Set<number>>>({});

  const updateRecutSheetStatusMutation = useMutation({
    mutationFn: ({ recutId, sheetIndex, status, actionType }: { 
      recutId: number; 
      sheetIndex: number; 
      status: string;
      actionType: 'cut' | 'skip';
    }) =>
      apiRequest('PUT', `/api/recuts/${recutId}/sheet-status`, { sheetIndex, status }),
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
      
      queryClient.invalidateQueries({ queryKey: [`/api/materials/${materialId}/recuts`] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error, variables) => {
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
      
      toast({ title: "Error", description: "Failed to update recut sheet status" });
    }
  });

  const deleteRecutMutation = useMutation({
    mutationFn: (recutId: number) => apiRequest('DELETE', `/api/recuts/${recutId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/materials/${materialId}/recuts`] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Success", description: "Recut entry deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete recut entry" });
    }
  });

  const handleRecutSheetCut = (recutId: number, sheetIndex: number, currentStatus: string) => {
    // Toggle: if already cut, set to pending; otherwise set to cut
    const newStatus = currentStatus === 'cut' ? 'pending' : 'cut';
    updateRecutSheetStatusMutation.mutate({ 
      recutId, 
      sheetIndex, 
      status: newStatus,
      actionType: 'cut'
    });
  };

  const handleRecutSheetSkip = (recutId: number, sheetIndex: number, currentStatus: string) => {
    // Toggle: if already skipped, set to pending; otherwise set to skip
    const newStatus = currentStatus === 'skip' ? 'pending' : 'skip';
    updateRecutSheetStatusMutation.mutate({ 
      recutId, 
      sheetIndex, 
      status: newStatus,
      actionType: 'skip'
    });
  };

  if (isLoading) {
    return (
      <div className="mt-4 p-3 bg-orange-50 rounded-lg">
        <h4 className="font-medium mb-2 text-orange-800">Recut Tracking</h4>
        <div className="text-sm text-orange-600">Loading recut history...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mt-4 p-3 bg-orange-50 rounded-lg">
        <h4 className="font-medium mb-2 text-orange-800">Recut Tracking</h4>
        <div className="text-sm text-orange-600">No recut entries found</div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3 bg-orange-50 rounded-lg">
      <h4 className="font-medium mb-3 text-orange-800">Recut Tracking</h4>
      <div className="space-y-3">
        {entries.map((entry: any, entryIndex: number) => {
          const completedCount = entry.sheetStatuses?.filter((s: string) => s === 'cut').length || 0;
          const skippedCount = entry.sheetStatuses?.filter((s: string) => s === 'skip').length || 0;
          const effectiveTotal = entry.quantity - skippedCount;
          const progressPercentage = effectiveTotal > 0 ? Math.round((completedCount / effectiveTotal) * 100) : 0;

          return (
            <div key={entry.id} className="bg-white p-3 rounded border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-orange-800">
                    Recut #{entryIndex + 1} - {entry.quantity} sheets
                  </span>
                  {entry.reason && (
                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                      {entry.reason}
                    </span>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete recut entry #${entryIndex + 1}?`)) {
                      deleteRecutMutation.mutate(entry.id);
                    }
                  }}
                  disabled={deleteRecutMutation.isPending}
                  className="w-6 h-6 p-0 flex-shrink-0"
                >
                  ×
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-orange-600 font-medium">Recut: {completedCount}/{effectiveTotal}</span>
                  <span className="text-xs text-orange-700 font-semibold bg-orange-100 px-2 py-0.5 rounded">{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Sheet Grid */}
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: entry.quantity }, (_, i) => {
                  const status = entry.sheetStatuses?.[i] || 'pending';
                  const isCutLoading = loadingRecutCutButtons[entry.id]?.has(i) || false;
                  const isSkipLoading = loadingRecutSkipButtons[entry.id]?.has(i) || false;
                  
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="text-sm font-medium">
                        Sheet {i + 1}
                      </div>
                      <div className="flex gap-1 items-center">
                        <button
                          onClick={() => handleRecutSheetCut(entry.id, i, status)}
                          disabled={isCutLoading}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                            status === 'cut' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          } ${isCutLoading ? 'opacity-75' : ''}`}
                        >
                          {isCutLoading ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : null}
                          Cut
                        </button>
                        <button
                          onClick={() => handleRecutSheetSkip(entry.id, i, status)}
                          disabled={isSkipLoading}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                            status === 'skip' 
                              ? 'bg-red-600 text-white' 
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          } ${isSkipLoading ? 'opacity-75' : ''}`}
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
          );
        })}
      </div>
    </div>
  );
}

export default function JobDetailsModal({ job, open, onOpenChange, viewOnlyMode = false, onOpenPopup }: JobDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Live timer state
  const [liveTimerSeconds, setLiveTimerSeconds] = useState<number>(0);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  
  // Optimistic state for immediate UI updates
  const [optimisticSheetStatuses, setOptimisticSheetStatuses] = useState<Record<string, Record<number, string>>>({});
  
  // Loading states for individual sheet buttons - separate for cut and skip
  const [loadingCutButtons, setLoadingCutButtons] = useState<Record<string, Set<number>>>({});
  const [loadingSkipButtons, setLoadingSkipButtons] = useState<Record<string, Set<number>>>({});
  
  // WebSocket for real-time updates
  const handleWebSocketMessage = (message: MessageEvent) => {
    if (!open || !job) return;
    
    try {
      const data = JSON.parse(message.data);
      const { type } = data;
      
      // Handle real-time updates for this specific job
      if (type === 'job_timer_started' && data?.jobId === job.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      }
      
      if (type === 'job_timer_stopped' && data?.jobId === job.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      }
      
      if (type === 'sheet_status_updated' || type === 'recut_sheet_status_updated') {
        // Refresh job data and recut entries
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        
        // Refresh recut data for affected materials
        if (job.cutlists) {
          job.cutlists.forEach(cutlist => {
            cutlist.materials?.forEach(material => {
              queryClient.invalidateQueries({ queryKey: [`/api/materials/${material.id}/recuts`] });
            });
          });
        }
      }
      
      if (type === 'recut_added' || type === 'material_updated') {
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  useWebSocket('/ws', handleWebSocketMessage);
  
  // Fetch colors for adding materials
  const { data: colors = [] } = useQuery<ColorWithGroup[]>({
    queryKey: ['/api/colors'],
  });

  // Group colors by group for the add material dialog
  const groupedColors = colors.reduce((acc, color) => {
    const groupName = color.group?.name || "Ungrouped";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(color);
    return acc;
  }, {} as Record<string, ColorWithGroup[]>);
  
  // State for adding new sheets
  const [newSheetsCount, setNewSheetsCount] = useState<string>("");
  
  // State for recut entry
  const [recutDialog, setRecutDialog] = useState<{ open: boolean; materialId: number | null }>({ open: false, materialId: null });
  const [recutQuantity, setRecutQuantity] = useState<string>("1");
  const [recutReason, setRecutReason] = useState<string>("");

  // State for adding new materials (colors)
  const [addMaterialDialog, setAddMaterialDialog] = useState<boolean>(false);
  const [newMaterialColorId, setNewMaterialColorId] = useState<string>("0");
  const [newMaterialSheets, setNewMaterialSheets] = useState<string>("1");
  
  // No optimistic updates - use server state only for reliability
  
  // Force re-render counter
  const [updateCounter, setUpdateCounter] = useState(0);

  // Automatic timer management
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

  // Auto-refresh job data every 5 seconds when modal is open
  useEffect(() => {
    if (!open || !job?.id) return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [open, job?.id, queryClient]);

  // Live timer updates every second
  useEffect(() => {
    if (!open || !timerStartTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - timerStartTime.getTime()) / 1000);
      setLiveTimerSeconds(elapsedSeconds);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [open, timerStartTime]);

  // Start/stop timer when modal opens/closes (only if NOT in view-only mode)
  useEffect(() => {
    if (open && job?.id && !viewOnlyMode) {
      const startTime = new Date();
      setTimerStartTime(startTime);
      setLiveTimerSeconds(0);
      startTimerMutation.mutate(job.id);
    }
    
    // Stop timer when modal closes (only if timer was started)
    return () => {
      if (job?.id && !viewOnlyMode) {
        stopTimerMutation.mutate(job.id);
        setTimerStartTime(null);
        setLiveTimerSeconds(0);
      }
    };
  }, [open, job?.id, viewOnlyMode]);

  // Clear state when modal closes
  useEffect(() => {
    if (!open) {
      setNewSheetsCount("");
    }
  }, [open]);;

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
      
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: (error, variables, context) => {
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

  const addSheetsMutation = useMutation({
    mutationFn: ({ materialId, additionalSheets, isRecut }: { materialId: number; additionalSheets: number; isRecut?: boolean }) =>
      apiRequest('POST', `/api/materials/${materialId}/add-sheets`, { additionalSheets, isRecut }),
    onSuccess: async () => {
      // Force immediate refetch with aggressive cache busting
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      await queryClient.refetchQueries({ queryKey: ['/api/jobs'] });
      
      // Force component re-render
      setUpdateCounter(prev => prev + 1);
      
      setNewSheetsCount('');
      toast({ title: "Success", description: "Sheets added successfully" });
    },
    onError: (error) => {
      console.error('Add sheets error:', error);
      toast({ title: "Error", description: "Failed to add additional sheets" });
    }
  });

  const deleteSheetMutation = useMutation({
    mutationFn: ({ materialId, sheetIndex }: { materialId: number; sheetIndex: number }) =>
      apiRequest('DELETE', `/api/materials/${materialId}/sheet/${sheetIndex}`),
    onSuccess: async () => {
      console.log('Delete successful, refreshing data...');
      
      // Force immediate refetch with aggressive cache busting
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      await queryClient.refetchQueries({ queryKey: ['/api/jobs'] });
      
      // Force component re-render
      setUpdateCounter(prev => prev + 1);
      
      console.log('Data refresh complete');
      toast({ title: "Success", description: "Sheet deleted and sequence updated" });
    },
    onError: (error) => {
      console.error('Delete sheet error:', error);
      toast({ title: "Error", description: "Failed to delete sheet" });
    }
  });

  const deleteCutlistMutation = useMutation({
    mutationFn: (cutlistId: number) =>
      apiRequest('DELETE', `/api/cutlists/${cutlistId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Success", description: "Cutlist deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete cutlist" });
    }
  });

  const addRecutMutation = useMutation({
    mutationFn: ({ materialId, quantity, reason }: { materialId: number; quantity: number; reason?: string }) =>
      apiRequest('POST', `/api/materials/${materialId}/recuts`, { quantity, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: [`/api/materials/${recutDialog.materialId}/recuts`] });
      setRecutDialog({ open: false, materialId: null });
      setRecutQuantity("1");
      setRecutReason("");
      toast({ title: "Success", description: "Recut entry added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add recut entry" });
    }
  });

  const addMaterialMutation = useMutation({
    mutationFn: ({ jobId, colorId, totalSheets }: { jobId: number; colorId: number; totalSheets: number }) =>
      apiRequest('POST', `/api/jobs/${jobId}/materials`, { colorId, totalSheets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setAddMaterialDialog(false);
      setNewMaterialColorId("0");
      setNewMaterialSheets("1");
      toast({ title: "Success", description: "Material added to job successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add material to job" });
    }
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (materialId: number) => apiRequest('DELETE', `/api/materials/${materialId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Success", description: "Material deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete material" });
    }
  });



  // Calculate totals across all cutlists including recuts
  const [totalSheets, completedSheets, skippedSheets] = useMemo(() => {
    if (!job) return [0, 0, 0];
    
    let total = 0;
    let completed = 0;
    let skipped = 0;
    
    job.cutlists?.forEach(cutlist => {
      cutlist.materials?.forEach(m => {
        const sheetStatuses = m.sheetStatuses || [];
        
        // Count cut and skipped sheets for original materials
        const cutCount = sheetStatuses.filter(status => status === 'cut').length;
        const skipCount = sheetStatuses.filter(status => status === 'skip').length;
        
        total += m.totalSheets;
        completed += cutCount;
        skipped += skipCount;
        
        // Add recut sheets to the total calculation
        m.recutEntries?.forEach(recut => {
          const recutStatuses = recut.sheetStatuses || [];
          const recutCutCount = recutStatuses.filter(status => status === 'cut').length;
          const recutSkipCount = recutStatuses.filter(status => status === 'skip').length;
          
          total += recut.quantity;
          completed += recutCutCount;
          skipped += recutSkipCount;
        });
      });
    });
    
    return [total, completed, skipped];
  }, [job, job?.cutlists]);
  
  // Progress calculation including recuts
  const effectiveTotalSheets = totalSheets - skippedSheets;
  const progress = effectiveTotalSheets > 0 ? Math.round((completedSheets / effectiveTotalSheets) * 100) : 0;

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
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Calculate total duration including live timer
  const currentDuration = () => {
    const baseDuration = job?.totalDuration || 0;
    return baseDuration + liveTimerSeconds;
  };

  // Handle sheet cut - with optimistic updates
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
    
    const newStatus = currentStatus === 'cut' ? 'pending' : 'cut';
    updateSheetStatusMutation.mutate({ materialId, sheetIndex, status: newStatus });
  };

  // Handle sheet skip - with optimistic updates
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
    
    const newStatus = currentStatus === 'skip' ? 'pending' : 'skip';
    updateSheetStatusMutation.mutate({ materialId, sheetIndex, status: newStatus });
  };

  const handleAddSheets = (materialId: number) => {
    const count = parseInt(newSheetsCount);
    if (!count || count < 1) {
      toast({ title: "Error", description: "Please enter a valid number of sheets" });
      return;
    }
    addSheetsMutation.mutate({ materialId, additionalSheets: count });
  };

  const handleAddRecut = (materialId: number) => {
    setRecutDialog({ open: true, materialId });
  };

  const handleConfirmRecut = () => {
    const quantity = parseInt(recutQuantity);
    if (!quantity || quantity < 1) {
      toast({ title: "Error", description: "Please enter a valid quantity" });
      return;
    }
    if (recutDialog.materialId) {
      addRecutMutation.mutate({ 
        materialId: recutDialog.materialId, 
        quantity, 
        reason: recutReason.trim() || undefined 
      });
    }
  };

  const handleDeleteCutlist = (cutlistId: number) => {
    if (confirm("Are you sure you want to delete this cutlist? This will also delete all materials in it.")) {
      deleteCutlistMutation.mutate(cutlistId);
    }
  };

  const handleAddMaterial = () => {
    const colorId = parseInt(newMaterialColorId);
    const totalSheets = parseInt(newMaterialSheets);
    
    if (!colorId || colorId === 0) {
      toast({ title: "Error", description: "Please select a color" });
      return;
    }
    
    if (!totalSheets || totalSheets < 1) {
      toast({ title: "Error", description: "Please enter a valid number of sheets" });
      return;
    }
    
    if (job?.id) {
      addMaterialMutation.mutate({ jobId: job.id, colorId, totalSheets });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              {job.jobNumber} - {job.customerName}
              {viewOnlyMode && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  View Only
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (job?.id) {
                  // Open a real popup window that can stay on top of other apps
                  const popupUrl = `${window.location.origin}/popup/${job.id}`;
                  const popup = window.open(
                    popupUrl,
                    `job-popup-${job.id}`,
                    'width=500,height=600,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no,top=100,left=100'
                  );
                  
                  if (popup) {
                    popup.focus();
                    
                    // Try to keep window focused and on top (browser permitting)
                    const keepOnTop = () => {
                      if (!popup.closed) {
                        popup.focus();
                        setTimeout(keepOnTop, 1000); // Refocus every second
                      }
                    };
                    
                    // Start the keep-on-top interval
                    setTimeout(keepOnTop, 1000);
                    
                    onOpenChange(false); // Close the modal when opening popup
                  } else {
                    alert('Please allow popups for this site to use the popup window feature.');
                  }
                }
              }}
              className="flex items-center gap-2"
              title="Open job in separate popup window"
            >
              <Maximize2 className="h-4 w-4" />
              Popup Window
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Job Summary */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div>
                <div className="text-sm text-gray-600">Job Name</div>
                <div className="font-medium">{job.jobName}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <Badge className={getStatusBadgeColor(job.status)}>
                  {job.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-gray-600">Progress</div>
                <div className="space-y-2">
                  {/* Original Sheets Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600 font-medium">Original Sheets</span>
                      <span className="text-xs text-gray-700 font-semibold bg-gray-100 px-2 py-0.5 rounded">{completedSheets}/{effectiveTotalSheets}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  
                  {/* Recut Sheets Progress */}
                  {(() => {
                    let recutTotal = 0;
                    let recutCompleted = 0;
                    let recutSkipped = 0;
                    
                    job.cutlists?.forEach(cutlist => {
                      cutlist.materials?.forEach(m => {
                        m.recutEntries?.forEach(recut => {
                          const recutStatuses = recut.sheetStatuses || [];
                          const recutCutCount = recutStatuses.filter(status => status === 'cut').length;
                          const recutSkipCount = recutStatuses.filter(status => status === 'skip').length;
                          
                          recutTotal += recut.quantity;
                          recutCompleted += recutCutCount;
                          recutSkipped += recutSkipCount;
                        });
                      });
                    });
                    
                    const recutEffectiveTotal = recutTotal - recutSkipped;
                    const recutProgress = recutEffectiveTotal > 0 ? Math.round((recutCompleted / recutEffectiveTotal) * 100) : 0;
                    
                    if (recutTotal > 0) {
                      return (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-orange-600 font-medium">Recut Sheets</span>
                            <span className="text-xs text-orange-700 font-semibold bg-orange-100 px-2 py-0.5 rounded">{recutCompleted}/{recutEffectiveTotal}</span>
                          </div>
                          <div className="relative h-2 bg-orange-100 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${recutProgress}%` }}></div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Overall Progress Summary */}
                  <div className="text-xs text-gray-500 pt-1 border-t">
                    <span>Overall: {progress}%</span>
                    {skippedSheets > 0 && <span className="ml-2">({skippedSheets} skipped)</span>}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Duration</div>
                <div className="font-medium">
                  {timerStartTime ? (
                    <span className="text-blue-600">
                      {formatDuration(currentDuration())} (Active)
                    </span>
                  ) : (
                    formatDuration(job.totalDuration || 0) || 'Not started'
                  )}
                </div>
              </div>
            </div>
            
            {/* Status information - no manual controls needed, status is automatic */}
            <div className="ml-4 text-sm text-gray-600">
              Status updates automatically based on sheet completion
            </div>
          </div>



          {/* Cutlists */}
          {job.cutlists && job.cutlists.length > 0 ? (
            <div className="space-y-4">
              {job.cutlists.map((cutlist) => (
                <div key={cutlist.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">{cutlist.name}</h3>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteCutlist(cutlist.id)}
                      disabled={deleteCutlistMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>

                  {cutlist.materials && cutlist.materials.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-end mb-4">
                        <Button
                          size="sm"
                          onClick={() => setAddMaterialDialog(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Palette className="w-4 h-4 mr-1" />
                          Add Different Color
                        </Button>
                      </div>
                      {cutlist.materials.map((material) => {
                        const sheetStatuses = material.sheetStatuses || [];
                        
                        // Calculate completed and skipped sheets dynamically from current statuses
                        const completedCount = sheetStatuses.filter(status => status === 'cut').length;
                        const skippedCount = sheetStatuses.filter(status => status === 'skip').length;
                        const effectiveTotal = material.totalSheets - skippedCount;
                        const progressPercentage = effectiveTotal > 0 ? Math.round((completedCount / effectiveTotal) * 100) : 0;
                        
                        return (
                          <div key={material.id} className="border-l-4 border-l-blue-500 pl-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-4">
                                <TextureSwatch 
                                  texture={material.color.texture} 
                                  hexColor={material.color.hexColor}
                                  name={material.color.name}
                                  size="lg"
                                />
                                <div>
                                  <div className="font-medium">{material.color.name}</div>
                                  <div className="space-y-2">
                                    {/* Original Sheets Progress */}
                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-600 font-medium">Original: {completedCount}/{effectiveTotal}</span>
                                        <span className="text-xs text-gray-700 font-semibold bg-gray-100 px-2 py-0.5 rounded">{progressPercentage}%</span>
                                      </div>
                                      <Progress value={progressPercentage} className="h-2" />
                                    </div>
                                    
                                    {/* Recut Sheets Progress */}
                                    {(() => {
                                      let recutTotal = 0;
                                      let recutCompleted = 0;
                                      let recutSkipped = 0;
                                      
                                      material.recutEntries?.forEach(recut => {
                                        const recutStatuses = recut.sheetStatuses || [];
                                        const recutCutCount = recutStatuses.filter(status => status === 'cut').length;
                                        const recutSkipCount = recutStatuses.filter(status => status === 'skip').length;
                                        
                                        recutTotal += recut.quantity;
                                        recutCompleted += recutCutCount;
                                        recutSkipped += recutSkipCount;
                                      });
                                      
                                      const recutEffectiveTotal = recutTotal - recutSkipped;
                                      const recutProgress = recutEffectiveTotal > 0 ? Math.round((recutCompleted / recutEffectiveTotal) * 100) : 0;
                                      
                                      if (recutTotal > 0) {
                                        return (
                                          <div>
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="text-xs text-orange-600 font-medium">Recut: {recutCompleted}/{recutEffectiveTotal}</span>
                                              <span className="text-xs text-orange-700 font-semibold bg-orange-100 px-2 py-0.5 rounded">{recutProgress}%</span>
                                            </div>
                                            <div className="relative h-2 bg-orange-100 rounded-full overflow-hidden">
                                              <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${recutProgress}%` }}></div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    
                                    {skippedCount > 0 && (
                                      <div className="text-xs text-gray-500">
                                        {skippedCount} sheets skipped
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Delete ${material.color.name} material? This will also delete all recut entries for this material.`)) {
                                    deleteMaterialMutation.mutate(material.id);
                                  }
                                }}
                                disabled={deleteMaterialMutation.isPending}
                                className="w-8 h-8 p-0 flex-shrink-0"
                              >
                                ×
                              </Button>
                            </div>
                            
                            {/* Sheet Grid */}
                            <div className="grid grid-cols-6 gap-2 mt-3" key={`material-${material.id}-sheets-${material.totalSheets}-${updateCounter}`}>
                              {Array.from({ length: material.totalSheets }, (_, i) => {
                                // Use optimistic status if available, otherwise fall back to server status
                                const optimisticStatus = optimisticSheetStatuses[material.id]?.[i];
                                const serverStatus = sheetStatuses[i] || 'pending';
                                const status = optimisticStatus !== undefined ? optimisticStatus : serverStatus;
                                const isCutLoading = loadingCutButtons[material.id]?.has(i) || false;
                                const isSkipLoading = loadingSkipButtons[material.id]?.has(i) || false;
                                
                                return (
                                  <div key={`sheet-${material.id}-${i}-${updateCounter}`} className="flex flex-col items-center gap-1">
                                    <div className="text-sm font-medium">
                                      Sheet {i + 1}
                                    </div>
                                    
                                    <div className="flex gap-1 items-center">
                                      <button
                                        onClick={() => handleSheetCut(material.id, i)}
                                        disabled={isCutLoading}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                                          status === 'cut' 
                                            ? 'bg-green-600 text-white' 
                                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        } ${isCutLoading ? 'opacity-75' : ''}`}
                                      >
                                        {isCutLoading ? (
                                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                                        ) : null}
                                        Cut
                                      </button>
                                      <button
                                        onClick={() => handleSheetSkip(material.id, i)}
                                        disabled={isSkipLoading}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                                          status === 'skip' 
                                            ? 'bg-red-600 text-white' 
                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                        } ${isSkipLoading ? 'opacity-75' : ''}`}
                                      >
                                        {isSkipLoading ? (
                                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                                        ) : null}
                                        Skip
                                      </button>
                                      {status === 'skip' && (
                                        <button
                                          onClick={() => {
                                            console.log(`Deleting sheet ${i + 1} from material ${material.id}`);
                                            deleteSheetMutation.mutate({ materialId: material.id, sheetIndex: i });
                                          }}
                                          disabled={deleteSheetMutation.isPending}
                                          className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 ml-1 flex-shrink-0 disabled:opacity-50"
                                          title="Delete this sheet"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Recut History Section */}
                            <RecutHistorySection materialId={material.id} />

                            {/* Add Sheets Section */}
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                              <h4 className="font-medium mb-2">Add More Sheets</h4>
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="number"
                                  placeholder="Number of sheets"
                                  value={newSheetsCount}
                                  onChange={(e) => setNewSheetsCount(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddSheets(material.id)}
                                  className="w-32"
                                  min="1"
                                />
                                <Button 
                                  size="sm"
                                  onClick={() => handleAddSheets(material.id)} 
                                  disabled={addSheetsMutation.isPending || !newSheetsCount}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddRecut(material.id)} 
                                  disabled={addRecutMutation.isPending}
                                  className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" />
                                  Add Recut
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center py-8 text-gray-500">
                        No materials in this cutlist yet
                      </div>
                      <div className="flex justify-center">
                        <Button
                          size="sm"
                          onClick={() => setAddMaterialDialog(true)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Palette className="w-4 h-4 mr-1" />
                          Add Material Color
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No cutlists found. Create your first cutlist above.
            </div>
          )}
        </div>
      </DialogContent>
      
      {/* Recut Entry Dialog */}
      <Dialog open={recutDialog.open} onOpenChange={(open) => setRecutDialog({ open, materialId: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Recut Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                value={recutQuantity}
                onChange={(e) => setRecutQuantity(e.target.value)}
                placeholder="Number of sheets to recut"
                min="1"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason (Optional)</label>
              <Input
                value={recutReason}
                onChange={(e) => setRecutReason(e.target.value)}
                placeholder="e.g., Damaged during cutting"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setRecutDialog({ open: false, materialId: null })}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmRecut}
                disabled={addRecutMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Add Recut
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Material Dialog */}
      <Dialog open={addMaterialDialog} onOpenChange={setAddMaterialDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Different Color</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Material Color</label>
              <Select value={newMaterialColorId} onValueChange={setNewMaterialColorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Color" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedColors).map(([groupName, groupColors]) => (
                    <div key={groupName}>
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100">
                        {groupName}
                      </div>
                      {groupColors.map((color) => (
                        <SelectItem key={color.id} value={color.id.toString()}>
                          <div className="flex items-center space-x-2">
                            <TextureSwatch 
                              texture={color.texture} 
                              hexColor={color.hexColor}
                              name={color.name}
                              size="md"
                            />
                            <span>{color.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Number of Sheets</label>
              <Input
                type="number"
                value={newMaterialSheets}
                onChange={(e) => setNewMaterialSheets(e.target.value)}
                placeholder="Total sheets needed"
                min="1"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setAddMaterialDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddMaterial}
                disabled={addMaterialMutation.isPending || newMaterialColorId === "0"}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Palette className="w-4 h-4 mr-1" />
                Add Material
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}