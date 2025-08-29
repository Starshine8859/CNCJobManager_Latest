"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Maximize2, Upload, FileText, Trash2, Plus } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { useWebSocket } from "@/hooks/use-websocket"
import type {
  JobWithCutlists,
  Supply,
  JobSheet,
  JobHardware,
  JobRod,
  PartChecklist,
  PartChecklistItem,
} from "@shared/schema"

interface JobDetailsModalProps {
  job: JobWithCutlists | null
  open: boolean
  onOpenChange: (open: boolean) => void
  viewOnlyMode?: boolean
  onOpenPopup?: (jobId: number) => void
}

const JobDetailsModal = ({ job, open, onOpenChange, viewOnlyMode = false, onOpenPopup }: JobDetailsModalProps) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [localJob, setLocalJob] = useState<JobWithCutlists | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importCategory, setImportCategory] = useState<"sheets" | "hardware" | "rods">("sheets")
  const [newSheetMaterialType, setNewSheetMaterialType] = useState("")
  const [newSheetQty, setNewSheetQty] = useState("")
  const [newHardwareSupplyId, setNewHardwareSupplyId] = useState("")
  const [newHardwareAllocated, setNewHardwareAllocated] = useState("")
  const [newHardwareUsed, setNewHardwareUsed] = useState("")
  const [newHardwareStillRequired, setNewHardwareStillRequired] = useState("")
  const [newRodName, setNewRodName] = useState("")
  const [newRodLength, setNewRodLength] = useState("")
  const [newChecklistName, setNewChecklistName] = useState("")
  const [newChecklistDescription, setNewChecklistDescription] = useState("")
  const [showNewChecklistForm, setShowNewChecklistForm] = useState(false)
  const [newItemName, setNewItemName] = useState<Record<number, string>>({})
  const [newItemDescription, setNewItemDescription] = useState<Record<number, string>>({})

  const { data: supplies = [] } = useQuery<Supply[]>({
    queryKey: ["supplies"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/supplies")
      return res.json()
    },
  })

  const { data: jobSheets = [] } = useQuery<JobSheet[]>({
    queryKey: ["jobSheets", job?.id],
    enabled: !!job,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${job?.id}/sheets`)
      return res.json()
    },
  })

  const { data: jobHardware = [] } = useQuery<JobHardware[]>({
    queryKey: ["jobHardware", job?.id],
    enabled: !!job,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${job?.id}/hardware`)
      return res.json()
    },
  })

  const { data: jobRods = [] } = useQuery<JobRod[]>({
    queryKey: ["jobRods", job?.id],
    enabled: !!job,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${job?.id}/rods`)
      return res.json()
    },
  })

  const { data: jobChecklists = [] } = useQuery<PartChecklist[]>({
    queryKey: ["jobChecklists", job?.id],
    enabled: !!job,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${job?.id}/checklists`)
      return res.json()
    },
  })

  // State for checklist items
  const [checklistItems, setChecklistItems] = useState<Record<number, PartChecklistItem[]>>({})

  // Fetch checklist items for each checklist
  useEffect(() => {
    if (jobChecklists && jobChecklists.length > 0) {
      const fetchItems = async () => {
        const items: Record<number, PartChecklistItem[]> = {}
        for (const checklist of jobChecklists) {
          try {
            const res = await apiRequest("GET", `/api/part-checklists/${checklist.id}`)
            const data = await res.json()
            items[checklist.id] = data.items || []
          } catch (error) {
            console.error(`Error fetching items for checklist ${checklist.id}:`, error)
            items[checklist.id] = []
          }
        }
        setChecklistItems(items)
      }
      fetchItems()
    }
  }, [jobChecklists])

  useEffect(() => {
    if (job) {
      setLocalJob(job)
    }
  }, [job])

  const handleCreateChecklist = useCallback(async () => {
    if (!newChecklistName?.trim() || !job) {
      toast({ title: "Error", description: "Please enter a checklist name" })
      return
    }

    try {
      const response = await apiRequest("POST", "/api/part-checklists", {
        name: newChecklistName.trim(),
        description: newChecklistDescription?.trim() || "",
        jobId: job.id,
        isTemplate: false,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
        throw new Error(errorData.message || "Failed to create checklist")
      }

      const newChecklist = await response.json()

      // Update the query cache
      queryClient.setQueryData<PartChecklist[]>(["jobChecklists", job.id], (oldData) => {
        if (!oldData) return [newChecklist]
        return [...oldData, newChecklist]
      })

      // Reset form
      setNewChecklistName("")
      setNewChecklistDescription("")
      setShowNewChecklistForm(false)

      toast({ title: "Success", description: "Checklist created successfully" })
    } catch (error) {
      console.error("Error creating checklist:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create checklist",
      })
    }
  }, [newChecklistName, newChecklistDescription, job, queryClient, toast])

  const handleAddItem = useCallback(
    async (checklistId: number) => {
      const itemName = newItemName[checklistId]?.trim()
      if (!itemName) {
        toast({ title: "Error", description: "Please enter an item name" })
        return
      }

      try {
        const response = await apiRequest("POST", `/api/part-checklists/${checklistId}/items`, {
          name: itemName,
          description: newItemDescription[checklistId]?.trim() || "",
          category: "general",
          sortOrder: (checklistItems[checklistId]?.length || 0) + 1, // Set proper sort order
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
          throw new Error(errorData.message || "Failed to add item")
        }

        const newItem = await response.json()

        // Update the checklist items state
        setChecklistItems((prev) => ({
          ...prev,
          [checklistId]: [...(prev[checklistId] || []), newItem],
        }))

        // Reset form for this checklist
        setNewItemName((prev) => ({ ...prev, [checklistId]: "" }))
        setNewItemDescription((prev) => ({ ...prev, [checklistId]: "" }))

        toast({ title: "Success", description: "Item added successfully" })
      } catch (error) {
        console.error("Error adding item:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to add item",
        })
      }
    },
    [newItemName, newItemDescription, checklistItems, toast],
  )

  const handleToggleItem = useCallback(
    async (itemId: number, isCompleted: boolean, checklistId: number) => {
      try {
        const response = await apiRequest("PATCH", `/api/part-checklists/items/${itemId}`, {
          isCompleted: !isCompleted,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
          throw new Error(errorData.message || "Failed to update item")
        }

        // Update the checklist items state
        setChecklistItems((prev) => ({
          ...prev,
          [checklistId]: (prev[checklistId] || []).map((item) =>
            item.id === itemId
              ? { ...item, isCompleted: !isCompleted, completedAt: !isCompleted ? new Date().toISOString() : null }
              : item,
          ),
        }))

        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] })
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] })

        toast({ title: "Success", description: "Item updated successfully" })
      } catch (error) {
        console.error("Error updating item:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to update item",
        })
      }
    },
    [queryClient, toast],
  )

  const handleDeleteItem = useCallback(
    async (itemId: number, checklistId: number) => {
      try {
        await apiRequest("DELETE", `/api/part-checklists/items/${itemId}`)

        // Update the checklist items state
        setChecklistItems((prev) => ({
          ...prev,
          [checklistId]: (prev[checklistId] || []).filter((item) => item.id !== itemId),
        }))

        toast({ title: "Success", description: "Item deleted successfully" })
      } catch (error) {
        console.error("Error deleting item:", error)
        toast({ title: "Error", description: "Failed to delete item", variant: "destructive" })
      }
    },
    [toast],
  )

  const handleDeleteChecklist = useCallback(
    async (checklistId: number) => {
      if (!job) return
      try {
        await apiRequest("DELETE", `/api/part-checklists/${checklistId}`)
        queryClient.setQueryData<PartChecklist[]>(["jobChecklists", job.id], (oldData) =>
          oldData ? oldData.filter((c) => c.id !== checklistId) : [],
        )
        toast({ title: "Success", description: "Checklist deleted successfully" })
      } catch (error) {
        console.error("Error deleting checklist:", error)
        toast({ title: "Error", description: "Failed to delete checklist", variant: "destructive" })
      }
    },
    [job, queryClient, toast],
  )

  useWebSocket(
    "/ws",
    useCallback(
      (message) => {
        if (message.type === "job_updated" && message.data.id === job?.id) {
          setLocalJob(message.data)
          queryClient.invalidateQueries({ queryKey: ["jobs"] })
        }
      },
      [job?.id, queryClient],
    ),
  )

  const handleStartJob = useCallback(async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/start`, {})
      toast({ title: "Success", description: "Job started successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    } catch {
      toast({ title: "Error", description: "Failed to start job" })
    }
  }, [job?.id, queryClient, toast])

  const handlePauseJob = useCallback(async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/pause`, {})
      toast({ title: "Success", description: "Job paused successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    } catch {
      toast({ title: "Error", description: "Failed to pause job" })
    }
  }, [job?.id, queryClient, toast])

  const handleResumeJob = useCallback(async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/resume`, {})
      toast({ title: "Success", description: "Job resumed successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    } catch {
      toast({ title: "Error", description: "Failed to resume job" })
    }
  }, [job?.id, queryClient, toast])

  const handleCompleteJob = useCallback(async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/complete`, {})
      toast({ title: "Success", description: "Job completed successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      onOpenChange(false)
    } catch {
      toast({ title: "Error", description: "Failed to complete job" })
    }
  }, [job?.id, onOpenChange, queryClient, toast])

  const handleDeleteSheet = useCallback(
    async (sheetId: number) => {
      try {
        await apiRequest("DELETE", `/api/jobs/${job?.id}/sheets/${sheetId}`)
        toast({ title: "Success", description: "Sheet deleted successfully" })
        queryClient.invalidateQueries({ queryKey: ["jobSheets", job?.id] })
      } catch {
        toast({ title: "Error", description: "Failed to delete sheet" })
      }
    },
    [job?.id, queryClient, toast],
  )

  const handleDeleteHardware = useCallback(
    async (hardwareId: number) => {
      try {
        await apiRequest("DELETE", `/api/jobs/${job?.id}/hardware/${hardwareId}`)
        toast({ title: "Success", description: "Hardware deleted successfully" })
        queryClient.invalidateQueries({ queryKey: ["jobHardware", job?.id] })
      } catch {
        toast({ title: "Error", description: "Failed to delete hardware" })
      }
    },
    [job?.id, queryClient, toast],
  )

  const handleDeleteRod = useCallback(
    async (rodId: number) => {
      try {
        await apiRequest("DELETE", `/api/jobs/${job?.id}/rods/${rodId}`)
        toast({ title: "Success", description: "Rod deleted successfully" })
        queryClient.invalidateQueries({ queryKey: ["jobRods", job?.id] })
      } catch {
        toast({ title: "Error", description: "Failed to delete rod" })
      }
    },
    [job?.id, queryClient, toast],
  )

  const handleAddSheet = useCallback(async () => {
    if (!newSheetMaterialType?.trim() || !newSheetQty) {
      toast({ title: "Error", description: "Please fill in both material type and quantity" })
      return
    }

    const qty = Number.parseInt(newSheetQty)
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity greater than 0" })
      return
    }

    try {
      const response = await apiRequest("POST", `/api/jobs/${job?.id}/sheets`, {
        materialType: newSheetMaterialType.trim(),
        qty: qty,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
        throw new Error(errorData.message || "Failed to add sheet")
      }

      toast({ title: "Success", description: "Sheet added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobSheets", job?.id] })
      setNewSheetMaterialType("")
      setNewSheetQty("")
    } catch (error) {
      console.error("Error adding sheet:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add sheet",
      })
    }
  }, [job?.id, newSheetMaterialType, newSheetQty, queryClient, toast])

  const handleAddHardware = useCallback(async () => {
    if (!newHardwareSupplyId || !newHardwareAllocated) {
      toast({ title: "Error", description: "Please fill in required fields (Supply and Allocated quantity)" })
      return
    }

    const selectedSupply = supplies.find((s) => s.id === Number.parseInt(newHardwareSupplyId))
    if (!selectedSupply) {
      toast({ title: "Error", description: "Please select a valid hardware item" })
      return
    }

    try {
      const response = await apiRequest("POST", `/api/jobs/${job?.id}/hardware`, {
        supplyId: Number.parseInt(newHardwareSupplyId),
        allocated: Number.parseInt(newHardwareAllocated) || 0,
        used: Number.parseInt(newHardwareUsed) || 0,
        stillRequired: Number.parseInt(newHardwareStillRequired) || 0,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
        throw new Error(errorData.message || "Failed to add hardware")
      }

      toast({ title: "Success", description: "Hardware added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobHardware", job?.id] })
      setNewHardwareSupplyId("")
      setNewHardwareAllocated("")
      setNewHardwareUsed("")
      setNewHardwareStillRequired("")
    } catch (error) {
      console.error("Error adding hardware:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add hardware",
      })
    }
  }, [
    job?.id,
    newHardwareSupplyId,
    newHardwareAllocated,
    newHardwareUsed,
    newHardwareStillRequired,
    queryClient,
    supplies,
    toast,
  ])

  const handleAddRod = useCallback(async () => {
    if (!newRodName?.trim() || !newRodLength?.trim()) {
      toast({ title: "Error", description: "Please fill in both rod name and length" })
      return
    }

    try {
      const response = await apiRequest("POST", `/api/jobs/${job?.id}/rods`, {
        rodName: newRodName.trim(),
        lengthInches: newRodLength.trim(),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
        throw new Error(errorData.message || "Failed to add rod")
      }

      toast({ title: "Success", description: "Rod added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobRods", job?.id] })
      setNewRodName("")
      setNewRodLength("")
    } catch (error) {
      console.error("Error adding rod:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add rod",
      })
    }
  }, [job?.id, newRodLength, newRodName, queryClient, toast])

  const handleFileImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const allowedTypes = [".csv", ".xlsx", ".xls"]
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."))
      if (!allowedTypes.includes(fileExtension)) {
        toast({ title: "Error", description: "Please select a CSV or Excel file" })
        return
      }

      setIsUploading(true)
      const formData = new FormData()
      formData.append("file", file) // Changed from "importFile" to "file" to match server expectations
      formData.append("category", importCategory)

      try {
        const res = await apiRequest("POST", `/api/jobs/${job?.id}/import`, formData)

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: "Import failed" }))
          throw new Error(errorData.message || "Import failed")
        }

        const data = await res.json()
        toast({
          title: "Import Complete",
          description: `${data.imported} items imported successfully`,
        })

        const queryKey =
          importCategory === "sheets" ? "jobSheets" : importCategory === "hardware" ? "jobHardware" : "jobRods"
        queryClient.invalidateQueries({ queryKey: [queryKey, job?.id] })

        setShowImportDialog(false)
      } catch (error) {
        console.error("Import error:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to import file",
        })
      } finally {
        setIsUploading(false)
        // Reset file input
        e.target.value = ""
      }
    },
    [importCategory, job?.id, queryClient, toast],
  )

  if (!job) return null

  const isWaiting = job.status === "waiting"
  const isInProgress = job.status === "in_progress"
  const isPaused = job.status === "paused"
  const isDone = job.status === "done"

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl min-h-[80vh] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-700">
            {job.jobName} - {job.customerName}
          </DialogTitle>
          <div className="flex items-center space-x-2 mt-2">
            <Badge className={getStatusColor(job.status)}>{job.status.replace("_", " ").toUpperCase()}</Badge>
            <span className="text-sm text-gray-600">Job #{job.jobNumber}</span>
          </div>
        </DialogHeader>

        <div className="flex justify-end space-x-2 mb-4">
          {!viewOnlyMode && isWaiting && (
            <Button onClick={handleStartJob} className="bg-blue-600 hover:bg-blue-700">
              Start Job
            </Button>
          )}
          {!viewOnlyMode && isInProgress && (
            <>
              <Button onClick={handlePauseJob} className="bg-blue-600 hover:bg-blue-700">
                Pause Job
              </Button>
              <Button onClick={handleCompleteJob} className="bg-blue-600 hover:bg-blue-700">
                Complete Job
              </Button>
            </>
          )}
          {!viewOnlyMode && isPaused && (
            <Button onClick={handleResumeJob} className="bg-blue-600 hover:bg-blue-700">
              Resume Job
            </Button>
          )}
          {isDone && <Badge variant="secondary">Job Completed</Badge>}
          {onOpenPopup && (
            <Button onClick={() => onOpenPopup(job.id)} variant="outline">
              <Maximize2 className="w-4 h-4 mr-2" />
              Open in Popup
            </Button>
          )}
        </div>

        <Tabs defaultValue="checklists" className="space-y-4">
          <TabsList className="border-b w-full">
            <TabsTrigger value="checklists">Part Checklists</TabsTrigger>
            <TabsTrigger value="sheets">Sheets</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="rods">Rods</TabsTrigger>
            {!viewOnlyMode && (
              <TabsTrigger value="import">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="checklists" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-700">Job Part Checklists</CardTitle>
                <CardDescription>Manage checklists for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!viewOnlyMode && (
                  <div className="space-y-4">
                    {!showNewChecklistForm ? (
                      <Button
                        onClick={() => setShowNewChecklistForm(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Checklist
                      </Button>
                    ) : (
                      <div className="p-4 bg-blue-50 rounded-lg space-y-4">
                        <h3 className="text-lg font-medium">Create New Checklist</h3>
                        <div className="space-y-2">
                          <Label htmlFor="checklist-name">Checklist Name</Label>
                          <Input
                            required
                            id="checklist-name"
                            value={newChecklistName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChecklistName(e.target.value)}
                            placeholder="Enter checklist name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="checklist-description">Description</Label>
                          <Textarea
                            id="checklist-description"
                            value={newChecklistDescription}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              setNewChecklistDescription(e.target.value)
                            }
                            placeholder="Enter description (optional)"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button onClick={handleCreateChecklist} className="bg-blue-600 hover:bg-blue-700">
                            Create Checklist
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowNewChecklistForm(false)
                              setNewChecklistName("")
                              setNewChecklistDescription("")
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  {jobChecklists.map((checklist) => (
                    <div key={checklist.id} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-blue-50">
                        <div>
                          <span className="font-medium">{checklist.name}</span>
                          {checklist.description && (
                            <span className="ml-2 text-sm text-gray-600">{checklist.description}</span>
                          )}
                        </div>
                        {!viewOnlyMode && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteChecklist(checklist.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="p-3">
                        {!viewOnlyMode && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <h4 className="text-md font-medium mb-2">Add New Item</h4>

                            <div className="space-y-2">
                              <Input
                                value={newItemName[checklist.id] || ""}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setNewItemName((prev) => ({ ...prev, [checklist.id]: e.target.value }))
                                }
                                placeholder="Item name"
                              />
                              <Input
                                value={newItemDescription[checklist.id] ?? ""}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setNewItemDescription((prev) => ({ ...prev, [checklist.id]: e.target.value }))
                                }
                                placeholder="Description (optional)"
                              />
                              <Button onClick={() => handleAddItem(checklist.id)} size="sm" className="mt-2">
                                Add Item
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          {(checklistItems[checklist.id] || []).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 bg-white border rounded"
                            >
                              <div className="flex items-center">
                                {!viewOnlyMode && (
                                  <input
                                    type="checkbox"
                                    checked={!!item.isCompleted}
                                    onChange={() => handleToggleItem(item.id, !!item.isCompleted, checklist.id)}
                                    className="mr-2"
                                  />
                                )}
                                <span className={item.isCompleted ? "line-through text-gray-500" : ""}>
                                  {item.name}
                                </span>
                                {item.description && (
                                  <span className="ml-2 text-sm text-gray-600">- {item.description}</span>
                                )}
                              </div>
                              {!viewOnlyMode && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteItem(item.id, checklist.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sheets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-700">Job Sheets</CardTitle>
                <CardDescription>Manage sheets for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!viewOnlyMode && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <Label htmlFor="sheet-material">Material Type</Label>
                      <Input
                        id="sheet-material"
                        value={newSheetMaterialType}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSheetMaterialType(e.target.value)}
                        placeholder="e.g., Wood, Metal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sheet-qty">Quantity</Label>
                      <Input
                        id="sheet-qty"
                        type="number"
                        value={newSheetQty}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSheetQty(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button onClick={handleAddSheet} className="w-full bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Sheet
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {jobSheets.map((sheet) => (
                    <div key={sheet.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div>
                        <span className="font-medium">{sheet.materialType}</span>
                        <span className="ml-2 text-sm text-gray-600">Qty: {sheet.qty}</span>
                      </div>
                      {!viewOnlyMode && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteSheet(sheet.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hardware" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-700">Job Hardware</CardTitle>
                <CardDescription>Hardware inventory tracking for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!viewOnlyMode && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                    <div className="col-span-2">
                      <Label htmlFor="hardware-name">Hardware Name</Label>
                      <Select value={newHardwareSupplyId} onValueChange={setNewHardwareSupplyId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select hardware from inventory" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplies.map((supply) => (
                            <SelectItem key={supply.id} value={supply.id.toString()}>
                              {supply.name} {supply.partNumber && `(${supply.partNumber})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="hardware-allocated">Allocated</Label>
                      <Input
                        id="hardware-allocated"
                        type="number"
                        value={newHardwareAllocated}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHardwareAllocated(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hardware-used">Used</Label>
                      <Input
                        id="hardware-used"
                        type="number"
                        value={newHardwareUsed}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHardwareUsed(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="hardware-still-required">Still Required</Label>
                      <Input
                        id="hardware-still-required"
                        type="number"
                        value={newHardwareStillRequired}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setNewHardwareStillRequired(e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button onClick={handleAddHardware} className="w-full bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Hardware
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {jobHardware.map((hardware) => (
                    <div key={hardware.id} className="p-3 bg-white border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{hardware.hardwareName}</span>
                        {!viewOnlyMode && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteHardware(hardware.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-sm text-gray-600">
                        <div>
                          On Hand: <span className="font-medium text-gray-800">{hardware.onHandQty}</span>
                        </div>
                        <div>
                          Needed: <span className="font-medium text-gray-800">{hardware.needed}</span>
                        </div>
                        <div>
                          Qty: <span className="font-medium text-blue-600">{hardware.qty}</span>
                        </div>
                        <div>
                          Used: <span className="font-medium text-green-600">{hardware.used}</span>
                        </div>
                        <div>
                          Still Req: <span className="font-medium text-red-600">{hardware.stillRequired}</span>
                        </div>
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
                <CardTitle className="text-lg text-blue-700">Job Rods</CardTitle>
                <CardDescription>Rod specifications and lengths for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!viewOnlyMode && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <Label htmlFor="rod-name">Rod Name</Label>
                      <Input
                        id="rod-name"
                        value={newRodName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRodName(e.target.value)}
                        placeholder="e.g., Closet Rod"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rod-length">Length (inches)</Label>
                      <Input
                        id="rod-length"
                        value={newRodLength}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRodLength(e.target.value)}
                        placeholder="e.g., 48"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button onClick={handleAddRod} className="w-full bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Rod
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {jobRods.map((rod) => (
                    <div key={rod.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div>
                        <span className="font-medium">{rod.rodName}</span>
                        <span className="ml-2 text-sm text-gray-600">Length: {rod.lengthInches}"</span>
                      </div>
                      {!viewOnlyMode && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRod(rod.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-700">Import Job Data</CardTitle>
                <CardDescription>Upload CSV or Excel files to import job data</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowImportDialog(true)} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-md min-h-[400px] max-h-[600px] p-6">
            <DialogHeader>
              <DialogTitle className="text-blue-700">Import Job Data</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-category">Category</Label>
                <Select
                  value={importCategory}
                  onValueChange={(value: "sheets" | "hardware" | "rods") => setImportCategory(value)}
                >
                  <SelectTrigger className="border-blue-200 focus:border-blue-500">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sheets">Sheets</SelectItem>
                    <SelectItem value="hardware">Hardware</SelectItem>
                    <SelectItem value="rods">Rods</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="import-file">File (CSV or Excel)</Label>
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileImport}
                    className="hidden"
                    id="import-file"
                    disabled={isUploading}
                  />
                  <label htmlFor="import-file" className="cursor-pointer">
                    <FileText className="h-8 w-8 mx-auto text-blue-400 mb-2" />
                    <p className="text-sm text-blue-600">
                      {isUploading ? "Uploading..." : "Click to upload CSV or Excel file"}
                    </p>
                  </label>
                </div>
              </div>
              <div className="text-xs text-blue-600 space-y-1 bg-blue-50 p-3 rounded-lg">
                <p>
                  <strong>Expected columns for {importCategory}:</strong>
                </p>
                {importCategory === "sheets" && <p>materialtype, qty</p>}
                {importCategory === "hardware" && <p>supplyid, allocated, used, stillrequired</p>}
                {importCategory === "rods" && <p>rodname, lengthinches</p>}
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowImportDialog(false)}
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
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

export default JobDetailsModal
