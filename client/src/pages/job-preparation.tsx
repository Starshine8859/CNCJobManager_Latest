"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react"
import Layout from "@/components/layout"

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  addedAt: Date
}

export default function JobPreparation() {
  const [activeTab, setActiveTab] = useState("sheets")
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [newItemText, setNewItemText] = useState("")

  // Add new checklist item
  const addChecklistItem = () => {
    if (newItemText.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newItemText.trim(),
        completed: false,
        addedAt: new Date(),
      }
      setChecklistItems([...checklistItems, newItem])
      setNewItemText("")
    }
  }

  // Toggle checklist item completion
  const toggleChecklistItem = (id: string) => {
    setChecklistItems((items) => items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)))
  }

  // Remove checklist item
  const removeChecklistItem = (id: string) => {
    setChecklistItems((items) => items.filter((item) => item.id !== id))
  }

  // Get completed and pending items
  const completedItems = checklistItems.filter((item) => item.completed)
  const pendingItems = checklistItems.filter((item) => !item.completed)

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Job Preparation</h1>
          <p className="text-gray-600">Manage sheets, hardware, rods, and preparation checklist</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sheets">Sheets</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="rods">Rods</TabsTrigger>
            <TabsTrigger value="checklist">Part Checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="sheets" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Sheet Management</CardTitle>
                <CardDescription>Manage sheet materials and specifications for CNC jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="sheet-material">Material Type</Label>
                      <Input id="sheet-material" placeholder="e.g., Aluminum, Steel, Plastic" />
                    </div>
                    <div>
                      <Label htmlFor="sheet-thickness">Thickness (mm)</Label>
                      <Input id="sheet-thickness" type="number" placeholder="e.g., 3.0" />
                    </div>
                    <div>
                      <Label htmlFor="sheet-dimensions">Dimensions (mm)</Label>
                      <Input id="sheet-dimensions" placeholder="e.g., 1000x500" />
                    </div>
                  </div>
                  <Button>Add Sheet Specification</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hardware" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Hardware Management</CardTitle>
                <CardDescription>Track bolts, screws, fasteners, and other hardware components</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="hardware-type">Hardware Type</Label>
                      <Input id="hardware-type" placeholder="e.g., Bolt, Screw, Washer" />
                    </div>
                    <div>
                      <Label htmlFor="hardware-size">Size/Thread</Label>
                      <Input id="hardware-size" placeholder="e.g., M6x20, #10-32" />
                    </div>
                    <div>
                      <Label htmlFor="hardware-material">Material</Label>
                      <Input id="hardware-material" placeholder="e.g., Stainless Steel" />
                    </div>
                    <div>
                      <Label htmlFor="hardware-quantity">Quantity</Label>
                      <Input id="hardware-quantity" type="number" placeholder="e.g., 10" />
                    </div>
                  </div>
                  <Button>Add Hardware Item</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rods" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Rod Management</CardTitle>
                <CardDescription>Manage rod materials, dimensions, and specifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="rod-material">Rod Material</Label>
                      <Input id="rod-material" placeholder="e.g., Steel, Aluminum, Brass" />
                    </div>
                    <div>
                      <Label htmlFor="rod-diameter">Diameter (mm)</Label>
                      <Input id="rod-diameter" type="number" placeholder="e.g., 12.0" />
                    </div>
                    <div>
                      <Label htmlFor="rod-length">Length (mm)</Label>
                      <Input id="rod-length" type="number" placeholder="e.g., 500" />
                    </div>
                    <div>
                      <Label htmlFor="rod-finish">Surface Finish</Label>
                      <Input id="rod-finish" placeholder="e.g., Polished, Anodized" />
                    </div>
                  </div>
                  <Button>Add Rod Specification</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Add New Item */}
              <Card>
                <CardHeader>
                  <CardTitle>Add Checklist Item</CardTitle>
                  <CardDescription>Add preparation tasks and requirements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-item">Task Description</Label>
                      <Input
                        id="new-item"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="e.g., Check tool calibration, Verify material stock"
                        onKeyPress={(e) => e.key === "Enter" && addChecklistItem()}
                      />
                    </div>
                    <Button onClick={addChecklistItem} disabled={!newItemText.trim()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Checklist Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Checklist Summary</CardTitle>
                  <CardDescription>Track your preparation progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Items</span>
                      <Badge variant="secondary">{checklistItems.length}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Completed</span>
                      <Badge variant="default" className="bg-green-100 text-green-700">
                        {completedItems.length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pending</span>
                      <Badge variant="outline">{pendingItems.length}</Badge>
                    </div>
                    {checklistItems.length > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${(completedItems.length / checklistItems.length) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pending Items */}
            {pendingItems.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Circle className="h-5 w-5 mr-2 text-orange-500" />
                    Pending Tasks ({pendingItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Checkbox checked={item.completed} onCheckedChange={() => toggleChecklistItem(item.id)} />
                          <span className="text-sm">{item.text}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChecklistItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completed Items */}
            {completedItems.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                    Completed Tasks ({completedItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {completedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-green-50"
                      >
                        <div className="flex items-center space-x-3">
                          <Checkbox checked={item.completed} onCheckedChange={() => toggleChecklistItem(item.id)} />
                          <span className="text-sm line-through text-gray-600">{item.text}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChecklistItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {checklistItems.length === 0 && (
              <Card className="mt-6">
                <CardContent className="text-center py-12">
                  <Circle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No checklist items yet</h3>
                  <p className="text-gray-600 mb-4">Add your first preparation task to get started</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
