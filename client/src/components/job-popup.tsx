import { useState, useEffect } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { JobWithMaterials, JobMaterial, RecutEntry } from "@shared/schema";

interface JobPopupProps {
  jobId: number;
  onClose: () => void;
}

export function JobPopup({ jobId, onClose }: JobPopupProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: job, error, isLoading } = useQuery<JobWithMaterials>({
    queryKey: [`/api/jobs/${jobId}`],
    refetchInterval: 5000, // Faster refresh for better button updates
    refetchIntervalInBackground: false,
  });

  // Auto-refresh to sync with main job view (minimal frequency)
  useEffect(() => {
    if (job) {
      // Very debounced cache invalidation to minimize lag
      const timeoutId = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      }, 5000); // Much longer delay to reduce updates
      
      return () => clearTimeout(timeoutId);
    }
  }, [job, queryClient]);

  // Optimistic state for immediate UI updates
  const [optimisticSheetStatuses, setOptimisticSheetStatuses] = useState<Record<string, Record<number, string>>>({});
  const [optimisticRecutStatuses, setOptimisticRecutStatuses] = useState<Record<string, Record<number, string>>>({});
  
  // Loading states for individual sheet buttons - separate for cut and skip
  const [loadingCutButtons, setLoadingCutButtons] = useState<Record<string, Set<number>>>({});
  const [loadingSkipButtons, setLoadingSkipButtons] = useState<Record<string, Set<number>>>({});

  // Update sheet status mutation with optimistic updates
  const updateSheetMutation = useMutation({
    mutationFn: ({ materialId, sheetIndex, status, actionType }: { 
      materialId: number; 
      sheetIndex: number; 
      status: 'cut' | 'skip' | 'pending';
      actionType: 'cut' | 'skip';
    }) => {
      console.log('Making API call:', { materialId, sheetIndex, status, actionType });
      return apiRequest('PUT', `/api/materials/${materialId}/sheet-status`, { sheetIndex, status });
    },
    onMutate: ({ materialId, sheetIndex, status, actionType }) => {
      // Set loading state based on which button was clicked
      if (actionType === 'cut') {
        setLoadingCutButtons(prev => ({
          ...prev,
          [materialId]: new Set([...Array.from(prev[materialId] || []), sheetIndex])
        }));
      } else if (actionType === 'skip') {
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
      // Clear loading state based on which button was clicked
      if (variables.actionType === 'cut') {
        setLoadingCutButtons(prev => ({
          ...prev,
          [variables.materialId]: new Set(Array.from(prev[variables.materialId] || []).filter(i => i !== variables.sheetIndex))
        }));
      } else if (variables.actionType === 'skip') {
        setLoadingSkipButtons(prev => ({
          ...prev,
          [variables.materialId]: new Set(Array.from(prev[variables.materialId] || []).filter(i => i !== variables.sheetIndex))
        }));
      }
      
      // Force immediate refresh to sync with server
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
    },
    onError: (error: any, variables, context) => {
      console.error('API error:', error);
      
      // Clear loading state based on which button was clicked
      if (variables.actionType === 'cut') {
        setLoadingCutButtons(prev => ({
          ...prev,
          [variables.materialId]: new Set(Array.from(prev[variables.materialId] || []).filter(i => i !== variables.sheetIndex))
        }));
      } else if (variables.actionType === 'skip') {
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
      
      toast({
        title: "Error",
        description: error.message || "Failed to update sheet status",
        variant: "destructive"
      });
    }
  });

  const handleSheetClick = (materialId: number, sheetIndex: number, currentStatus: string) => {
    console.log('handleSheetClick called:', { materialId, sheetIndex, currentStatus });
    
    // Get the current status (optimistic or server)
    const optimisticStatus = optimisticSheetStatuses[materialId]?.[sheetIndex];
    const actualStatus = optimisticStatus !== undefined ? optimisticStatus : currentStatus;
    
    // Cycle through states: pending -> cut -> skip -> pending
    let newStatus: 'cut' | 'skip' | 'pending';
    let actionType: 'cut' | 'skip';
    
    if (actualStatus === 'pending') {
      newStatus = 'cut';
      actionType = 'cut';
    } else if (actualStatus === 'cut') {
      newStatus = 'skip';
      actionType = 'skip';
    } else {
      newStatus = 'pending'; // Cycles back from skip to pending
      actionType = 'skip'; // The button that was clicked to go back to pending
    }
    
    console.log('New status:', newStatus, 'Action type:', actionType);
    updateSheetMutation.mutate({ materialId, sheetIndex, status: newStatus, actionType });
  };

  // Skip handler removed - main button now cycles through all states

  if (isLoading) {
    return (
      <div 
        className="fixed top-4 right-4 w-80 h-40 bg-white border rounded-lg shadow-2xl flex items-center justify-center"
        style={{ zIndex: 2147483647 }}
      >
        <div className="text-sm text-gray-500">Loading job...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="fixed top-4 right-4 w-80 h-40 bg-white border rounded-lg shadow-2xl flex items-center justify-center"
        style={{ zIndex: 2147483647 }}
      >
        <div className="text-sm text-red-500">Error loading job: {error.message}</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div 
        className="fixed top-4 right-4 w-80 h-40 bg-white border rounded-lg shadow-2xl flex items-center justify-center"
        style={{ zIndex: 2147483647 }}
      >
        <div className="text-sm text-gray-500">No job data found</div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed top-4 right-4 bg-white border-2 border-blue-500 rounded-lg shadow-2xl transition-all duration-200 ${
        isMinimized ? 'w-64 h-16' : 'w-96 max-h-[80vh] overflow-y-auto'
      }`}
      style={{ 
        zIndex: 2147483647, // Maximum z-index value to ensure it stays on top
        position: 'fixed',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', // Enhanced shadow for visibility
        border: '2px solid #3b82f6', // Blue border to make it stand out
        userSelect: 'none',
        pointerEvents: 'auto'
      }}
      onMouseEnter={(e) => {
        // Force the popup to stay on top when hovered
        e.currentTarget.style.zIndex = '2147483647';
      }}
    >
      {/* Stay on Top Indicator - Moved inside container for full visibility */}
      <div className="bg-green-500 text-white text-xs px-4 py-3 rounded-t-lg flex items-center justify-center space-x-2 shadow-lg border-b-2 border-green-400">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        <span className="font-medium text-center">Position this window over your label program • Press Ctrl+Space to refocus</span>
      </div>

      {/* Header with enhanced visibility */}
      <div className="flex items-center justify-between p-3 border-b bg-blue-50 border-blue-200">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-sm text-blue-900 truncate">
            📋 {job.customerName} - {job.jobName}
          </h3>
          <Badge variant="outline" className="text-xs bg-blue-100">
            {job.status}
          </Badge>
        </div>
        <div className="flex items-center space-x-1">
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
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3">
          {/* Materials */}
          {job.cutlists?.map((cutlist) =>
            cutlist.materials?.map((material) => (
              <div key={material.id} className="space-y-2">
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <div className="flex items-center space-x-2">
                    {/* Show texture image if available, otherwise fallback to color */}
                    {material.color?.texture ? (
                      <img
                        src={material.color.texture}
                        alt={material.color?.name}
                        className="w-5 h-5 rounded border-2 border-gray-300 object-cover"
                      />
                    ) : (
                      <div
                        className="w-5 h-5 rounded border-2 border-gray-300"
                        style={{ backgroundColor: material.color?.hexColor || '#ccc' }}
                      />
                    )}
                    <h4 className="text-sm font-semibold text-gray-800">{material.color?.name}</h4>
                  </div>
                  <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    {material.sheetStatuses?.filter(s => s === 'cut').length || 0}/{material.totalSheets}
                  </span>
                </div>
                
                {/* Sheet grid - fixed layout to prevent jumping */}
                <div className="grid grid-cols-6 gap-2 p-2 bg-white rounded border min-h-[64px]">
                  {Array.from({ length: material.totalSheets }).map((_, index) => {
                    // Use optimistic status if available, otherwise fall back to server status
                    const optimisticStatus = optimisticSheetStatuses[material.id]?.[index];
                    const serverStatus = material.sheetStatuses?.[index] || 'pending';
                    const status = optimisticStatus !== undefined ? optimisticStatus : serverStatus;
                    const isCutLoading = loadingCutButtons[material.id]?.has(index) || false;
                    const isSkipLoading = loadingSkipButtons[material.id]?.has(index) || false;
                    const isButtonLoading = isCutLoading || isSkipLoading;
                    
                    return (
                      <div key={`${material.id}-${index}`} className="flex flex-col">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Popup click:', material.id, index, status);
                            handleSheetClick(material.id, index, status);
                          }}
                          className={`w-10 h-10 text-sm font-bold rounded border-2 flex items-center justify-center transition-all duration-150 ${
                            status === 'cut' 
                              ? 'bg-green-500 text-white border-green-600' 
                              : status === 'skip'
                              ? 'bg-red-400 text-white border-red-500'
                              : 'bg-white border-gray-400 hover:border-blue-500 hover:bg-blue-50'
                          } ${isButtonLoading ? 'opacity-75' : ''}`}
                          disabled={isButtonLoading}
                          type="button"
                          style={{ 
                            touchAction: 'manipulation',
                            userSelect: 'none',
                            minWidth: '40px',
                            minHeight: '40px'
                          }}
                        >
                          {isButtonLoading ? (
                            <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            index + 1
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Recuts */}
                <RecutsList 
                  materialId={material.id} 
                  onRecutUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
                    queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
                  }} 
                />

              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Separate component for recuts to keep popup clean
function RecutsList({ 
  materialId, 
  onRecutUpdate 
}: { 
  materialId: number; 
  onRecutUpdate: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [optimisticRecutStatuses, setOptimisticRecutStatuses] = useState<Record<string, Record<number, string>>>({});
  
  // Loading states for individual recut sheet buttons - separate for cut and skip
  const [loadingRecutCutButtons, setLoadingRecutCutButtons] = useState<Record<string, Set<number>>>({});
  const [loadingRecutSkipButtons, setLoadingRecutSkipButtons] = useState<Record<string, Set<number>>>({});
  
  const { data: recuts } = useQuery<RecutEntry[]>({
    queryKey: [`/api/materials/${materialId}/recuts`],
    refetchInterval: 3000, // Faster refresh for recuts
    refetchIntervalInBackground: false,
  });

  const updateRecutSheetMutation = useMutation({
    mutationFn: ({ recutId, sheetIndex, status, actionType }: { 
      recutId: number; 
      sheetIndex: number; 
      status: 'cut' | 'skip' | 'pending';
      actionType: 'cut' | 'skip';
    }) => {
      console.log('Making recut API call:', { recutId, sheetIndex, status, actionType });
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
      
      // Immediately update the UI optimistically
      setOptimisticRecutStatuses(prev => ({
        ...prev,
        [recutId]: {
          ...prev[recutId],
          [sheetIndex]: status
        }
      }));
      
      // Return context for rollback if needed
      return { recutId, sheetIndex, previousStatus: optimisticRecutStatuses[recutId]?.[sheetIndex], action: status };
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
      
      // Force immediate refresh to sync with server
      onRecutUpdate();
    },
    onError: (error: any, variables, context) => {
      console.error('Recut API error:', error);
      
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
      
      // Rollback optimistic update on error
      if (context) {
        setOptimisticRecutStatuses(prev => ({
          ...prev,
          [context.recutId]: {
            ...prev[context.recutId],
            [context.sheetIndex]: context.previousStatus || 'pending'
          }
        }));
      }
      
      toast({
        title: "Error", 
        description: error.message || "Failed to update recut sheet status",
        variant: "destructive"
      });
    }
  });

  const handleRecutSheetClick = (recutId: number, sheetIndex: number, currentStatus: string) => {
    console.log('handleRecutSheetClick called:', { 
      recutId, 
      sheetIndex, 
      currentStatus
    });
    
    // Get the current status (optimistic or server)
    const optimisticStatus = optimisticRecutStatuses[recutId]?.[sheetIndex];
    const actualStatus = optimisticStatus !== undefined ? optimisticStatus : currentStatus;
    
    // Toggle: if already cut, set to pending; if already skip, set to pending; otherwise set to cut
    let newStatus: 'cut' | 'skip' | 'pending';
    if (actualStatus === 'pending') {
      newStatus = 'cut';
    } else if (actualStatus === 'cut') {
      newStatus = 'pending';
    } else if (actualStatus === 'skip') {
      newStatus = 'pending';
    } else {
      newStatus = 'cut';
    }
    
    console.log('New recut status:', newStatus);
    // Determine which button was clicked based on the new status
    const actionType = newStatus === 'cut' ? 'cut' : 'skip';
    updateRecutSheetMutation.mutate({ recutId, sheetIndex, status: newStatus, actionType });
  };

  const handleRecutSheetCut = (recutId: number, sheetIndex: number) => {
    // Get the current status (optimistic or server)
    const optimisticStatus = optimisticRecutStatuses[recutId]?.[sheetIndex];
    const recut = recuts?.find(r => r.id === recutId);
    const serverStatuses = recut?.sheetStatuses || [];
    const serverStatus = serverStatuses[sheetIndex] || 'pending';
    const currentStatus = optimisticStatus !== undefined ? optimisticStatus : serverStatus;
    
    // Toggle: if already cut, set to pending; otherwise set to cut
    const newStatus = currentStatus === 'cut' ? 'pending' : 'cut';
    updateRecutSheetMutation.mutate({ 
      recutId, 
      sheetIndex, 
      status: newStatus,
      actionType: 'cut' // Pass which button was clicked
    });
  };

  const handleRecutSheetSkip = (recutId: number, sheetIndex: number) => {
    // Get the current status (optimistic or server)
    const optimisticStatus = optimisticRecutStatuses[recutId]?.[sheetIndex];
    const recut = recuts?.find(r => r.id === recutId);
    const serverStatuses = recut?.sheetStatuses || [];
    const serverStatus = serverStatuses[sheetIndex] || 'pending';
    const currentStatus = optimisticStatus !== undefined ? optimisticStatus : serverStatus;
    
    // Toggle: if already skipped, set to pending; otherwise set to skip
    const newStatus = currentStatus === 'skip' ? 'pending' : 'skip';
    updateRecutSheetMutation.mutate({ 
      recutId, 
      sheetIndex, 
      status: newStatus,
      actionType: 'skip' // Pass which button was clicked
    });
  };

  if (!recuts || recuts.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <h4 className="text-sm font-semibold text-orange-700">Recuts</h4>
      {recuts.map((recut) => (
        <div key={recut.id} className="bg-orange-50 p-2 rounded border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-orange-800 font-medium">
              Recut {recut.quantity} sheets
            </span>
            <span className="text-xs text-orange-600">
              {recut.completedSheets}/{recut.quantity} completed
            </span>
          </div>
          
          {/* Recut Sheet Grid */}
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: recut.quantity }, (_, index) => {
              // Use optimistic status if available, otherwise fall back to server status
              const optimisticStatus = optimisticRecutStatuses[recut.id]?.[index];
              const serverStatuses = recut.sheetStatuses || [];
              const serverStatus = serverStatuses[index] || 'pending';
              const status = optimisticStatus !== undefined ? optimisticStatus : serverStatus;
              const isCutLoading = loadingRecutCutButtons[recut.id]?.has(index) || false;
              const isSkipLoading = loadingRecutSkipButtons[recut.id]?.has(index) || false;
              const isButtonLoading = isCutLoading || isSkipLoading;
              
              return (
                <div key={`recut-${recut.id}-${index}`} className="flex flex-col">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Recut popup click:', recut.id, index, status);
                      handleRecutSheetClick(recut.id, index, status);
                    }}
                    className={`w-8 h-8 text-xs font-bold rounded border-2 flex items-center justify-center transition-all duration-150 ${
                      status === 'cut' 
                        ? 'bg-green-500 text-white border-green-600' 
                        : status === 'skip'
                        ? 'bg-red-400 text-white border-red-500'
                        : 'bg-white border-gray-400 hover:border-orange-500 hover:bg-orange-50'
                    } ${isButtonLoading ? 'opacity-75' : ''}`}
                    disabled={isButtonLoading}
                    type="button"
                    style={{ 
                      touchAction: 'manipulation',
                      userSelect: 'none',
                      minWidth: '32px',
                      minHeight: '32px'
                    }}
                  >
                    {isButtonLoading ? (
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      index + 1
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}