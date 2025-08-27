"use client"

import type React from "react"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Calendar,
  Users,
  Package,
  Settings,
  Eye,
  Play,
  Plus,
} from "lucide-react"
import Layout from "@/components/layout"
import { apiRequest } from "@/lib/queryClient"
import JobDetailsModal from "@/components/job-details-modal-new"
import type { JobWithMaterials } from "@shared/schema"

interface JobPreparationData {
  id: number
  jobName: string
  customerName: string
  createdAt: string
  status: "waiting" | "in_progress" | "paused" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  preparationProgress: number
  sheetsCount: number
  hardwareCount: number
  rodsCount: number
  assignedTo?: string
  totalDuration?: number
  cutlists?: any[]
}

export default function JobPreparation() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedJob, setSelectedJob] = useState<JobWithMaterials | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showCreateJob, setShowCreateJob] = useState(false)
  const [viewOnlyMode, setViewOnlyMode] = useState(false)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs", searchTerm, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.set("search", searchTerm)
      if (filterStatus !== "all") params.set("status", filterStatus)

      const res = await apiRequest("GET", `/api/jobs?${params}`)
      return res.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  })

  const { data: jobCategoryCounts } = useQuery({
    queryKey: ["/api/jobs/category-counts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/jobs")
      const allJobs = await res.json()

      // Calculate real category counts from job data
      let totalSheets = 0
      let totalHardware = 0
      let totalRods = 0

      for (const job of allJobs) {
        // Fetch job-specific categories
        try {
          const [sheetsRes, hardwareRes, rodsRes] = await Promise.all([
            apiRequest("GET", `/api/jobs/${job.id}/sheets`),
            apiRequest("GET", `/api/jobs/${job.id}/hardware`),
            apiRequest("GET", `/api/jobs/${job.id}/rods`),
          ])

          const sheets = await sheetsRes.json()
          const hardware = await hardwareRes.json()
          const rods = await rodsRes.json()

          totalSheets += sheets.length
          totalHardware += hardware.length
          totalRods += rods.length
        } catch (error) {
          console.error(`Error fetching categories for job ${job.id}:`, error)
        }
      }

      return { totalSheets, totalHardware, totalRods }
    },
    refetchInterval: 60000, // Refresh every minute
  })

  const calculatePreparationProgress = (job: JobPreparationData): number => {
    if (!job.cutlists || job.cutlists.length === 0) return 0

    let totalSheets = 0
    let completedSheets = 0
    let skippedSheets = 0

    job.cutlists.forEach((cutlist) => {
      cutlist.materials?.forEach((material: any) => {
        const sheetStatuses = material.sheetStatuses || []
        const cutCount = sheetStatuses.filter((status: string) => status === "cut").length
        const skipCount = sheetStatuses.filter((status: string) => status === "skip").length

        totalSheets += material.totalSheets
        completedSheets += cutCount
        skippedSheets += skipCount

        // Include recut sheets in progress calculation
        material.recutEntries?.forEach((recut: any) => {
          const recutStatuses = recut.sheetStatuses || []
          const recutCutCount = recutStatuses.filter((status: string) => status === "cut").length
          const recutSkipCount = recutStatuses.filter((status: string) => status === "skip").length

          totalSheets += recut.quantity
          completedSheets += recutCutCount
          skippedSheets += recutSkipCount
        })
      })
    })

    const effectiveTotalSheets = totalSheets - skippedSheets
    return effectiveTotalSheets > 0 ? Math.round((completedSheets / effectiveTotalSheets) * 100) : 0
  }

  const processedJobs: JobPreparationData[] = jobs.map((job: any) => ({
    id: job.id,
    jobName: job.jobName,
    customerName: job.customerName,
    createdAt: job.createdAt,
    status: job.status,
    priority: job.priority || "medium",
    preparationProgress: calculatePreparationProgress(job),
    sheetsCount:
      job.cutlists?.reduce(
        (total: number, cutlist: any) =>
          total +
          (cutlist.materials?.reduce((matTotal: number, mat: any) => matTotal + (mat.totalSheets || 0), 0) || 0),
        0,
      ) || 0,
    hardwareCount: 0, // Will be populated from job-specific hardware API
    rodsCount: 0, // Will be populated from job-specific rods API
    assignedTo: job.assignedTo || "Unassigned",
    totalDuration: job.totalDuration,
    cutlists: job.cutlists,
  }))

  const filteredJobs = processedJobs.filter((job) => {
    const matchesSearch =
      job.jobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === "all" || job.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const totalJobs = processedJobs.length
  const completedJobs = processedJobs.filter((job) => job.status === "done").length
  const inProgressJobs = processedJobs.filter((job) => job.status === "in_progress").length
  const overdueJobs = processedJobs.filter((job) => {
    // Consider jobs overdue if they've been in progress for more than expected time
    return job.status === "in_progress" && job.preparationProgress < 50
  }).length

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done":
        return "bg-green-100 text-green-800 border-green-200"
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "waiting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "paused":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return "bg-green-500"
    if (progress >= 70) return "bg-blue-500"
    if (progress >= 40) return "bg-yellow-500"
    return "bg-red-500"
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Not started"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const handleViewJob = (job: any, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent card click
    setSelectedJob(job)
    setViewOnlyMode(true)
  }

  const handleManageJob = (job: any, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent card click
    setSelectedJob(job)
    setViewOnlyMode(false)
  }

  const handleCreateJob = () => {
    // Navigate to job creation or open job creation modal
    window.location.href = "/dashboard" // Assuming dashboard has job creation
  }

  const handleShowAnalytics = () => {
    setShowAnalytics(true)
  }

  const handleShowFilters = () => {
    setShowFilters(true)
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="border-b border-border pb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Job Preparation Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Monitor job statuses, track preparation progress, and manage CNC manufacturing workflows
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Jobs</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalJobs}</div>
              <p className="text-xs text-muted-foreground">Active manufacturing jobs</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
              <Play className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{inProgressJobs}</div>
              <p className="text-xs text-muted-foreground">Currently being prepared</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{completedJobs}</div>
              <p className="text-xs text-muted-foreground">Ready for production</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Need Attention</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{overdueJobs}</div>
              <p className="text-xs text-muted-foreground">Low progress jobs</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search jobs or customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="all">All Status</option>
              <option value="waiting">Waiting</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Completed</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="border-border bg-transparent" onClick={handleShowFilters}>
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
            <Button variant="outline" size="sm" className="border-border bg-transparent" onClick={handleShowAnalytics}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-muted-foreground">Loading jobs...</span>
              </div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <Card className="col-span-full border-border">
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No jobs found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || filterStatus !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "No jobs are currently in the system"}
                </p>
                <Button className="bg-primary text-primary-foreground" onClick={handleCreateJob}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="border-border hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedJob(jobs.find((j: any) => j.id === job.id) || null)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold text-foreground">{job.jobName}</CardTitle>
                      <CardDescription className="text-muted-foreground">{job.customerName}</CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getPriorityColor(job.priority)}`} />
                      <Badge className={`${getStatusColor(job.status)} text-xs`}>{job.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Preparation Progress</span>
                      <span className="text-sm text-muted-foreground">{job.preparationProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(job.preparationProgress)}`}
                        style={{ width: `${job.preparationProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold text-foreground">{job.sheetsCount}</div>
                      <div className="text-xs text-muted-foreground">Sheets</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold text-foreground">{job.hardwareCount}</div>
                      <div className="text-xs text-muted-foreground">Hardware</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold text-foreground">{job.rodsCount}</div>
                      <div className="text-xs text-muted-foreground">Rods</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        Created: {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <Users className="h-4 w-4 mr-1" />
                        {job.assignedTo}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDuration(job.totalDuration)}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border bg-transparent"
                          onClick={(e) =>
                            handleViewJob(
                              jobs.find((j: any) => j.id === job.id),
                              e,
                            )
                          }
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground"
                          onClick={(e) =>
                            handleManageJob(
                              jobs.find((j: any) => j.id === job.id),
                              e,
                            )
                          }
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Manage
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <JobDetailsModal
        job={selectedJob}
        open={!!selectedJob}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null)
            setViewOnlyMode(false)
          }
        }}
        viewOnlyMode={viewOnlyMode}
        onOpenPopup={() => {}}
      />

      {showAnalytics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-foreground">Job Analytics</h2>
              <Button variant="outline" onClick={() => setShowAnalytics(false)}>
                ✕
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Average Completion Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {formatDuration(
                      processedJobs
                        .filter((j) => j.status === "done")
                        .reduce((acc, job) => acc + (job.totalDuration || 0), 0) / Math.max(completedJobs, 1),
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0}%
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Total Materials</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {(jobCategoryCounts?.totalSheets || 0) +
                      (jobCategoryCounts?.totalHardware || 0) +
                      (jobCategoryCounts?.totalRods || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Advanced Filters</h2>
              <Button variant="outline" onClick={() => setShowFilters(false)}>
                ✕
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Priority</label>
                <select className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground">
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Progress Range</label>
                <div className="flex space-x-2">
                  <Input placeholder="Min %" className="bg-background border-border" />
                  <Input placeholder="Max %" className="bg-background border-border" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date Range</label>
                <div className="flex space-x-2">
                  <Input type="date" className="bg-background border-border" />
                  <Input type="date" className="bg-background border-border" />
                </div>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button className="flex-1 bg-primary text-primary-foreground">Apply Filters</Button>
                <Button variant="outline" className="flex-1 border-border bg-transparent">
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
