"use client"

import React, { useState, useEffect } from "react"
import { Maximize2, Upload, FileText, Trash2, Plus } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { useWebSocket } from "@/hooks/use-websocket"
import type { JobWithCutlists, Supply, JobSheet, JobHardware, JobRod, PartChecklistType } from "@shared/schema"

type ChecklistItemInput = {
  partName: string
  qty: string
  isChecked: boolean
}

interface JobDetailsModalProps {
  job: JobWithCutlists | null
  open: boolean
  onOpenChange: (open: boolean) => void
  viewOnlyMode?: boolean
}

function JobDetailsModal({ job, open, onOpenChange, viewOnlyMode = false }: JobDetailsModalProps) {
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
  const [newChecklistItems, setNewChecklistItems] = useState<ChecklistItemInput[]>([
    { partName: "", qty: "", isChecked: false },
  ])

  const { data: supplies = [] } = useQuery<Supply[]>({
    queryKey: ["supplies"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/supplies")
      const data = await res.json()
      if (!data.length) {
        toast({ title: "Warning", description: "No supplies available for hardware selection" })
      }
      return data
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

  const { data: jobChecklists = [] } = useQuery<PartChecklistType[]>({
    queryKey: ["jobChecklists", job?.id],
    enabled: !!job,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${job?.id}/checklists`)
      return res.json()
    },
  })

  useEffect(() => {
    if (job) {
      setLocalJob(job)
    }
  }, [job])

  useWebSocket((message) => {
    if (message.type === "job_updated" && message.data.id === job?.id) {
      setLocalJob(message.data)
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    }
  })

  const handleStartJob = async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/start`, {})
      toast({ title: "Success", description: "Job started successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to start job" })
    }
  }

  const handlePauseJob = async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/pause`, {})
      toast({ title: "Success", description: "Job paused successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to pause job" })
    }
  }

  const handleResumeJob = async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/resume`, {})
      toast({ title: "Success", description: "Job resumed successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to resume job" })
    }
  }

  const handleCompleteJob = async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/complete`, {})
      toast({ title: "Success", description: "Job completed successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to complete job" })
    }
  }

  const handleDeleteSheet = async (sheetId: number) => {
    try {
      await apiRequest("DELETE", `/api/jobs/${job?.id}/sheets/${sheetId}`)
      toast({ title: "Success", description: "Sheet deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobSheets", job?.id] })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete sheet" })
    }
  }

  const handleDeleteHardware = async (hardwareId: number) => {
    try {
      await apiRequest("DELETE", `/api/jobs/${job?.id}/hardware/${hardwareId}`)
      toast({ title: "Success", description: "Hardware deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobHardware", job?.id] })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete hardware" })
    }
  }

  const handleDeleteRod = async (rodId: number) => {
    try {
      await apiRequest("DELETE", `/api/jobs/${job?.id}/rods/${rodId}`)
      toast({ title: "Success", description: "Rod deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobRods", job?.id] })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete rod" })
    }
  }

  const handleDeleteChecklist = async (checklistId: number) => {
    try {
      await apiRequest("DELETE", `/api/jobs/${job?.id}/checklists/${checklistId}`)
      toast({ title: "Success", description: "Checklist deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobChecklists", job?.id] })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete checklist" })
    }
  }

  const handleAddSheet = async () => {
    if (!newSheetMaterialType.trim() || !newSheetQty || isNaN(parseInt(newSheetQty)) || parseInt(newSheetQty) <= 0) {
      toast({ title: "Error", description: "Please enter a valid material type and quantity" })
      return
    }
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/sheets`, {
        materialType: newSheetMaterialType,
        qty: parseInt(newSheetQty),
      })
      toast({ title: "Success", description: "Sheet added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobSheets", job?.id] })
      setNewSheetMaterialType("")
      setNewSheetQty("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add sheet" })
    }
  }

  const handleAddHardware = async () => {
    if (!newHardwareSupplyId || isNaN(parseInt(newHardwareSupplyId))) {
      toast({ title: "Error", description: "Please select a valid supply" })
      return
    }
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/hardware`, {
        supplyId: parseInt(newHardwareSupplyId),
        allocated: parseInt(newHardwareAllocated) || 0,
        used: parseInt(newHardwareUsed) || 0,
        stillRequired: parseInt(newHardwareStillRequired) || 0,
      })
      toast({ title: "Success", description: "Hardware added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobHardware", job?.id] })
      setNewHardwareSupplyId("")
      setNewHardwareAllocated("")
      setNewHardwareUsed("")
      setNewHardwareStillRequired("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add hardware" })
    }
  }

  const handleAddRod = async () => {
    if (!newRodName || !newRodLength) {
      toast({ title: "Error", description: "Please enter a rod name and length" })
      return
    }
    const lengthInches = parseInt(newRodLength, 10)
    if (isNaN(lengthInches) || lengthInches <= 0) {
      toast({ title: "Error", description: "Please enter a valid positive number for length" })
      return
    }
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/rods`, {
        rodName: newRodName,
        lengthInches,
      })
      toast({ title: "Success", description: "Rod added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobRods", job?.id] })
      setNewRodName("")
      setNewRodLength("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add rod" })
    }
  }

  const handleAddChecklist = async () => {
    if (!newChecklistName.trim()) {
      toast({ title: "Error", description: "Checklist name is required" })
      return
    }
    const items = newChecklistItems.map((item) => ({
      partName: item.partName,
      qty: parseInt(item.qty, 10),
      isChecked: item.isChecked,
    }))
    if (items.some((item) => !item.partName.trim() || isNaN(item.qty) || item.qty <= 0)) {
      toast({ title: "Error", description: "All items must have a valid part name and positive quantity" })
      return
    }
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/checklists`, {
        name: newChecklistName,
        items,
      })
      toast({ title: "Success", description: "Checklist added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobChecklists", job?.id] })
      setNewChecklistName("")
      setNewChecklistItems([{ partName: "", qty: "", isChecked: false }])
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add checklist" })
    }
  }

  const handleAddChecklistItemInput = () => {
    setNewChecklistItems([...newChecklistItems, { partName: "", qty: "", isChecked: false }])
  }

  const handleChecklistItemChange = (index: number, field: keyof ChecklistItemInput, value: string | boolean) => {
    const updatedItems = [...newChecklistItems]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setNewChecklistItems(updatedItems)
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const formData = new FormData()
    formData.append("importFile", file)
    formData.append("category", importCategory)
    try {
      const res = await apiRequest("POST", `/api/jobs/${job?.id}/import`, formData, true)
      const data = await res.json()
      toast({
        title: "Import Complete",
        description: `${data.imported} items imported successfully`,
      })
      queryClient.invalidateQueries({ queryKey: [`job${importCategory.charAt(0).toUpperCase() + importCategory.slice(1)}`, job?.id] })
      setShowImportDialog(false)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to import some or all items. Check file format." })
    } finally {
      setIsUploading(false)
    }
  }

  const handleOpenPopup = () => {
    if (job?.id) {
      const popup = window.open(`/popup/${job.id}`, "_blank", "width=800,height=600")
      if (!popup) {
        toast({ title: "Error", description: "Popup blocked. Please allow popups for this site." })
      }
    }
  }

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
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[80vw] lg:w-[1280px] h-[80vh] overflow-y-auto p-1 sm:p-2">
        <div className="flex justify-between items-start mb-0">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-orange-800">
              {job.jobName} - {job.customerName}
            </DialogTitle>
            <div className="flex items-center space-x-2 mt-0.5">
              <Badge className={`text-xs sm:text-sm ${getStatusColor(job.status)}`}>{job.status.replace("_", " ").toUpperCase()}</Badge>
              <span className="text-xs sm:text-sm text-gray-600">Job #{job.jobNumber}</span>
            </div>
          </DialogHeader>
          <Button variant="outline" onClick={handleOpenPopup} className="text-xs sm:text-sm ml-2">
            <Maximize2 className="w-4 h-4 mr-2" />
            Open in Popup
          </Button>
        </div>

        <Tabs defaultValue="checklists" className="mt-0 space-y-1">
          <TabsList className="grid grid-cols-3 sm:grid-cols-5 w-full">
            <TabsTrigger value="checklists" className="text-xs sm:text-sm">Checklists</TabsTrigger>
            <TabsTrigger value="sheets" className="text-xs sm:text-sm">Sheets</TabsTrigger>
            <TabsTrigger value="hardware" className="text-xs sm:text-sm">Hardware</TabsTrigger>
            <TabsTrigger value="rods" className="text-xs sm:text-sm">Rods</TabsTrigger>
            <TabsTrigger value="import" className="text-xs sm:text-sm">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="checklists" className="space-y-1 max-h-[60vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg text-green-700">Job Checklists</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Track parts and checklists for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {!viewOnlyMode && (
                  <div className="grid grid-cols-1 gap-1 p-1 bg-green-50 rounded-lg">
                    <div>
                      <Label htmlFor="checklist-name" className="text-xs sm:text-sm">Checklist Name</Label>
                      <Input
                        id="checklist-name"
                        value={newChecklistName}
                        onChange={(e) => setNewChecklistName(e.target.value)}
                        placeholder="e.g., Parts Checklist"
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    {newChecklistItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                        <div>
                          <Label htmlFor={`item-part-${index}`} className="text-xs sm:text-sm">Part Name</Label>
                          <Input
                            id={`item-part-${index}`}
                            value={item.partName}
                            onChange={(e) => handleChecklistItemChange(index, "partName", e.target.value)}
                            placeholder="e.g., Bracket"
                            className="text-xs sm:text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`item-qty-${index}`} className="text-xs sm:text-sm">Quantity</Label>
                          <Input
                            id={`item-qty-${index}`}
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleChecklistItemChange(index, "qty", e.target.value)}
                            placeholder="0"
                            className="text-xs sm:text-sm"
                          />
                        </div>
                        <div className="flex items-center space-x-1 sm:mt-1">
                          <Input
                            type="checkbox"
                            checked={item.isChecked}
                            onChange={(e) => handleChecklistItemChange(index, "isChecked", e.target.checked)}
                            className="h-4 w-4"
                          />
                          <Label className="text-xs sm:text-sm">Checked</Label>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col sm:flex-row gap-1">
                      <Button variant="outline" onClick={handleAddChecklistItemInput} className="flex-1 text-xs sm:text-sm">
                        Add Another Item
                      </Button>
                      <Button onClick={handleAddChecklist} className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm">
                        Add Checklist
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-0.5">
                  {jobChecklists.map((checklist) => (
                    <div key={checklist.id} className="p-1 bg-white border rounded-lg">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-sm sm:text-base">{checklist.name}</span>
                        {!viewOnlyMode && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteChecklist(checklist.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-0.5 text-xs sm:text-sm text-gray-600">
                        {checklist.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span>{item.partName} - Qty: {item.qty}</span>
                            <Input
                              type="checkbox"
                              checked={item.isChecked}
                              disabled
                              aria-readonly="true"
                              className="h-4 w-4"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sheets" className="space-y-1 max-h-[60vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg text-blue-700">Job Sheets</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Manage sheets for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {!viewOnlyMode && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1 bg-blue-50 rounded-lg">
                    <div>
                      <Label htmlFor="sheet-material" className="text-xs sm:text-sm">Material Type</Label>
                      <Input
                        id="sheet-material"
                        value={newSheetMaterialType}
                        onChange={(e) => setNewSheetMaterialType(e.target.value)}
                        placeholder="e.g., Wood, Metal"
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sheet-qty" className="text-xs sm:text-sm">Quantity</Label>
                      <Input
                        id="sheet-qty"
                        type="number"
                        value={newSheetQty}
                        onChange={(e) => setNewSheetQty(e.target.value)}
                        placeholder="0"
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Button onClick={handleAddSheet} className="w-full bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Sheet
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-0.5">
                  {jobSheets.map((sheet) => (
                    <div key={sheet.id} className="flex items-center justify-between p-1 bg-white border rounded-lg">
                      <div>
                        <span className="font-medium text-sm sm:text-base">{sheet.materialType}</span>
                        <span className="ml-0.5 text-xs sm:text-sm text-gray-600">Qty: {sheet.qty}</span>
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

          <TabsContent value="hardware" className="space-y-1 max-h-[60vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg text-orange-700">Job Hardware</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Hardware inventory tracking for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {!viewOnlyMode && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1 bg-orange-50 rounded-lg">
                    <div className="col-span-1 sm:col-span-2">
                      <Label htmlFor="hardware-name" className="text-xs sm:text-sm">Hardware Name</Label>
                      <Select value={newHardwareSupplyId} onValueChange={setNewHardwareSupplyId}>
                        <SelectTrigger className="text-xs sm:text-sm">
                          <SelectValue placeholder="Select hardware from inventory" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplies.map((supply) => (
                            <SelectItem key={supply.id} value={supply.id.toString()} className="text-xs sm:text-sm">
                              {supply.name} {supply.partNumber && `(${supply.partNumber})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="hardware-allocated" className="text-xs sm:text-sm">Allocated</Label>
                      <Input
                        id="hardware-allocated"
                        type="number"
                        value={newHardwareAllocated}
                        onChange={(e) => setNewHardwareAllocated(e.target.value)}
                        placeholder="0"
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hardware-used" className="text-xs sm:text-sm">Used</Label>
                      <Input
                        id="hardware-used"
                        type="number"
                        value={newHardwareUsed}
                        onChange={(e) => setNewHardwareUsed(e.target.value)}
                        placeholder="0"
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Label htmlFor="hardware-still-required" className="text-xs sm:text-sm">Still Required</Label>
                      <Input
                        id="hardware-still-required"
                        type="number"
                        value={newHardwareStillRequired}
                        onChange={(e) => setNewHardwareStillRequired(e.target.value)}
                        placeholder="0"
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Button onClick={handleAddHardware} className="w-full bg-orange-600 hover:bg-orange-700 text-xs sm:text-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Hardware
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-0.5">
                  {jobHardware.map((hardware) => (
                    <div key={hardware.id} className="p-1 bg-white border rounded-lg">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-sm sm:text-base">{hardware.supply?.name || "Unknown Hardware"}</span>
                        {!viewOnlyMode && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteHardware(hardware.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0.5 text-xs sm:text-sm text-gray-600">
                        <div>
                          On Hand: <span className="font-medium text-gray-800">{hardware.onHand}</span>
                        </div>
                        <div>
                          Available: <span className="font-medium text-gray-800">{hardware.available}</span>
                        </div>
                        <div>
                          Allocated: <span className="font-medium text-orange-600">{hardware.allocated}</span>
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

          <TabsContent value="rods" className="space-y-1 max-h-[60vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg text-green-700">Job Rods</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Rod specifications and lengths for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {!viewOnlyMode && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1 bg-green-50 rounded-lg">
                    <div>
                      <Label htmlFor="rod-name" className="text-xs sm:text-sm">Rod Name</Label>
                      <Input
                        id="rod-name"
                        value={newRodName}
                        onChange={(e) => setNewRodName(e.target.value)}
                        placeholder="e.g., Closet Rod"
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rod-length" className="text-xs sm:text-sm">Length (inches)</Label>
                      <Input
                        id="rod-length"
                        type="number"
                        value={newRodLength}
                        onChange={(e) => setNewRodLength(e.target.value)}
                        placeholder="0"
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <Button onClick={handleAddRod} className="w-full bg-green-600 hover:bg-green-700 text-xs sm:text-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Rod
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-0.5">
                  {jobRods.map((rod) => (
                    <div key={rod.id} className="flex items-center justify-between p-1 bg-white border rounded-lg">
                      <div>
                        <span className="font-medium text-sm sm:text-base">{rod.rodName}</span>
                        <span className="ml-0.5 text-xs sm:text-sm text-gray-600">Length: {rod.lengthInches}"</span>
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

          <TabsContent value="import" className="space-y-1 max-h-[60vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg text-gray-700">Import Job Data</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Upload CSV or Excel files to import job data</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowImportDialog(true)} className="w-full bg-gray-600 hover:bg-gray-700 text-xs sm:text-sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="w-[90vw] sm:w-[500px] h-[60vh] overflow-y-auto p-1 sm:p-2">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Import Job Data</DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              <div>
                <Label htmlFor="import-category" className="text-xs sm:text-sm">Category</Label>
                <Select
                  value={importCategory}
                  onValueChange={(value) => setImportCategory(value as "sheets" | "hardware" | "rods")}
                >
                  <SelectTrigger className="text-xs sm:text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sheets" className="text-xs sm:text-sm">Sheets</SelectItem>
                    <SelectItem value="hardware" className="text-xs sm:text-sm">Hardware</SelectItem>
                    <SelectItem value="rods" className="text-xs sm:text-sm">Rods</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="import-file" className="text-xs sm:text-sm">File (CSV or Excel)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-1 text-center">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileImport}
                    className="hidden"
                    id="import-file"
                    disabled={isUploading}
                  />
                  <label htmlFor="import-file" className="cursor-pointer">
                    <FileText className="h-6 sm:h-8 w-6 sm:w-8 mx-auto text-gray-400 mb-0.5" />
                    <p className="text-xs sm:text-sm text-gray-600">
                      {isUploading ? "Uploading..." : "Click to upload CSV or Excel file"}
                    </p>
                  </label>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <p>
                  <strong>Expected columns for {importCategory}:</strong>
                </p>
                {importCategory === "sheets" && <p>materialtype, qty</p>}
                {importCategory === "hardware" && <p>hardwarename, allocated, used, stillrequired</p>}
                {importCategory === "rods" && <p>rodname, lengthinches</p>}
              </div>
              <div className="flex justify-end gap-1">
                <Button variant="outline" onClick={() => setShowImportDialog(false)} className="text-xs sm:text-sm">
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
