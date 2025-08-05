import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Clock, RefreshCw, Download, Eye, Trash2, Pause, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import Layout from "@/components/layout";
import JobModal from "@/components/job-modal";
import JobDetailsModal from "@/components/job-details-modal-new";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { JobWithMaterials } from "@shared/schema";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithMaterials | null>(null);
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [deleteJobId, setDeleteJobId] = useState<number | null>(null);
  
  // Date range states for analytics
  const [sheetsCutDateRange, setSheetsCutDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())),
    to: new Date()
  });
  const [avgTimeDateRange, setAvgTimeDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())),
    to: new Date()
  });

  // Add state for average time type
  const [avgTimeType, setAvgTimeType] = useState<'job' | 'sheet'>('job');

  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Real-time updates with stable callback
  const handleWebSocketMessage = useCallback((message: MessageEvent) => {
    try {
      const data = JSON.parse(message.data);
      
      switch (data.type) {
        case 'job_created':
        case 'job_updated':
        case 'job_timer_started':
        case 'job_timer_stopped':
          queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          if (data.type === 'job_updated') {
            toast({
              title: "Job Updated",
              description: "Job status has been updated",
            });
          }
          break;
        case 'material_updated':
        case 'sheet_status_updated':
        case 'recut_added':
        case 'recut_sheet_status_updated':
          queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          break;
        case 'job_deleted':
          queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [queryClient, toast]);

  useWebSocket('/ws', handleWebSocketMessage);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for status filter events from sidebar
  useEffect(() => {
    const handleStatusFilter = (event: CustomEvent) => {
      setStatusFilter(event.detail);
    };

    const handleOpenJobModal = () => {
      setShowJobModal(true);
    };

    window.addEventListener('filterByStatus', handleStatusFilter as EventListener);
    window.addEventListener('openJobModal', handleOpenJobModal as EventListener);

    return () => {
      window.removeEventListener('filterByStatus', handleStatusFilter as EventListener);
      window.removeEventListener('openJobModal', handleOpenJobModal as EventListener);
    };
  }, []);

  // Helper function to get start of day in UTC
  const getStartOfDayUTC = (date: Date) => {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  };

  // Fetch dashboard stats
  const { data: stats } = useQuery<{
    activeJobs: number;
    sheetsCutToday: number;
    avgJobTime: number;
    avgSheetTime: number;
    materialColors: number;
    jobsByStatus: { waiting: number; in_progress: number; paused: number; done: number };
  }>({
    queryKey: ['/api/dashboard/stats', sheetsCutDateRange, avgTimeDateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sheetsCutDateRange?.from) {
        // Ensure we're sending UTC dates
        const fromDate = getStartOfDayUTC(sheetsCutDateRange.from);
        params.set('sheetsFrom', fromDate.toISOString());
      }
      if (sheetsCutDateRange?.to) {
        params.set('sheetsTo', sheetsCutDateRange.to.toISOString());
      }
      if (avgTimeDateRange?.from) {
        // Ensure we're sending UTC dates
        const fromDate = getStartOfDayUTC(avgTimeDateRange.from);
        params.set('timeFrom', fromDate.toISOString());
      }
      if (avgTimeDateRange?.to) {
        params.set('timeTo', avgTimeDateRange.to.toISOString());
      }
      
      console.log('Dashboard API params:', params.toString());
      
      const res = await apiRequest('GET', `/api/dashboard/stats?${params}`);
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch jobs
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/jobs', searchQuery, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter) params.set('status', statusFilter);
      
      const res = await apiRequest('GET', `/api/jobs?${params}`);
      return res.json();
    },
  });

  // Update selectedJob when jobs data changes to keep modal data fresh
  useEffect(() => {
    if (selectedJob && jobs) {
      const updatedJob = jobs.find((job: any) => job.id === selectedJob.id);
      if (updatedJob) {
        setSelectedJob(updatedJob);
      }
    }
  }, [jobs, selectedJob]);



  const deleteJobMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest('DELETE', `/api/jobs/${jobId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Success", description: "Job deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete job" });
    },
  });

  const pauseJobMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest('POST', `/api/jobs/${jobId}/pause`),
    onSuccess: (data) => {
      console.log('Pause success:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Success", description: "Job paused" });
    },
    onError: (error) => {
      console.error('Pause error:', error);
      toast({ title: "Error", description: "Failed to pause job" });
    },
  });

  const resumeJobMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest('POST', `/api/jobs/${jobId}/resume`),
    onSuccess: (data) => {
      console.log('Resume success:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Success", description: "Job resumed" });
    },
    onError: (error) => {
      console.error('Resume error:', error);
      toast({ title: "Error", description: "Failed to resume job" });
    },
  });

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

  return (
    <Layout currentTime={currentTime}>
      <div className="p-6">
        {/* Dashboard Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Manage your CNC jobs and track progress</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Input
              type="text"
              placeholder="Search jobs, customers, or materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.activeJobs || 0}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <div className="w-6 h-6 text-primary">📋</div>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs text-green-600">
                  ↗ 12% from last week
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sheets Cut</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.sheetsCutToday || 0}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <div className="w-6 h-6 text-success">✂️</div>
                </div>
              </div>
              <div className="mt-auto flex justify-center">
                <DateRangePicker
                  dateRange={sheetsCutDateRange}
                  onDateRangeChange={setSheetsCutDateRange}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-600">Avg Time</p>
                    <Select value={avgTimeType} onValueChange={v => setAvgTimeType(v as 'job' | 'sheet')}>
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="job">Average Job Time</SelectItem>
                        <SelectItem value="sheet">Average Sheet Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {avgTimeType === 'job' ? (
                    <p className="text-3xl font-bold text-gray-900">
                      {stats?.avgJobTime ? formatDuration(stats.avgJobTime) : "0h 0m"}
                    </p>
                  ) : (
                    <p className="text-3xl font-bold text-gray-900">
                      {stats?.avgSheetTime ? formatDuration(stats.avgSheetTime) : "0h 0m"}
                    </p>
                  )}
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
              </div>
              <div className="mt-auto flex justify-center">
                <DateRangePicker
                  dateRange={avgTimeDateRange}
                  onDateRangeChange={setAvgTimeDateRange}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Material Colors</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.materialColors || 0}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <div className="w-6 h-6 text-purple-600">🎨</div>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs text-gray-600">Available in inventory</span>
              </div>
            </CardContent>
          </Card>
        </div>

        

        {/* Active Jobs Table */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Active Jobs</h3>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/jobs'] })}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Details
                  </th>
                  
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Loading jobs...
                    </td>
                  </tr>
                ) : jobs.filter((job: JobWithMaterials) => {
                    const matchesSearch = job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                         job.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                         job.jobName.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
                    return matchesSearch && matchesStatus;
                  }).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      {jobs.length === 0 ? "No jobs found. Create a new job to get started." : "No jobs match your current filter criteria."}
                    </td>
                  </tr>
                ) : (
                  jobs.filter((job: JobWithMaterials) => {
                    const matchesSearch = job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                         job.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                         job.jobName.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
                    return matchesSearch && matchesStatus;
                  }).map((job: JobWithMaterials) => {
                    // Calculate progress based on material sheets including recuts
                    let totalSheets = 0;
                    let completedSheets = 0;
                    let skippedSheets = 0;
                    
                    job.cutlists?.forEach(cutlist => {
                      cutlist.materials?.forEach(m => {
                        const sheetStatuses = m.sheetStatuses || [];
                        
                        // Count cut and skipped sheets for original materials
                        const cutCount = sheetStatuses.filter(status => status === 'cut').length;
                        const skipCount = sheetStatuses.filter(status => status === 'skip').length;
                        
                        totalSheets += m.totalSheets;
                        completedSheets += cutCount;
                        skippedSheets += skipCount;
                        
                        // Add recut sheets to the progress calculation
                        m.recutEntries?.forEach(recut => {
                          const recutStatuses = recut.sheetStatuses || [];
                          const recutCutCount = recutStatuses.filter(status => status === 'cut').length;
                          const recutSkipCount = recutStatuses.filter(status => status === 'skip').length;
                          
                          totalSheets += recut.quantity;
                          completedSheets += recutCutCount;
                          skippedSheets += recutSkipCount;
                        });
                      });
                    });
                    
                    // Calculate progress including recuts
                    const effectiveTotalSheets = totalSheets - skippedSheets;
                    const progress = effectiveTotalSheets > 0 ? Math.round((completedSheets / effectiveTotalSheets) * 100) : 0;

                    const handleJobClick = () => {
                      // For regular users and when timer should start, set the job and start timer
                      setViewOnlyMode(false);
                      setSelectedJob(job);
                      // Timer will start automatically when job details modal opens (handled in JobDetailsModal)
                    };

                    const handleViewOnlyClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      // For admins/super admins viewing without starting timer
                      setViewOnlyMode(true);
                      setSelectedJob(job);
                    };

                    return (
                      <tr key={job.id} className="hover:bg-gray-50 cursor-pointer" onClick={handleJobClick}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{job.jobName}</div>
                            <div className="text-sm text-gray-500">{job.customerName}</div>
                            <div className="text-xs text-gray-400">
                              Created: {new Date(job.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full space-y-2">
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
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {job.totalDuration ? formatDuration(job.totalDuration) : "Not started"}
                          </div>
                          {job.status === 'in_progress' && (
                            <div className="text-xs text-blue-500">Running...</div>
                          )}
                          {job.status === 'paused' && (
                            <div className="text-xs text-yellow-600">Paused</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getStatusBadgeColor(job.status)}>
                            {job.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {/* View button - only visible to admins and super admins */}
                            {(user?.role === 'admin' || user?.role === 'super_admin') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleViewOnlyClick}
                                title="View job details (no timer)"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Pause/Resume Button - Show on all jobs */}
                            {job.status === 'paused' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  resumeJobMutation.mutate(job.id);
                                }}
                                disabled={resumeJobMutation.isPending}
                                className="text-green-600 hover:text-green-800 hover:bg-green-50"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  pauseJobMutation.mutate(job.id);
                                }}
                                disabled={pauseJobMutation.isPending}
                                className="text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50"
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setDeleteJobId(job.id);
                              }}
                              disabled={deleteJobMutation.isPending}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modals */}
      <JobModal open={showJobModal} onOpenChange={setShowJobModal} />
      <JobDetailsModal 
        job={selectedJob}
        open={!!selectedJob}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
            setViewOnlyMode(false);
          }
        }}
        viewOnlyMode={viewOnlyMode}
        onOpenPopup={() => {}}
      />



      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteJobId} onOpenChange={(open) => !open && setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job? This action cannot be undone and will remove all associated materials and progress data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteJobId) {
                  deleteJobMutation.mutate(deleteJobId);
                  setDeleteJobId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
