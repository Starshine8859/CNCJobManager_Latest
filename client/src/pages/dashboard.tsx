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
      case 'waiting': return 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border border-slate-300';
      case 'in_progress': return 'bg-gradient-to-r from-orange-100 to-orange-200 text-emerald-700 border border-emerald-300';
      case 'paused': return 'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700 border border-amber-300';
      case 'done': return 'bg-gradient-to-r from-green-100 to-green-200 text-green-700 border border-green-300';
      default: return 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300';
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Layout currentTime={currentTime}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Dashboard
                </h2>
                <p className="text-slate-600 mt-2 text-lg">Manage your CNC jobs and track progress in real-time</p>
              </div>
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm text-slate-500">Current Time</p>
                  <p className="text-xl font-semibold text-slate-700">
                    {currentTime.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="max-w-md">
            <div className="relative group">
              <Input
                type="text"
                placeholder="Search jobs, customers, or materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 text-lg border-2 border-slate-200 rounded-xl bg-white/90 backdrop-blur-sm shadow-lg focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-300"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-300" />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/90 backdrop-blur-sm border-0 shadow-lg min-w-0">
            <CardContent className="p-6 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Active Jobs</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    {stats?.activeJobs || 0}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-2xl shadow-inner group-hover:shadow-lg transition-all duration-300">
                  <div className="w-8 h-8 text-2xl">📋</div>
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full p-1">
                  <span className="text-xs text-white font-semibold px-2">↗ 12%</span>
                </div>
                <span className="text-xs text-slate-500 ml-2">from last week</span>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/90 backdrop-blur-sm border-0 shadow-lg min-w-0">
            <CardContent className="p-6 flex flex-col h-full min-w-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Sheets Cut</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                    {stats?.sheetsCutToday || 0}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 p-4 rounded-2xl shadow-inner group-hover:shadow-lg transition-all duration-300">
                  <div className="w-8 h-8 text-2xl">✂️</div>
                </div>
              </div>
              <div className="mt-auto flex justify-center">
                <div className="bg-slate-50 rounded-lg p-2 shadow-inner">
                  <DateRangePicker
                    dateRange={sheetsCutDateRange}
                    onDateRangeChange={setSheetsCutDateRange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/90 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium text-slate-600">Avg Time</p>
                    <Select value={avgTimeType} onValueChange={v => setAvgTimeType(v as 'job' | 'sheet')}>
                      <SelectTrigger className="h-8 min-w-[8rem] max-w-[60%] text-xs bg-slate-50 border-slate-200 rounded-lg shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white shadow-xl border-0 rounded-xl">
                        <SelectItem value="job" className="rounded-lg">Average Job Time</SelectItem>
                        <SelectItem value="sheet" className="rounded-lg">Average Sheet Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {avgTimeType === 'job' ? (
                    <p className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
                      {stats?.avgJobTime ? formatDuration(stats.avgJobTime) : "0h 0m"}
                    </p>
                  ) : (
                    <p className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
                      {stats?.avgSheetTime ? formatDuration(stats.avgSheetTime) : "0h 0m"}
                    </p>
                  )}
                </div>
                <div className="bg-gradient-to-br from-amber-100 to-amber-200 p-4 rounded-2xl shadow-inner group-hover:shadow-lg transition-all duration-300">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>
              </div>
              <div className="mt-auto flex justify-center">
                <div className="bg-slate-50 rounded-lg p-2 shadow-inner w-full max-w-full overflow-hidden">
                  <DateRangePicker
                    dateRange={avgTimeDateRange}
                    onDateRangeChange={setAvgTimeDateRange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/90 backdrop-blur-sm border-0 shadow-lg min-w-0">
            <CardContent className="p-6 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Material Colors</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                    {stats?.materialColors || 0}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-100 to-purple-200 p-4 rounded-2xl shadow-inner group-hover:shadow-lg transition-all duration-300">
                  <div className="w-8 h-8 text-2xl">🎨</div>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Available in inventory</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Jobs Table */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-800">Active Jobs</h3>
              <div className="flex items-center space-x-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/jobs'] })}
                  className="hover:bg-white/80 hover:shadow-md transition-all duration-300 rounded-xl"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="hover:bg-white/80 hover:shadow-md transition-all duration-300 rounded-xl"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-200">
                <tr>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Job Details
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-8 py-4 text-left text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-slate-500">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span>Loading jobs...</span>
                      </div>
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
                    <td colSpan={5} className="px-8 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">📋</span>
                        </div>
                        <div>
                          {jobs.length === 0 ? "No jobs found. Create a new job to get started." : "No jobs match your current filter criteria."}
                        </div>
                      </div>
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
                      <tr key={job.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 cursor-pointer transition-all duration-300 group" onClick={handleJobClick}>
                        <td className="px-8 py-6 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors duration-300">{job.jobName}</div>
                            <div className="text-sm text-slate-600 font-medium">{job.customerName}</div>
                            <div className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg inline-block">
                              Created: {new Date(job.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-8 py-6 whitespace-nowrap">
                          <div className="w-full space-y-3">
                            {/* Original Sheets Progress */}
                            <div className="bg-slate-50 p-3 rounded-xl">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-slate-600 font-semibold">Original Sheets</span>
                                <span className="text-xs text-slate-700 font-bold bg-white px-3 py-1 rounded-full shadow-sm">{completedSheets}/{effectiveTotalSheets}</span>
                              </div>
                              <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 shadow-sm" 
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
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
                                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs text-amber-700 font-semibold">Recut Sheets</span>
                                      <span className="text-xs text-amber-800 font-bold bg-amber-100 px-3 py-1 rounded-full shadow-sm">{recutCompleted}/{recutEffectiveTotal}</span>
                                    </div>
                                    <div className="relative h-3 bg-amber-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${recutProgress}%` }}></div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Overall Progress Summary */}
                            <div className="text-xs text-slate-500 pt-2 border-t border-slate-200 flex justify-between">
                              <span className="font-medium">Overall: {progress}%</span>
                              {skippedSheets > 0 && <span className="bg-slate-200 px-2 py-1 rounded-full">({skippedSheets} skipped)</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="text-base font-semibold text-slate-900">
                              {job.totalDuration ? formatDuration(job.totalDuration) : "Not started"}
                            </div>
                            {job.status === 'in_progress' && (
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-emerald-600 font-medium">Running...</span>
                              </div>
                            )}
                            {job.status === 'paused' && (
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                <span className="text-xs text-amber-600 font-medium">Paused</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap">
                          <Badge className={`${getStatusBadgeColor(job.status)} px-3 py-1 text-sm font-medium rounded-lg shadow-sm`}>                            
                            {job.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {/* View button - only visible to admins and super admins */}
                            {(user?.role === 'admin' || user?.role === 'super_admin') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleViewOnlyClick}
                                title="View job details (no timer)"
                                className="hover:bg-blue-100 hover:text-blue-700 transition-all duration-300 rounded-xl p-2"
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
                                className="hover:bg-emerald-100 hover:text-emerald-700 transition-all duration-300 rounded-xl p-2"
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
                                className="hover:bg-amber-100 hover:text-amber-700 transition-all duration-300 rounded-xl p-2"
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
                              className="hover:bg-red-100 hover:text-red-700 transition-all duration-300 rounded-xl p-2"
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
        <AlertDialogContent className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-800">Delete Job</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete this job? This action cannot be undone and will remove all associated materials and progress data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="space-x-3">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteJobId) {
                  deleteJobMutation.mutate(deleteJobId);
                  setDeleteJobId(null);
                }
              }}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl shadow-lg"
            >
              Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}