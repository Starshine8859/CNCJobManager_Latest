"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { Trash2, Palette, Maximize2, Plus, Upload, FileText } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { useWebSocket } from "@/hooks/use-websocket"
import type { JobWithMaterials, ColorWithGroup, JobSheet, JobHardware, JobRod } from "@shared/schema"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface JobDetailsModalProps {
  job: JobWithMaterials | null
  open: boolean
  onOpenChange: (open: boolean) => void
  viewOnlyMode?: boolean
  onOpenPopup?: (jobId: number) => void
}

interface RecutHistorySectionProps {
  materialId: number
}

function RecutHistorySection({ materialId }: RecutHistorySectionProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: recutEntries = [], isLoading } = useQuery({
    queryKey: [`/api/materials/${materialId}/recuts`],
    enabled: !!materialId,
  })

  // Type-safe access to recut entries
  const entries = Array.isArray(recutEntries) ? recutEntries : []

  // Loading states for individual recut sheet buttons - separate for cut and skip
  const [loadingRecutCutButtons, setLoadingRecutCutButtons] = useState<Record<string, Set<number>>>({})
  const [loadingRecutSkipButtons, setLoadingRecutSkipButtons] = useState<Record<string, Set<number>>>({})

  const updateRecutSheetStatusMutation = useMutation({
    mutationFn: ({
      recutId,
      sheetIndex,
      status,
      actionType,
    }: {
      recutId: number
      sheetIndex: number
      status: string
      actionType: "cut" | "skip"
    }) => apiRequest("PUT", `/api/recuts/${recutId}/sheet-status`, { sheetIndex, status }),
    onMutate: ({ recutId, sheetIndex, status, actionType }) => {
      // Set loading state based on which button was clicked
      if (actionType === "cut") {
        setLoadingRecutCutButtons((prev) => ({
          ...prev,
          [recutId]: new Set([...Array.from(prev[recutId] || []), sheetIndex]),
        }))
      } else if (actionType === "skip") {
        setLoadingRecutSkipButtons((prev) => ({
          ...prev,
          [recutId]: new Set([...Array.from(prev[recutId] || []), sheetIndex]),
        }))
      }
    },
    onSuccess: (_, variables) => {
      // Clear loading state based on which button was clicked
      if (variables.actionType === "cut") {
        setLoadingRecutCutButtons((prev) => ({
          ...prev,
          [variables.recutId]: new Set(
            Array.from(prev[variables.recutId] || []).filter((i) => i !== variables.sheetIndex),
          ),
        }))
      } else if (variables.actionType === "skip") {
        setLoadingRecutSkipButtons((prev) => ({
          ...prev,
          [variables.recutId]: new Set(
            Array.from(prev[variables.recutId] || []).filter((i) => i !== variables.sheetIndex),
          ),
        }))
      }

      queryClient.invalidateQueries({ queryKey: [`/api/materials/${materialId}/recuts`] })
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
    },
    onError: (error, variables) => {
      // Clear loading state based on which button was clicked
      if (variables.actionType === "cut") {
        setLoadingRecutCutButtons((prev) => ({
          ...prev,
          [variables.recutId]: new Set(
            Array.from(prev[variables.recutId] || []).filter((i) => i !== variables.sheetIndex),
          ),
        }))
      } else if (variables.actionType === "skip") {
        setLoadingRecutSkipButtons((prev) => ({
          ...prev,
          [variables.recutId]: new Set(
            Array.from(prev[variables.recutId] || []).filter((i) => i !== variables.sheetIndex),
          ),
        }))
      }

      toast({ title: "Error", description: "Failed to update recut sheet status" })
    },
  })

  const deleteRecutMutation = useMutation({
    mutationFn: (recutId: number) => apiRequest("DELETE", `/api/recuts/${recutId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/materials/${materialId}/recuts`] })
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] })
      toast({ title: "Success", description: "Recut entry deleted successfully" })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete recut entry" })
    },
  })

  const handleRecutSheetCut = (recutId: number, sheetIndex: number, currentStatus: string) => {
    // Toggle: if already cut, set to pending; otherwise set to cut
    const newStatus = currentStatus === "cut" ? "pending" : "cut"
    updateRecutSheetStatusMutation.mutate({
      recutId,
      sheetIndex,
      status: newStatus,
      actionType: "cut",
    })
  }

  const handleRecutSheetSkip = (recutId: number, sheetIndex: number, currentStatus: string) => {
    // Toggle: if already skipped, set to pending; otherwise set to pending
    const newStatus = currentStatus === "skip" ? "pending" : "skip"
    updateRecutSheetStatusMutation.mutate({
      recutId,
      sheetIndex,
      status: newStatus,
      actionType: "skip",
    })
  }

  if (isLoading) {
    return (
      <div className="mt-4 p-3 bg-orange-50 rounded-lg">
        <h4 className="font-medium mb-2 text-orange-800">Recut Tracking</h4>
        <div className="text-sm text-orange-600">Loading recut history...</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="mt-4 p-3 bg-orange-50 rounded-lg">
        <h4 className="font-medium mb-2 text-orange-800">Recut Tracking</h4>
        <div className="text-sm text-orange-600">No recut entries found</div>
      </div>
    )
  }

  return (
    <div className="mt-4 p-3 bg-orange-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-orange-800">Recut History</h4>
        {/* Button to add recut */}
      </div>

      {entries && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((recut, index) => {
            const recutStatuses = recut.sheetStatuses || []
            const completedCount = recutStatuses.filter((status) => status === "cut").length
            const skippedCount = recutStatuses.filter((status) => status === "skip").length
            const effectiveTotal = recut.quantity - skippedCount
            const progressPercentage = effectiveTotal > 0 ? Math.round((completedCount / effectiveTotal) * 100) : 0

            return (
              <div key={recut.id} className="border border-orange-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-orange-800">Recut #{index + 1}</span>
                    {recut.reason && (
                      <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">{recut.reason}</span>
                    )}
                  </div>
                  <div className="text-xs text-orange-600">
                    {completedCount}/{effectiveTotal} sheets ({progressPercentage}%)
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1 mt-2">
                  {Array.from({ length: recut.quantity }, (_, i) => {
                    const status = recutStatuses[i] || "pending"
                    const isCutLoading = loadingRecutCutButtons[recut.id]?.has(i) || false
                    const isSkipLoading = loadingRecutSkipButtons[recut.id]?.has(i) || false

                    return (
                      <div key={`recut-${recut.id}-sheet-${i}`} className="flex flex-col items-center gap-1">
                        <div className="text-xs font-medium text-orange-700">R{i + 1}</div>

                        <div className="flex gap-0.5">
                          <button
                            onClick={() => handleRecutSheetCut(recut.id, i)}
                            disabled={isCutLoading}
                            className={`px-1 py-0.5 rounded text-xs font-medium transition-all duration-150 flex items-center gap-0.5 ${
                              status === "cut"
                                ? "bg-green-600 text-white"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            } ${isCutLoading ? "opacity-75" : ""}`}
                          >
                            {isCutLoading ? (
                              <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : null}
                            ✓
                          </button>
                          <button
                            onClick={() => handleRecutSheetSkip(recut.id, i)}
                            disabled={isSkipLoading}
                            className={`px-1 py-0.5 rounded text-xs font-medium transition-all duration-150 flex items-center gap-0.5 ${
                              status === "skip" ? "bg-red-600 text-white" : "bg-red-100 text-red-700 hover:bg-red-200"
                            } ${isSkipLoading ? "opacity-75" : ""}`}
                          >
                            {isSkipLoading ? (
                              <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : null}
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-orange-600 text-sm">No recuts yet</div>
      )}
    </div>
  )
}

export default function JobDetailsModal({
  job,
  open,
  onOpenChange,
  viewOnlyMode = false,
  onOpenPopup,
}: JobDetailsModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState("materials")

  // Live timer state
  const [liveTimerSeconds, setLiveTimerSeconds] = useState<number>(0)
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null)

  // Optimistic state for immediate UI updates
  const [optimisticSheetStatuses, setOptimisticSheetStatuses] = useState<Record<string, Record<number, string>>>({})

  // Loading states for individual sheet buttons - separate for cut and skip
  const [loadingCutButtons, setLoadingCutButtons] = useState<Record<string, Set<number>>>({})
  const [loadingSkipButtons, setLoadingSkipButtons] = useState<Record<string, Set<number>>>({})

  const [jobSheets, setJobSheets] = useState<JobSheet[]>([])
  const [jobHardware, setJobHardware] = useState<JobHardware[]>([])
  const [jobRods, setJobRods] = useState<JobRod[]>([])

  const [newSheetMaterial, setNewSheetMaterial] = useState("")
  const [newSheetQty, setNewSheetQty] = useState("")
  const [newHardwareName, setNewHardwareName] = useState("")
  const [newHardwareQty, setNewHardwareQty] = useState("")
  const [newHardwareOnHand, setNewHardwareOnHand] = useState("")
  const [newHardwareNeeded, setNewHardwareNeeded] = useState("")
  const [newHardwareUsed, setNewHardwareUsed] = useState("")
  const [newHardwareStillRequired, setNewHardwareStillRequired] = useState("")
  const [newRodName, setNewRodName] = useState("")
  const [newRodLength, setNewRodLength] = useState("")

  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importCategory, setImportCategory] = useState<"sheets" | "hardware" | "rods">("sheets")
  const [isUploading, setIsUploading] = useState(false)

  // WebSocket for real-time updates
  const handleWebSocketMessage = (message: MessageEvent) => {
    if (!open || !job) return

    try {
      const data = JSON.parse(message.data)
      const { type } = data

      // Handle real-time updates for this specific job
      if (type === "job_timer_started" && data?.jobId === job.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] })
      }

      if (type === "job_timer_stopped" && data?.jobId === job.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] })
      }

      if (type === "sheet_status_updated" || type === "recut_sheet_status_updated") {
        // Refresh job data and recut entries
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] })
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })

        // Refresh recut data for affected materials
        if (job.cutlists) {
          job.cutlists.forEach((cutlist) => {
            cutlist.materials?.forEach((material) => {
              queryClient.invalidateQueries({ queryKey: [`/api/materials/${material.id}/recuts`] })
            })
          })
        }
      }

      if (type === "recut_added" || type === "material_updated") {
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] })
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error)
    }
  }

  useWebSocket("/ws", handleWebSocketMessage)

  // Fetch colors for adding materials
  const { data: colors = [] } = useQuery<ColorWithGroup[]>({
    queryKey: ["/api/colors"],
  })

  const { data: fetchedJobSheets = [] } = useQuery<JobSheet[]>({
    queryKey: [`/api/jobs/${job?.id}/sheets`],
    enabled: !!job?.id && open,
  })

  const { data: fetchedJobHardware = [] } = useQuery<JobHardware[]>({
    queryKey: [`/api/jobs/${job?.id}/hardware`],
    enabled: !!job?.id && open,
  })

  const { data: fetchedJobRods = [] } = useQuery<JobRod[]>({
    queryKey: [`/api/jobs/${job?.id}/rods`],
    enabled: !!job?.id && open,
  })

  const addJobSheetMutation = useMutation({
    mutationFn: ({ jobId, materialType, qty }: { jobId: number; materialType: string; qty: number }) =>
      apiRequest("POST", `/api/jobs/${jobId}/sheets`, { materialType, qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job?.id}/sheets`] })
      setNewSheetMaterial("")
      setNewSheetQty("")
      toast({ title: "Success", description: "Sheet added successfully" })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add sheet" })
    },
  })

  const addJobHardwareMutation = useMutation({
    mutationFn: ({
      jobId,
      hardwareName,
      qty,
      onHandQty,
      needed,
      used,
      stillRequired,
    }: {
      jobId: number
      hardwareName: string
      qty: number
      onHandQty: number
      needed: number
      used: number
      stillRequired: number
    }) =>
      apiRequest("POST", `/api/jobs/${jobId}/hardware`, { hardwareName, qty, onHandQty, needed, used, stillRequired }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job?.id}/hardware`] })
      setNewHardwareName("")
      setNewHardwareQty("")
      setNewHardwareOnHand("")
      setNewHardwareNeeded("")
      setNewHardwareUsed("")
      setNewHardwareStillRequired("")
      toast({ title: "Success", description: "Hardware added successfully" })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add hardware" })
    },
  })

  const addJobRodMutation = useMutation({
    mutationFn: ({ jobId, rodName, lengthInches }: { jobId: number; rodName: string; lengthInches: string }) =>
      apiRequest("POST", `/api/jobs/${jobId}/rods`, { rodName, lengthInches }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job?.id}/rods`] })
      setNewRodName("")
      setNewRodLength("")
      toast({ title: "Success", description: "Rod added successfully" })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add rod" })
    },
  })

  const importFileMutation = useMutation({
    mutationFn: ({ jobId, file, category }: { jobId: number; file: File; category: string }) => {
      const formData = new FormData()
      formData.append("importFile", file)
      formData.append("category", category)

      return fetch(`/api/jobs/${jobId}/import`, {
        method: "POST",
        body: formData,
      }).then((res) => res.json())
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job?.id}/sheets`] })
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job?.id}/hardware`] })
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job?.id}/rods`] })
      setShowImportDialog(false)
      setIsUploading(false)
      toast({
        title: "Import Complete",
        description: `Imported ${data.imported} items${data.errors.length > 0 ? ` with ${data.errors.length} errors` : ""}`,
      })
    },
    onError: () => {
      setIsUploading(false)
      toast({ title: "Error", description: "Failed to import file" })
    },
  })

  useEffect(() => {
    setJobSheets(fetchedJobSheets)
  }, [fetchedJobSheets])

  useEffect(() => {
    setJobHardware(fetchedJobHardware)
  }, [fetchedJobHardware])

  useEffect(() => {
    setJobRods(fetchedJobRods)
  }, [fetchedJobRods])

  // Group colors by group for the add material dialog
  const groupedColors = colors.reduce(
    (acc, color) => {
      const groupName = color.group?.name || "Ungrouped"
      if (!acc[groupName]) acc[groupName] = []
      acc[groupName].push(color)
      return acc
    },
    {} as Record<string, ColorWithGroup[]>,
  )

  // State for adding new sheets
  const [newSheetsCount, setNewSheetsCount] = useState<string>("")

  // State for recut entry
  const [recutDialog, setRecutDialog] = useState<{ open: boolean; materialId: number | null }>({
    open: false,
    materialId: null,
  })
  const [recutQuantity, setRecutQuantity] = useState<string>("1")
  const [recutReason, setRecutReason] = useState<string>("")

  // State for adding new materials (colors)
  const [addMaterialDialog, setAddMaterialDialog] = useState<boolean>(false)
  const [newMaterialColorId, setNewMaterialColorId] = useState<string>("0")
  const [newMaterialSheets, setNewMaterialSheets] = useState<string>("1")

  // Force re-render counter
  const [updateCounter, setUpdateCounter] = useState(0)

  // Automatic timer management
  const startTimerMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest("POST", `/api/jobs/${jobId}/start-timer`),
    onError: () => {
      console.error("Failed to start job timer")
    },
  })

  const stopTimerMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest("POST", `/api/jobs/${jobId}/stop-timer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] })
    },
    onError: () => {
      console.error("Failed to stop job timer")
    },
  })

  // Auto-refresh job data every 5 seconds when modal is open
  useEffect(() => {
    if (!open || !job?.id) return

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] })
    }, 5000)

    return () => clearInterval(interval)
  }, [open, job?.id, queryClient])

  // Live timer updates every second
  useEffect(() => {
    if (!open || !timerStartTime) return

    const interval = setInterval(() => {
      const now = new Date()
      const elapsedSeconds = Math.floor((now.getTime() - timerStartTime.getTime()) / 1000)
      setLiveTimerSeconds(elapsedSeconds)
    }, 1000)

    return () => clearInterval(interval)
  }, [open, timerStartTime])

  // Start/stop timer when modal opens/closes (only if NOT in view-only mode)
  useEffect(() => {
    if (open && job?.id && !viewOnlyMode) {
      const startTime = new Date()
      setTimerStartTime(startTime)
      setLiveTimerSeconds(0)
      startTimerMutation.mutate(job.id)
    }

    // Stop timer when modal closes (only if timer was started)
    return () => {
      if (job?.id && !viewOnlyMode) {
        stopTimerMutation.mutate(job.id)
        setTimerStartTime(null)
        setLiveTimerSeconds(0)
      }
    }
  }, [open, job?.id, viewOnlyMode])

  // Clear state when modal closes
  useEffect(() => {
    if (!open) {
      setNewSheetsCount("")
    }
  }, [open])

  const updateSheetStatusMutation = useMutation({
    mutationFn: ({ materialId, sheetIndex, status }: { materialId: number; sheetIndex: number; status: string }) =>
      apiRequest("PUT", `/api/materials/${materialId}/sheet-status`, { sheetIndex, status }),
    onMutate: ({ materialId, sheetIndex, status }) => {
      // Set loading state based on action type
      if (status === "cut") {
        setLoadingCutButtons((prev) => ({
          ...prev,
          [materialId]: new Set([...Array.from(prev[materialId] || []), sheetIndex]),
        }))
      } else if (status === "skip") {
        setLoadingSkipButtons((prev) => ({
          ...prev,
          [materialId]: new Set([...Array.from(prev[materialId] || []), sheetIndex]),
        }))
      }

      // Immediately update the UI optimistically
      setOptimisticSheetStatuses((prev) => ({
        ...prev,
        [materialId]: {
          ...prev[materialId],
          [sheetIndex]: status,
        },
      }))

      // Return context for rollback if needed
      return {
        materialId,
        sheetIndex,
        previousStatus: optimisticSheetStatuses[materialId]?.[sheetIndex],
        action: status,
      }
    },
    onSuccess: (_, variables) => {
      // Clear loading state based on action type
      if (variables.status === "cut") {
        setLoadingCutButtons((prev) => ({
          ...prev,
          [variables.materialId]: new Set(
            Array.from(prev[variables.materialId] || []).filter((i) => i !== variables.sheetIndex),
          ),
        }))
      } else if (variables.status === "skip") {
        setLoadingSkipButtons((prev) => ({
          ...prev,
          [variables.materialId]: new Set(
            Array.from(prev[variables.materialId] || []).filter((i) => i !== variables.sheetIndex),
          ),
        }))
      }

      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] })
    },
    onError: (error, variables, context) => {
      // Clear loading state based on action type
      if (variables.status === "cut") {
        setLoadingCutButtons((prev) => ({
          ...prev,
          [variables.materialId]: new Set(
            Array.from(prev[variables.materialId] || []).filter((i) => i !== variables.sheetIndex),
          ),
        }))
      } else if (variables.status === "skip") {
        setLoadingSkipButtons((prev) => ({
          ...prev,
          [variables.materialId]: new Set(
            Array.from(prev[variables.materialId] || []).filter((i) => i !== variables.sheetIndex),
          ),
        }))
      }

      // Rollback optimistic update on error
      if (context) {
        setOptimisticSheetStatuses((prev) => ({
          ...prev,
          [context.materialId]: {
            ...prev[context.materialId],
            [context.sheetIndex]: context.previousStatus || "pending",
          },
        }))
      }

      toast({ title: "Error", description: "Failed to update sheet status" })
    },
  })

  const addSheetsMutation = useMutation({
    mutationFn: ({
      materialId,
      additionalSheets,
      isRecut,
    }: { materialId: number; additionalSheets: number; isRecut?: boolean }) =>
      apiRequest("POST", `/api/materials/${materialId}/add-sheets`, { additionalSheets, isRecut }),
    onSuccess: async () => {
      // Force immediate refetch with aggressive cache busting
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      await queryClient.refetchQueries({ queryKey: ["/api/jobs"] })

      // Force component re-render
      setUpdateCounter((prev) => prev + 1)

      setNewSheetsCount("")
      toast({ title: "Success", description: "Sheets added successfully" })
    },
    onError: (error) => {
      console.error("Add sheets error:", error)
      toast({ title: "Error", description: "Failed to add additional sheets" })
    },
  })

  const deleteSheetMutation = useMutation({
    mutationFn: ({ materialId, sheetIndex }: { materialId: number; sheetIndex: number }) =>
      apiRequest("DELETE", `/api/materials/${materialId}/sheet/${sheetIndex}`),
    onSuccess: async () => {
      console.log("Delete successful, refreshing data...")

      // Force immediate refetch with aggressive cache busting
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      await queryClient.refetchQueries({ queryKey: ["/api/jobs"] })

      // Force component re-render
      setUpdateCounter((prev) => prev + 1)

      console.log("Data refresh complete")
      toast({ title: "Success", description: "Sheet deleted and sequence updated" })
    },
    onError: (error) => {
      console.error("Delete sheet error:", error)
      toast({ title: "Error", description: "Failed to delete sheet" })
    },
  })

  const deleteCutlistMutation = useMutation({
    mutationFn: (cutlistId: number) => apiRequest("DELETE", `/api/cutlists/${cutlistId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      toast({ title: "Success", description: "Cutlist deleted successfully" })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete cutlist" })
    },
  })

  const addRecutMutation = useMutation({
    mutationFn: ({ materialId, quantity, reason }: { materialId: number; quantity: number; reason?: string }) =>
      apiRequest("POST", `/api/materials/${materialId}/recuts`, { quantity, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      queryClient.invalidateQueries({ queryKey: [`/api/materials/${recutDialog.materialId}/recuts`] })
      setRecutDialog({ open: false, materialId: null })
      setRecutQuantity("1")
      setRecutReason("")
      toast({ title: "Success", description: "Recut entry added successfully" })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add recut entry" })
    },
  })

  const addMaterialMutation = useMutation({
    mutationFn: ({ jobId, colorId, totalSheets }: { jobId: number; colorId: number; totalSheets: number }) =>
      apiRequest("POST", `/api/jobs/${jobId}/materials`, { colorId, totalSheets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] })
      setAddMaterialDialog(false)
      setNewMaterialColorId("0")
      setNewMaterialSheets("1")
      toast({ title: "Success", description: "Material added to job successfully" })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add material to job" })
    },
  })

  const deleteMaterialMutation = useMutation({
    mutationFn: (materialId: number) => apiRequest("DELETE", `/api/materials/${materialId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] })
      toast({ title: "Success", description: "Material deleted successfully" })
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete material" })
    },
  })

  // Calculate totals across all cutlists including recuts
  const [totalSheets, completedSheets, skippedSheets] = useMemo(() => {
    if (!job) return [0, 0, 0]

    let total = 0
    let completed = 0
    let skipped = 0

    job.cutlists?.forEach((cutlist) => {
      cutlist.materials?.forEach((m) => {
        const sheetStatuses = m.sheetStatuses || []

        // Count cut and skipped sheets for original materials
        const cutCount = sheetStatuses.filter((status) => status === "cut").length
        const skipCount = sheetStatuses.filter((status) => status === "skip").length

        total += m.totalSheets
        completed += cutCount
        skipped += skipCount

        // Add recut sheets to the total calculation
        m.recutEntries?.forEach((recut) => {
          const recutStatuses = recut.sheetStatuses || []
          const recutCutCount = recutStatuses.filter((status) => status === "cut").length
          const recutSkipCount = recutStatuses.filter((status) => status === "skip").length

          total += recut.quantity
          completed += recutCutCount
          skipped += recutSkipCount
        })
      })
    })

    return [total, completed, skipped]
  }, [job, job?.cutlists])

  // Progress calculation including recuts
  const effectiveTotalSheets = totalSheets - skippedSheets
  const progress = effectiveTotalSheets > 0 ? Math.round((completedSheets / effectiveTotalSheets) * 100) : 0

  if (!job) return null

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-gray-100 text-gray-600"
      case "in_progress":
        return "bg-orange-100 text-orange-600"
      case "paused":
        return "bg-yellow-100 text-yellow-600"
      case "done":
        return "bg-green-100 text-green-600"
      default:
        return "bg-gray-100 text-gray-600"
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  // Calculate total duration including live timer
  const currentDuration = () => {
    const baseDuration = job?.totalDuration || 0
    return baseDuration + liveTimerSeconds
  }

  // Handle sheet cut - with optimistic updates
  const handleSheetCut = (materialId: number, sheetIndex: number) => {
    // Find material across all cutlists
    let material = null
    if (job?.cutlists) {
      for (const cutlist of job.cutlists) {
        material = cutlist.materials?.find((m) => m.id === materialId)
        if (material) break
      }
    }
    if (!material) return

    // Get the current status (optimistic or server)
    const optimisticStatus = optimisticSheetStatuses[materialId]?.[sheetIndex]
    const serverStatuses = material.sheetStatuses || []
    const serverStatus = serverStatuses[sheetIndex] || "pending"
    const currentStatus = optimisticStatus !== undefined ? optimisticStatus : serverStatus

    const newStatus = currentStatus === "cut" ? "pending" : "cut"
    updateSheetStatusMutation.mutate({ materialId, sheetIndex, status: newStatus })
  }

  // Handle sheet skip - with optimistic updates
  const handleSheetSkip = (materialId: number, sheetIndex: number) => {
    // Find material across all cutlists
    let material = null
    if (job?.cutlists) {
      for (const cutlist of job.cutlists) {
        material = cutlist.materials?.find((m) => m.id === materialId)
        if (material) break
      }
    }
    if (!material) return

    // Get the current status (optimistic or server)
    const optimisticStatus = optimisticSheetStatuses[materialId]?.[sheetIndex]
    const serverStatuses = material.sheetStatuses || []
    const serverStatus = serverStatuses[sheetIndex] || "pending"
    const currentStatus = optimisticStatus !== undefined ? optimisticStatus : serverStatus

    const newStatus = currentStatus === "skip" ? "pending" : "skip"
    updateSheetStatusMutation.mutate({ materialId, sheetIndex, status: newStatus })
  }

  const handleAddSheets = (materialId: number) => {
    const count = Number.parseInt(newSheetsCount)
    if (!count || count < 1) {
      toast({ title: "Error", description: "Please enter a valid number of sheets" })
      return
    }
    addSheetsMutation.mutate({ materialId, additionalSheets: count })
  }

  const handleAddRecut = (materialId: number) => {
    setRecutDialog({ open: true, materialId })
  }

  const handleConfirmRecut = () => {
    const quantity = Number.parseInt(recutQuantity)
    if (!quantity || quantity < 1) {
      toast({ title: "Error", description: "Please enter a valid quantity" })
      return
    }
    if (recutDialog.materialId) {
      addRecutMutation.mutate({
        materialId: recutDialog.materialId,
        quantity,
        reason: recutReason.trim() || undefined,
      })
    }
  }

  const handleDeleteCutlist = (cutlistId: number) => {
    if (confirm("Are you sure you want to delete this cutlist? This will also delete all materials in it.")) {
      deleteCutlistMutation.mutate(cutlistId)
    }
  }

  const handleAddMaterial = () => {
    const colorId = Number.parseInt(newMaterialColorId)
    const totalSheets = Number.parseInt(newMaterialSheets)

    if (!colorId || colorId === 0) {
      toast({ title: "Error", description: "Please select a color" })
      return
    }

    if (!totalSheets || totalSheets < 1) {
      toast({ title: "Error", description: "Please enter a valid number of sheets" })
      return
    }

    if (job?.id) {
      addMaterialMutation.mutate({ jobId: job.id, colorId, totalSheets })
    }
  }

  const handleAddSheet = () => {
    if (!newSheetMaterial.trim() || !newSheetQty || Number.parseInt(newSheetQty) < 1) {
      toast({ title: "Error", description: "Please enter valid material type and quantity" })
      return
    }
    if (job?.id) {
      addJobSheetMutation.mutate({
        jobId: job.id,
        materialType: newSheetMaterial.trim(),
        qty: Number.parseInt(newSheetQty),
      })
    }
  }

  const handleAddHardware = () => {
    if (!newHardwareName.trim()) {
      toast({ title: "Error", description: "Please enter hardware name" })
      return
    }
    if (job?.id) {
      addJobHardwareMutation.mutate({
        jobId: job.id,
        hardwareName: newHardwareName.trim(),
        qty: Number.parseInt(newHardwareQty) || 0,
        onHandQty: Number.parseInt(newHardwareOnHand) || 0,
        needed: Number.parseInt(newHardwareNeeded) || 0,
        used: Number.parseInt(newHardwareUsed) || 0,
        stillRequired: Number.parseInt(newHardwareStillRequired) || 0,
      })
    }
  }

  const handleAddRod = () => {
    if (!newRodName.trim() || !newRodLength.trim()) {
      toast({ title: "Error", description: "Please enter rod name and length" })
      return
    }
    if (job?.id) {
      addJobRodMutation.mutate({
        jobId: job.id,
        rodName: newRodName.trim(),
        lengthInches: newRodLength.trim(),
      })
    }
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && job?.id) {
      setIsUploading(true)
      importFileMutation.mutate({ jobId: job.id, file, category: importCategory })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              {job?.jobNumber} - {job?.customerName}
              {viewOnlyMode && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  View Only
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportDialog(true)}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                <Upload className="w-4 h-4 mr-1" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (job?.id) {
                    const popupUrl = `${window.location.origin}/popup/${job.id}`
                    const popup = window.open(
                      popupUrl,
                      `job-popup-${job.id}`,
                      "width=500,height=600,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no,top=100,left=100",
                    )

                    if (popup) {
                      popup.focus()
                    }
                  }
                }}
              >
                <Maximize2 className="w-4 h-4 mr-1" />
                Pop Out
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="sheets">Sheets</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="rods">Rods</TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="space-y-4">
            {/* Existing materials content */}
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
              {/* Existing cutlist materials rendering */}
            </div>
          </TabsContent>

          <TabsContent value="sheets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-700">Job Sheets</CardTitle>
                <CardDescription>Material types and quantities needed for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div>
                    <Label htmlFor="sheet-material">Material Type</Label>
                    <Input
                      id="sheet-material"
                      value={newSheetMaterial}
                      onChange={(e) => setNewSheetMaterial(e.target.value)}
                      placeholder="e.g., Plywood, MDF, Melamine"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sheet-qty">Quantity</Label>
                    <Input
                      id="sheet-qty"
                      type="number"
                      value={newSheetQty}
                      onChange={(e) => setNewSheetQty(e.target.value)}
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Button onClick={handleAddSheet} className="w-full bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Sheet
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {fetchedJobSheets.map((sheet) => (
                    <div key={sheet.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div>
                        <span className="font-medium">{sheet.materialType}</span>
                        <span className="ml-2 text-sm text-gray-600">Qty: {sheet.qty}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hardware" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-orange-700">Job Hardware</CardTitle>
                <CardDescription>Hardware inventory tracking for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 p-4 bg-orange-50 rounded-lg">
                  <div className="col-span-3">
                    <Label htmlFor="hardware-name">Hardware Name</Label>
                    <Input
                      id="hardware-name"
                      value={newHardwareName}
                      onChange={(e) => setNewHardwareName(e.target.value)}
                      placeholder="e.g., Hinges, Screws, Handles"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hardware-qty">Qty</Label>
                    <Input
                      id="hardware-qty"
                      type="number"
                      value={newHardwareQty}
                      onChange={(e) => setNewHardwareQty(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hardware-onhand">On Hand</Label>
                    <Input
                      id="hardware-onhand"
                      type="number"
                      value={newHardwareOnHand}
                      onChange={(e) => setNewHardwareOnHand(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hardware-needed">Needed</Label>
                    <Input
                      id="hardware-needed"
                      type="number"
                      value={newHardwareNeeded}
                      onChange={(e) => setNewHardwareNeeded(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hardware-used">Used</Label>
                    <Input
                      id="hardware-used"
                      type="number"
                      value={newHardwareUsed}
                      onChange={(e) => setNewHardwareUsed(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hardware-still-required">Still Required</Label>
                    <Input
                      id="hardware-still-required"
                      type="number"
                      value={newHardwareStillRequired}
                      onChange={(e) => setNewHardwareStillRequired(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3">
                    <Button onClick={handleAddHardware} className="w-full bg-orange-600 hover:bg-orange-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Hardware
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {fetchedJobHardware.map((hardware) => (
                    <div key={hardware.id} className="p-3 bg-white border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{hardware.hardwareName}</span>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-5 gap-2 text-sm text-gray-600">
                        <div>Qty: {hardware.qty}</div>
                        <div>On Hand: {hardware.onHandQty}</div>
                        <div>Needed: {hardware.needed}</div>
                        <div>Used: {hardware.used}</div>
                        <div>Still Req: {hardware.stillRequired}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rods" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-700">Job Rods</CardTitle>
                <CardDescription>Rod specifications and lengths for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg">
                  <div>
                    <Label htmlFor="rod-name">Rod Name</Label>
                    <Input
                      id="rod-name"
                      value={newRodName}
                      onChange={(e) => setNewRodName(e.target.value)}
                      placeholder="e.g., Closet Rod, Support Bar"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rod-length">Length (inches)</Label>
                    <Input
                      id="rod-length"
                      value={newRodLength}
                      onChange={(e) => setNewRodLength(e.target.value)}
                      placeholder="e.g., 5 5/16, 48, 36 1/2"
                    />
                  </div>
                  <div className="col-span-2">
                    <Button onClick={handleAddRod} className="w-full bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rod
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {fetchedJobRods.map((rod) => (
                    <div key={rod.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div>
                        <span className="font-medium">{rod.rodName}</span>
                        <span className="ml-2 text-sm text-gray-600">Length: {rod.lengthInches}"</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Import Job Data</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-category">Category</Label>
                <select
                  id="import-category"
                  value={importCategory}
                  onChange={(e) => setImportCategory(e.target.value as "sheets" | "hardware" | "rods")}
                  className="w-full p-2 border rounded mt-1"
                >
                  <option value="sheets">Sheets</option>
                  <option value="hardware">Hardware</option>
                  <option value="rods">Rods</option>
                </select>
              </div>

              <div>
                <Label htmlFor="import-file">File (CSV or Excel)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center mt-1">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileImport}
                    className="hidden"
                    id="import-file"
                    disabled={isUploading}
                  />
                  <label htmlFor="import-file" className="cursor-pointer">
                    <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {isUploading ? "Uploading..." : "Click to upload CSV or Excel file"}
                    </p>
                  </label>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>
                  <strong>Expected columns for {importCategory}:</strong>
                </p>
                {importCategory === "sheets" && <p>materialtype, qty</p>}
                {importCategory === "hardware" && <p>hardwarename, qty, onhandqty, needed, used, stillrequired</p>}
                {importCategory === "rods" && <p>rodname, lengthinches</p>}
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}

