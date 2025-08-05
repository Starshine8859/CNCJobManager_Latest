import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Search, Plus, Edit, Trash2, Upload, X, Save, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";
import { TextureSwatch } from "@/components/ui/texture-swatch";

interface Supply {
  id: number;
  name: string;
  hexColor: string;
  pieceSize: string;
  quantityOnHand: number;
  available: number;
  allocated: number;
  used: number;
  location: {
    id: number;
    name: string;
  } | null;
  vendorId?: number;
  defaultVendor?: string;
  defaultVendorPrice?: number;
  texture: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Location {
  id: number;
  name: string;
}



export default function Supplies() {
  const [currentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [supplyToDelete, setSupplyToDelete] = useState<Supply | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states for add/edit supply
  const [supplyForm, setSupplyForm] = useState({
    name: "",
    hexColor: "#000000",
    pieceSize: "sheet",
    quantityOnHand: 0,
    locationId: undefined as number | undefined,
    defaultVendor: "",
    defaultVendorPrice: undefined as number | undefined,
    texture: null as string | null
  });

  // Form states for edit supply
  const [editSupplyForm, setEditSupplyForm] = useState({
    name: "",
    hexColor: "#000000",
    pieceSize: "sheet",
    quantityOnHand: 0,
    locationId: undefined as number | undefined,
    defaultVendor: "",
    defaultVendorPrice: undefined as number | undefined,
    texture: null as string | null
  });

  // Fetch supplies
  const { data: supplies = [], isLoading: suppliesLoading } = useQuery({
    queryKey: ["supplies", searchTerm],
    queryFn: async () => {
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const response = await fetch(`/api/supplies${params}`);
      if (!response.ok) throw new Error("Failed to fetch supplies");
      return response.json();
    }
  });

  // Fetch locations
  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await fetch("/api/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    }
  });

  // Fetch vendors - temporarily disabled to fix blue screen
  const { data: vendors = [], isLoading: vendorsLoading, error: vendorsError } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      // Temporarily return empty array to prevent blue screen
      console.log('Vendors query disabled - returning empty array');
      return [];
    },
    retry: false
  });

  // Debug logging
  console.log('Supplies component rendered');
  console.log('showAddDialog:', showAddDialog);
  console.log('suppliesLoading:', suppliesLoading);
  console.log('locationsLoading:', locationsLoading);
  console.log('vendorsLoading:', vendorsLoading);
  console.log('supplies:', supplies);
  console.log('locations:', locations);
  console.log('vendors:', vendors);

  // Create supply mutation
  const createSupplyMutation = useMutation({
    mutationFn: async (supplyData: any) => {
      const response = await fetch("/api/supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplyData)
      });
      if (!response.ok) throw new Error("Failed to create supply");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
      setShowAddDialog(false);
      resetSupplyForm();
      toast({
        title: "Success",
        description: "Supply created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update supply mutation
  const updateSupplyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/supplies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to update supply");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
      setShowEditDialog(false);
      setEditingSupply(null);
      resetEditSupplyForm();
      toast({
        title: "Success",
        description: "Supply updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete supply mutation
  const deleteSupplyMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/supplies/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete supply");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
      setSupplyToDelete(null);
      toast({
        title: "Success",
        description: "Supply deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error("Failed to create location");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setShowLocationDialog(false);
      setNewLocationName("");
      toast({
        title: "Success",
        description: "Location created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Upload texture mutation
  const uploadTextureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("texture", file);
      const response = await fetch("/api/upload-texture", {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error("Failed to upload texture");
      const result = await response.json();
      return result.filename;
    },
    onSuccess: (filename) => {
      setSupplyForm(prev => ({ ...prev, texture: filename }));
      setEditSupplyForm(prev => ({ ...prev, texture: filename }));
      toast({
        title: "Success",
        description: "Texture uploaded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resetSupplyForm = () => {
    setSupplyForm({
      name: "",
      hexColor: "#000000",
      pieceSize: "sheet",
      quantityOnHand: 0,
      locationId: undefined,
      defaultVendor: "",
      defaultVendorPrice: undefined,
      texture: null
    });
  };

  const resetEditSupplyForm = () => {
    setEditSupplyForm({
      name: "",
      hexColor: "#000000",
      pieceSize: "sheet",
      quantityOnHand: 0,
      locationId: undefined,
      defaultVendor: "",
      defaultVendorPrice: undefined,
      texture: null
    });
  };

  const handleAddSupply = () => {
    console.log('Submitting supply form:', supplyForm);
    createSupplyMutation.mutate(supplyForm);
  };

  const handleEditSupply = () => {
    if (!editingSupply) return;
    updateSupplyMutation.mutate({
      id: editingSupply.id,
      data: editSupplyForm
    });
  };

  const handleDeleteSupply = () => {
    if (!supplyToDelete) return;
    deleteSupplyMutation.mutate(supplyToDelete.id);
  };

  const handleCreateLocation = () => {
    if (!newLocationName.trim()) return;
    createLocationMutation.mutate(newLocationName.trim());
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadTextureMutation.mutate(file);
    }
  };

  const clearTexture = (isEdit = false) => {
    if (isEdit) {
      setEditSupplyForm(prev => ({ ...prev, texture: null }));
    } else {
      setSupplyForm(prev => ({ ...prev, texture: null }));
    }
  };

  const openEditDialog = (supply: Supply) => {
    setEditingSupply(supply);
    setEditSupplyForm({
      name: supply.name,
      hexColor: supply.hexColor,
      pieceSize: supply.pieceSize,
      quantityOnHand: supply.quantityOnHand,
      locationId: supply.location?.id,
      defaultVendor: supply.defaultVendor || "",
      defaultVendorPrice: supply.defaultVendorPrice,
      texture: supply.texture
    });
    setShowEditDialog(true);
  };

  const filteredSupplies = supplies.filter((supply: Supply) =>
    supply.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout currentTime={currentTime}>
      <div className="flex h-screen bg-gray-50">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <nav className="text-sm text-gray-500 mb-2">
                  <span>Home / Inventory / Supplies</span>
                </nav>
                <h1 className="text-2xl font-bold text-gray-900">Supplies Management</h1>
              </div>
              <div className="flex items-center space-x-4">
                <Dialog open={showAddDialog} onOpenChange={(open) => {
                  console.log('Dialog onOpenChange:', open);
                  setShowAddDialog(open);
                }}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      console.log('Add Supply button clicked');
                      setShowAddDialog(true);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Supply
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Supply</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Debug info */}
                      <div className="text-sm text-gray-500">
                        Debug: Dialog opened successfully
                      </div>
                      
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={supplyForm.name}
                          onChange={(e) => setSupplyForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Supply name"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="hexColor">Color</Label>
                        <Input
                          id="hexColor"
                          type="color"
                          value={supplyForm.hexColor}
                          onChange={(e) => setSupplyForm(prev => ({ ...prev, hexColor: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="pieceSize">Piece Size</Label>
                        <Select value={supplyForm.pieceSize} onValueChange={(value) => setSupplyForm(prev => ({ ...prev, pieceSize: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sheet">Sheet</SelectItem>
                            <SelectItem value="piece">Piece</SelectItem>
                            <SelectItem value="pair">Pair</SelectItem>
                            <SelectItem value="roll">Roll</SelectItem>
                            <SelectItem value="box">Box</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="quantityOnHand">Quantity on Hand</Label>
                        <Input
                          id="quantityOnHand"
                          type="number"
                          value={supplyForm.quantityOnHand}
                          onChange={(e) => setSupplyForm(prev => ({ ...prev, quantityOnHand: parseInt(e.target.value) || 0 }))}
                        />
                      </div>

                      <div>
                        <Label htmlFor="location">Location</Label>
                        <Select value={supplyForm.locationId?.toString() || ""} onValueChange={(value) => setSupplyForm(prev => ({ ...prev, locationId: value ? parseInt(value) : undefined }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((location: Location) => (
                              <SelectItem key={location.id} value={location.id.toString()}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="defaultVendor">Default Vendor</Label>
                        <Input
                          id="defaultVendor"
                          value={supplyForm.defaultVendor || ""}
                          onChange={(e) => setSupplyForm(prev => ({ ...prev, defaultVendor: e.target.value }))}
                          placeholder="Enter vendor name (optional)"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="defaultVendorPrice">Default Vendor Price ($)</Label>
                        <Input
                          id="defaultVendorPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          value={supplyForm.defaultVendorPrice ? (supplyForm.defaultVendorPrice / 100).toFixed(2) : ""}
                          onChange={(e) => setSupplyForm(prev => ({ 
                            ...prev, 
                            defaultVendorPrice: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined 
                          }))}
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <Label>Texture Image</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, false)}
                          />
                          {supplyForm.texture && (
                            <Button variant="outline" size="sm" onClick={() => clearTexture(false)}>
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {supplyForm.texture && (
                          <div className="mt-2">
                            <img src={`/uploads/${supplyForm.texture}`} alt="Texture" className="w-16 h-16 object-cover rounded border" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddSupply} disabled={createSupplyMutation.isPending}>
                          {createSupplyMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Location</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="locationName">Location Name</Label>
                        <Input
                          id="locationName"
                          value={newLocationName}
                          onChange={(e) => setNewLocationName(e.target.value)}
                          placeholder="Location name"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateLocation} disabled={createLocationMutation.isPending}>
                          {createLocationMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search supplies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Supplies List */}
          <div className="flex-1 overflow-auto p-6">
            {suppliesLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading supplies...</div>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredSupplies.map((supply: Supply) => (
                  <Card key={supply.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <TextureSwatch
                            texture={supply.texture ? `/uploads/${supply.texture}` : null}
                            hexColor={supply.hexColor}
                            name={supply.name}
                            size="lg"
                          />
                          <div>
                            <h3 className="text-lg font-semibold">{supply.name}</h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>Piece Size: {supply.pieceSize}</span>
                              <span>Location: {supply.location?.name || "None"}</span>
                            </div>
                            <div className="flex items-center space-x-4 text-sm mt-1">
                              <Badge variant="outline">On Hand: {supply.quantityOnHand}</Badge>
                              <Badge variant="outline">Available: {supply.available}</Badge>
                              <Badge variant="outline">Allocated: {supply.allocated}</Badge>
                              <Badge variant="outline">Used: {supply.used}</Badge>

                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(supply)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSupplyToDelete(supply)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Supply</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{supply.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setSupplyToDelete(null)}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSupply}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredSupplies.length === 0 && !suppliesLoading && (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No supplies found</h3>
                    <p className="text-gray-500">Get started by adding your first supply.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Supply Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Supply</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editSupplyForm.name}
                onChange={(e) => setEditSupplyForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Supply name"
              />
            </div>
            <div>
              <Label htmlFor="editHexColor">Color</Label>
              <Input
                id="editHexColor"
                type="color"
                value={editSupplyForm.hexColor}
                onChange={(e) => setEditSupplyForm(prev => ({ ...prev, hexColor: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="editPieceSize">Piece Size</Label>
              <Select value={editSupplyForm.pieceSize} onValueChange={(value) => setEditSupplyForm(prev => ({ ...prev, pieceSize: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sheet">Sheet</SelectItem>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="pair">Pair</SelectItem>
                  <SelectItem value="roll">Roll</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editQuantityOnHand">Quantity on Hand</Label>
              <Input
                id="editQuantityOnHand"
                type="number"
                value={editSupplyForm.quantityOnHand}
                onChange={(e) => setEditSupplyForm(prev => ({ ...prev, quantityOnHand: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <Label htmlFor="editLocation">Location</Label>
              <Select value={editSupplyForm.locationId?.toString() || ""} onValueChange={(value) => setEditSupplyForm(prev => ({ ...prev, locationId: value ? parseInt(value) : undefined }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location: Location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editDefaultVendor">Default Vendor</Label>
                                      <Input
                          id="editDefaultVendor"
                          value={editSupplyForm.defaultVendor || ""}
                          onChange={(e) => setEditSupplyForm(prev => ({ ...prev, defaultVendor: e.target.value }))}
                          placeholder="Enter vendor name (optional)"
                        />
            </div>
            <div>
              <Label htmlFor="editDefaultVendorPrice">Default Vendor Price ($)</Label>
              <Input
                id="editDefaultVendorPrice"
                type="number"
                min="0"
                step="0.01"
                value={editSupplyForm.defaultVendorPrice ? (editSupplyForm.defaultVendorPrice / 100).toFixed(2) : ""}
                onChange={(e) => setEditSupplyForm(prev => ({ 
                  ...prev, 
                  defaultVendorPrice: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined 
                }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Texture Image</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, true)}
                />
                {editSupplyForm.texture && (
                  <Button variant="outline" size="sm" onClick={() => clearTexture(true)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {editSupplyForm.texture && (
                <div className="mt-2">
                  <img src={`/uploads/${editSupplyForm.texture}`} alt="Texture" className="w-16 h-16 object-cover rounded border" />
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSupply} disabled={updateSupplyMutation.isPending}>
                {updateSupplyMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
} 