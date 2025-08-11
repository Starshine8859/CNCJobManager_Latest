import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Minus, ArrowRight, Settings, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";

interface Supply {
  id: number;
  name: string;
  hexColor: string;
  pieceSize: string;
}

interface Location {
  id: number;
  name: string;
}

interface InventoryMovement {
  id: number;
  supplyId: number;
  fromLocationId?: number;
  toLocationId?: number;
  quantity: number;
  movementType: 'check_in' | 'check_out' | 'transfer' | 'adjust';
  referenceType?: string;
  referenceId?: number;
  notes?: string;
  createdAt: string;
  supply: {
    id: number;
    name: string;
    hexColor: string;
  };
  fromLocation?: {
    id: number;
    name: string;
  };
  toLocation?: {
    id: number;
    name: string;
  };
}

export default function InventoryMovements() {
  const [currentTime] = useState(new Date());
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [checkInForm, setCheckInForm] = useState({
    supplyId: "",
    locationId: "",
    quantity: 1,
    referenceType: "",
    referenceId: "",
    notes: ""
  });

  const [checkOutForm, setCheckOutForm] = useState({
    supplyId: "",
    locationId: "",
    quantity: 1,
    referenceType: "",
    referenceId: "",
    notes: ""
  });

  const [transferForm, setTransferForm] = useState({
    supplyId: "",
    fromLocationId: "",
    toLocationId: "",
    quantity: 1,
    notes: ""
  });

  const [adjustForm, setAdjustForm] = useState({
    supplyId: "",
    locationId: "",
    quantity: 0,
    notes: ""
  });

  // Fetch data
  const { data: supplies = [], isLoading: suppliesLoading } = useQuery({
    queryKey: ["supplies"],
    queryFn: async () => {
      const response = await fetch("/api/supplies", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch supplies");
      return response.json();
    }
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await fetch("/api/locations", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    }
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: async () => {
      const response = await fetch("/api/inventory/movements", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch movements");
      return response.json();
    }
  });

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/inventory/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to check in inventory");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Inventory checked in successfully" });
      setShowCheckInDialog(false);
      setCheckInForm({ supplyId: "", locationId: "", quantity: 1, referenceType: "", referenceId: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/inventory/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to check out inventory");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Inventory checked out successfully" });
      setShowCheckOutDialog(false);
      setCheckOutForm({ supplyId: "", locationId: "", quantity: 1, referenceType: "", referenceId: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const transferMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to transfer inventory");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Inventory transferred successfully" });
      setShowTransferDialog(false);
      setTransferForm({ supplyId: "", fromLocationId: "", toLocationId: "", quantity: 1, notes: "" });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to adjust inventory");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Inventory adjusted successfully" });
      setShowAdjustDialog(false);
      setAdjustForm({ supplyId: "", locationId: "", quantity: 0, notes: "" });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleCheckIn = () => {
    if (!checkInForm.supplyId || !checkInForm.locationId || checkInForm.quantity <= 0) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    checkInMutation.mutate({
      supplyId: parseInt(checkInForm.supplyId),
      locationId: parseInt(checkInForm.locationId),
      quantity: checkInForm.quantity,
      referenceType: checkInForm.referenceType || undefined,
      referenceId: checkInForm.referenceId ? parseInt(checkInForm.referenceId) : undefined,
      notes: checkInForm.notes || undefined
    });
  };

  const handleCheckOut = () => {
    if (!checkOutForm.supplyId || !checkOutForm.locationId || checkOutForm.quantity <= 0) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    checkOutMutation.mutate({
      supplyId: parseInt(checkOutForm.supplyId),
      locationId: parseInt(checkOutForm.locationId),
      quantity: checkOutForm.quantity,
      referenceType: checkOutForm.referenceType || undefined,
      referenceId: checkOutForm.referenceId ? parseInt(checkOutForm.referenceId) : undefined,
      notes: checkOutForm.notes || undefined
    });
  };

  const handleTransfer = () => {
    if (!transferForm.supplyId || !transferForm.fromLocationId || !transferForm.toLocationId || transferForm.quantity <= 0) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    transferMutation.mutate({
      supplyId: parseInt(transferForm.supplyId),
      fromLocationId: parseInt(transferForm.fromLocationId),
      toLocationId: parseInt(transferForm.toLocationId),
      quantity: transferForm.quantity,
      notes: transferForm.notes || undefined
    });
  };

  const handleAdjust = () => {
    if (!adjustForm.supplyId || !adjustForm.locationId) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    adjustMutation.mutate({
      supplyId: parseInt(adjustForm.supplyId),
      locationId: parseInt(adjustForm.locationId),
      quantity: adjustForm.quantity,
      notes: adjustForm.notes || undefined
    });
  };

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case 'check_in': return <Plus className="w-4 h-4 text-green-600" />;
      case 'check_out': return <Minus className="w-4 h-4 text-red-600" />;
      case 'transfer': return <ArrowRight className="w-4 h-4 text-blue-600" />;
      case 'adjust': return <Settings className="w-4 h-4 text-orange-600" />;
      default: return <Package className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'check_in': return 'Check In';
      case 'check_out': return 'Check Out';
      case 'transfer': return 'Transfer';
      case 'adjust': return 'Adjustment';
      default: return type;
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'check_in': return 'bg-green-100 text-green-800 border-green-200';
      case 'check_out': return 'bg-red-100 text-red-800 border-red-200';
      case 'transfer': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'adjust': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Layout currentTime={currentTime}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Inventory Movements</h1>
                <p className="mt-1 text-sm text-gray-500">Manage inventory check-in, check-out, transfers, and adjustments</p>
              </div>
              <div className="flex space-x-3">
                <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Check In
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Check In Inventory</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="checkin-supply">Supply</Label>
                        <Select value={checkInForm.supplyId} onValueChange={(value) => setCheckInForm(prev => ({ ...prev, supplyId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supply" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplies.map((supply: Supply) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="checkin-location">Location</Label>
                        <Select value={checkInForm.locationId} onValueChange={(value) => setCheckInForm(prev => ({ ...prev, locationId: value }))}>
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
                        <Label htmlFor="checkin-quantity">Quantity</Label>
                        <Input
                          id="checkin-quantity"
                          type="number"
                          min="1"
                          value={checkInForm.quantity}
                          onChange={(e) => setCheckInForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="checkin-notes">Notes (Optional)</Label>
                        <Textarea
                          id="checkin-notes"
                          value={checkInForm.notes}
                          onChange={(e) => setCheckInForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add any notes about this check-in..."
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowCheckInDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCheckIn} disabled={checkInMutation.isPending}>
                          {checkInMutation.isPending ? "Checking In..." : "Check In"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                      <Minus className="w-4 h-4 mr-2" />
                      Check Out
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Check Out Inventory</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="checkout-supply">Supply</Label>
                        <Select value={checkOutForm.supplyId} onValueChange={(value) => setCheckOutForm(prev => ({ ...prev, supplyId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supply" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplies.map((supply: Supply) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="checkout-location">Location</Label>
                        <Select value={checkOutForm.locationId} onValueChange={(value) => setCheckOutForm(prev => ({ ...prev, locationId: value }))}>
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
                        <Label htmlFor="checkout-quantity">Quantity</Label>
                        <Input
                          id="checkout-quantity"
                          type="number"
                          min="1"
                          value={checkOutForm.quantity}
                          onChange={(e) => setCheckOutForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="checkout-notes">Notes (Optional)</Label>
                        <Textarea
                          id="checkout-notes"
                          value={checkOutForm.notes}
                          onChange={(e) => setCheckOutForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add any notes about this check-out..."
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowCheckOutDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCheckOut} disabled={checkOutMutation.isPending}>
                          {checkOutMutation.isPending ? "Checking Out..." : "Check Out"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Transfer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Transfer Inventory</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="transfer-supply">Supply</Label>
                        <Select value={transferForm.supplyId} onValueChange={(value) => setTransferForm(prev => ({ ...prev, supplyId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supply" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplies.map((supply: Supply) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="transfer-from">From Location</Label>
                        <Select value={transferForm.fromLocationId} onValueChange={(value) => setTransferForm(prev => ({ ...prev, fromLocationId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source location" />
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
                        <Label htmlFor="transfer-to">To Location</Label>
                        <Select value={transferForm.toLocationId} onValueChange={(value) => setTransferForm(prev => ({ ...prev, toLocationId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination location" />
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
                        <Label htmlFor="transfer-quantity">Quantity</Label>
                        <Input
                          id="transfer-quantity"
                          type="number"
                          min="1"
                          value={transferForm.quantity}
                          onChange={(e) => setTransferForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="transfer-notes">Notes (Optional)</Label>
                        <Textarea
                          id="transfer-notes"
                          value={transferForm.notes}
                          onChange={(e) => setTransferForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add any notes about this transfer..."
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleTransfer} disabled={transferMutation.isPending}>
                          {transferMutation.isPending ? "Transferring..." : "Transfer"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
                      <Settings className="w-4 h-4 mr-2" />
                      Adjust
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Adjust Inventory</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="adjust-supply">Supply</Label>
                        <Select value={adjustForm.supplyId} onValueChange={(value) => setAdjustForm(prev => ({ ...prev, supplyId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supply" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplies.map((supply: Supply) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="adjust-location">Location</Label>
                        <Select value={adjustForm.locationId} onValueChange={(value) => setAdjustForm(prev => ({ ...prev, locationId: value }))}>
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
                        <Label htmlFor="adjust-quantity">Adjustment Quantity (+/-)</Label>
                        <Input
                          id="adjust-quantity"
                          type="number"
                          value={adjustForm.quantity}
                          onChange={(e) => setAdjustForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                          placeholder="Enter positive or negative number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="adjust-notes">Notes (Optional)</Label>
                        <Textarea
                          id="adjust-notes"
                          value={adjustForm.notes}
                          onChange={(e) => setAdjustForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add any notes about this adjustment..."
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAdjust} disabled={adjustMutation.isPending}>
                          {adjustMutation.isPending ? "Adjusting..." : "Adjust"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Movement History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Movement History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movementsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading movements...</p>
                </div>
              ) : movements.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No inventory movements yet</p>
                  <p className="text-sm text-gray-500 mt-1">Start by checking in or checking out some inventory</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {movements.map((movement: InventoryMovement) => (
                    <div key={movement.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                      <div className="flex items-center space-x-4">
                        {getMovementTypeIcon(movement.movementType)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{movement.supply.name}</span>
                            <Badge className={getMovementTypeColor(movement.movementType)}>
                              {getMovementTypeLabel(movement.movementType)}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {movement.movementType === 'transfer' ? (
                              <>
                                {movement.fromLocation?.name} → {movement.toLocation?.name}
                              </>
                            ) : movement.movementType === 'check_in' ? (
                              `To: ${movement.toLocation?.name}`
                            ) : movement.movementType === 'check_out' ? (
                              `From: ${movement.fromLocation?.name}`
                            ) : (
                              `Location: ${movement.toLocation?.name}`
                            )}
                          </div>
                          {movement.notes && (
                            <div className="text-sm text-gray-500 mt-1">
                              {movement.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{movement.quantity}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(movement.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
} 