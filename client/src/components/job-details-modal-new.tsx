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

interface JobDetailsModalProps {
  job: JobWithCutlists | null
  open: boolean
  onOpenChange: (open: boolean) => void
  viewOnlyMode?: boolean
  onOpenPopup?: (jobId: number) => void
}

function JobDetailsModal({ job, open, onOpenChange, viewOnlyMode = false, onOpenPopup }: JobDetailsModalProps) {
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
    } catch {
      toast({ title: "Error", description: "Failed to start job" })
    }
  }

  const handlePauseJob = async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/pause`, {})
      toast({ title: "Success", description: "Job paused successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    } catch {
      toast({ title: "Error", description: "Failed to pause job" })
    }
  }

  const handleResumeJob = async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/resume`, {})
      toast({ title: "Success", description: "Job resumed successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    } catch {
      toast({ title: "Error", description: "Failed to resume job" })
    }
  }

  const handleCompleteJob = async () => {
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/complete`, {})
      toast({ title: "Success", description: "Job completed successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      onOpenChange(false)
    } catch {
      toast({ title: "Error", description: "Failed to complete job" })
    }
  }

  const handleDeleteSheet = async (sheetId: number) => {
    try {
      await apiRequest("DELETE", `/api/jobs/${job?.id}/sheets/${sheetId}`)
      toast({ title: "Success", description: "Sheet deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobSheets", job?.id] })
    } catch {
      toast({ title: "Error", description: "Failed to delete sheet" })
    }
  }

  const handleDeleteHardware = async (hardwareId: number) => {
    try {
      await apiRequest("DELETE", `/api/jobs/${job?.id}/hardware/${hardwareId}`)
      toast({ title: "Success", description: "Hardware deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobHardware", job?.id] })
    } catch {
      toast({ title: "Error", description: "Failed to delete hardware" })
    }
  }

  const handleDeleteRod = async (rodId: number) => {
    try {
      await apiRequest("DELETE", `/api/jobs/${job?.id}/rods/${rodId}`)
      toast({ title: "Success", description: "Rod deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobRods", job?.id] })
    } catch {
      toast({ title: "Error", description: "Failed to delete rod" })
    }
  }

  const handleAddSheet = async () => {
    if (!newSheetMaterialType || !newSheetQty) return
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/sheets`, {
        materialType: newSheetMaterialType,
        qty: parseInt(newSheetQty),
      })
      toast({ title: "Success", description: "Sheet added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobSheets", job?.id] })
      setNewSheetMaterialType("")
      setNewSheetQty("")
    } catch {
      toast({ title: "Error", description: "Failed to add sheet" })
    }
  }

  const handleAddHardware = async () => {
    if (!newHardwareSupplyId) return
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
    } catch {
      toast({ title: "Error", description: "Failed to add hardware" })
    }
  }

  const handleAddRod = async () => {
    if (!newRodName || !newRodLength) return
    try {
      await apiRequest("POST", `/api/jobs/${job?.id}/rods`, {
        rodName: newRodName,
        lengthInches: newRodLength,
      })
      toast({ title: "Success", description: "Rod added successfully" })
      queryClient.invalidateQueries({ queryKey: ["jobRods", job?.id] })
      setNewRodName("")
      setNewRodLength("")
    } catch {
      toast({ title: "Error", description: "Failed to add rod" })
    }
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
    } catch {
      toast({ title: "Error", description: "Failed to import file" })
    } finally {
      setIsUploading(false)
    }
  }

  if (!job) return null

  const isWaiting = job.status === "waiting"
  const isInProgress = job.status === "in_progress"
  const isPaused = job.status === "paused"
  const isDone = job.status === "done"

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done": return "bg-green-100 text-green-800 border-green-200"
      case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200"
      case "waiting": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "paused": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-orange-800">
            {job.jobName} - {job.customerName}
          </DialogTitle>
          <div className="flex items-center space-x-2 mt-2">
            <Badge className={getStatusColor(job.status)}>{job.status.replace("_", " ").toUpperCase()}</Badge>
            <span className="text-sm text-gray-600">Job #{job.jobNumber}</span>
          </div>
        </DialogHeader>

        <div className="flex justify-end space-x-2 mb-4">
          {!viewOnlyMode && isWaiting && (
            <Button onClick={handleStartJob} className="bg-green-600 hover:bg-green-700">
              Start Job
            </Button>
          )}
          {!viewOnlyMode && isInProgress && (
            <>
              <Button onClick={handlePauseJob} className="bg-yellow-600 hover:bg-yellow-700">
                Pause Job
              </Button>
              <Button onClick={handleCompleteJob} className="bg-blue-600 hover:bg-blue-700">
                Complete Job
              </Button>
            </>
          )}
          {!viewOnlyMode && isPaused && (
            <Button onClick={handleResumeJob} className="bg-green-600 hover:bg-green-700">
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
                  <div className="grid grid-cols-1 gap-4 p-4 bg-blue-50 rounded-lg">
                    <Button onClick={() => {}} className="w-full bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Checklist
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  {jobChecklists.map((checklist) => (
                    <div key={checklist.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <div>
                        <span className="font-medium">{checklist.name}</span>
                        <span className="ml-2 text-sm text-gray-600">{checklist.description}</span>
                      </div>
                      {!viewOnlyMode && (
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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
                        onChange={(e) => setNewSheetMaterialType(e.target.value)}
                        placeholder="e.g., Wood, Metal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sheet-qty">Quantity</Label>
                      <Input
                        id="sheet-qty"
                        type="number"
                        value={newSheetQty}
                        onChange={(e) => setNewSheetQty(e.target.value)}
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
                <CardTitle className="text-lg text-orange-700">Job Hardware</CardTitle>
                <CardDescription>Hardware inventory tracking for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!viewOnlyMode && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50 rounded-lg">
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
                        onChange={(e) => setNewHardwareAllocated(e.target.value)}
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
                    <div className="col-span-2">
                      <Label htmlFor="hardware-still-required">Still Required</Label>
                      <Input
                        id="hardware-still-required"
                        type="number"
                        value={newHardwareStillRequired}
                        onChange={(e) => setNewHardwareStillRequired(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button onClick={handleAddHardware} className="w-full bg-orange-600 hover:bg-orange-700">
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
                        <span className="font-medium">{hardware.supply?.name || "Unknown Hardware"}</span>
                        {!viewOnlyMode && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteHardware(hardware.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-sm text-gray-600">
                        <div>On Hand: <span className="font-medium text-gray-800">{hardware.onHand}</span></div>
                        <div>Available: <span className="font-medium text-gray-800">{hardware.available}</span></div>
                        <div>Allocated: <span className="font-medium text-orange-600">{hardware.allocated}</span></div>
                        <div>Used: <span className="font-medium text-green-600">{hardware.used}</span></div>
                        <div>Still Req: <span className="font-medium text-red-600">{hardware.stillRequired}</span></div>
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
                {!viewOnlyMode && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg">
                    <div>
                      <Label htmlFor="rod-name">Rod Name</Label>
                      <Input
                        id="rod-name"
                        value={newRodName}
                        onChange={(e) => setNewRodName(e.target.value)}
                        placeholder="e.g., Closet Rod"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rod-length">Length (inches)</Label>
                      <Input
                        id="rod-length"
                        value={newRodLength}
                        onChange={(e) => setNewRodLength(e.target.value)}
                        placeholder="e.g., 48"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button onClick={handleAddRod} className="w-full bg-green-600 hover:bg-green-700">
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
                <CardTitle className="text-lg text-gray-700">Import Job Data</CardTitle>
                <CardDescription>Upload CSV or Excel files to import job data</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowImportDialog(true)} className="w-full bg-gray-600 hover:bg-gray-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle>Import Job Data</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-category">Category</Label>
                <Select value={importCategory} onValueChange={(value) => setImportCategory(value as "sheets" | "hardware" | "rods")}>
                  <SelectTrigger>
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
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
                <p><strong>Expected columns for {importCategory}:</strong></p>
                {importCategory === "sheets" && <p>materialtype, qty</p>}
                {importCategory === "hardware" && <p>hardwarename, allocated, used, stillrequired</p>}
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

export default JobDetailsModal
