import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Mail, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";

interface Supply {
  id: number;
  name: string;
  hexColor: string;
  pieceSize: string;
  retailPrice: number;
}

interface Location {
  id: number;
  name: string;
}

interface Vendor {
  id: number;
  name: string;
  company: string;
  email: string;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  status: string;
  dateOrdered: string;
  expectedDeliveryDate: string;
  dateReceived: string;
  totalAmount: number;
  additionalComments: string;
  createdAt: string;
  items: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
  id: number;
  supplyId: number;
  vendorId: number;
  locationId: number;
  neededQuantity: number;
  orderQuantity: number;
  receivedQuantity: number;
  pricePerUnit: number;
  totalPrice: number;
  supply: Supply;
  location: Location;
}

export default function EnhancedPurchaseOrders() {
  const [currentTime] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailPoId, setEmailPoId] = useState<number | null>(null);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", bcc: "", subject: "", message: "" });

  // Form states
  const [createForm, setCreateForm] = useState({
    vendorId: "",
    expectedDeliveryDate: "",
    notes: "",
    items: [] as any[],
    sendEmail: false
  });

  const [receiveForm, setReceiveForm] = useState({
    dateReceived: new Date().toISOString().split('T')[0],
    items: [] as any[]
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

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const response = await fetch("/api/vendors", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch vendors");
      return response.json();
    }
  });

  const { data: purchaseOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const response = await fetch("/api/purchase-orders", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch purchase orders");
      return response.json();
    }
  });

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to create purchase order");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Purchase order created successfully" });
      setShowCreateDialog(false);
      setCreateForm({ vendorId: "", expectedDeliveryDate: "", notes: "", items: [], sendEmail: false });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!emailPoId) throw new Error("Missing PO");
      const res = await fetch(`/api/purchase-orders/${emailPoId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(emailForm)
      });
      if (!res.ok) throw new Error("Failed to send email");
      return res.json();
    },
    onSuccess: () => {
      setEmailOpen(false);
      toast({ title: "Email sent", description: "Purchase order email sent successfully" });
    },
    onError: (err: any) => toast({ title: "Email failed", description: err?.message || "Could not send email", variant: "destructive" })
  });

  const receiveOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/purchase-orders/${selectedOrder?.id}/receive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to receive purchase order");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Purchase order received successfully" });
      setShowReceiveDialog(false);
      setSelectedOrder(null);
      setReceiveForm({ dateReceived: new Date().toISOString().split('T')[0], items: [] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const addItemToForm = () => {
    setCreateForm(prev => ({
      ...prev,
      items: [...prev.items, {
        supplyId: "",
        vendorId: "",
        locationId: "",
        neededQuantity: 1,
        orderQuantity: 1,
        pricePerUnit: 0
      }]
    }));
  };

  const removeItemFromForm = (index: number) => {
    setCreateForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItemInForm = (index: number, field: string, value: any) => {
    setCreateForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleCreateOrder = () => {
    if (!createForm.vendorId || createForm.items.length === 0) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    // Validate items
    const validItems = createForm.items.every(item => 
      item.supplyId && item.vendorId && item.locationId && item.orderQuantity > 0 && item.pricePerUnit >= 0
    );
    
    if (!validItems) {
      toast({ title: "Error", description: "Please fill in all item details", variant: "destructive" });
      return;
    }
    
    createOrderMutation.mutate({
      orderData: {
        vendorId: parseInt(createForm.vendorId),
        expectedDeliveryDate: createForm.expectedDeliveryDate || null,
        notes: createForm.notes
      },
      items: createForm.items.map(item => ({
        ...item,
        supplyId: parseInt(item.supplyId),
        vendorId: parseInt(item.vendorId),
        locationId: parseInt(item.locationId),
        neededQuantity: parseInt(item.neededQuantity),
        orderQuantity: parseInt(item.orderQuantity),
        pricePerUnit: parseFloat(item.pricePerUnit)
      }))
    });
  };

  const handleReceiveOrder = () => {
    if (!selectedOrder) return;
    
    receiveOrderMutation.mutate({
      dateReceived: receiveForm.dateReceived
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4 text-gray-600" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'ordered': return <Package className="w-4 h-4 text-blue-600" />;
      case 'received': return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ordered': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'received': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100); // Assuming amount is in cents
  };

  return (
    <Layout currentTime={currentTime}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Enhanced Purchase Orders</h1>
                <p className="mt-1 text-sm text-gray-500">Manage purchase orders with advanced features</p>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Purchase Order
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Create Purchase Order</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vendor">Vendor</Label>
                        <Select value={createForm.vendorId} onValueChange={(value) => setCreateForm(prev => ({ ...prev, vendorId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((vendor: Vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                {vendor.company} - {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="delivery-date">Expected Delivery Date</Label>
                        <Input
                          id="delivery-date"
                          type="date"
                          value={createForm.expectedDeliveryDate}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={createForm.notes}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add any notes about this purchase order..."
                      />
                    </div>
                    
                    {/* Items Section */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label>Order Items</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addItemToForm}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                      
                      <div className="space-y-4">
                        {createForm.items.map((item, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="font-medium">Item {index + 1}</h4>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeItemFromForm(index)}
                              >
                                Remove
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Supply</Label>
                                <Select 
                                  value={item.supplyId} 
                                  onValueChange={(value) => updateItemInForm(index, 'supplyId', value)}
                                >
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
                                <Label>Location</Label>
                                <Select 
                                  value={item.locationId} 
                                  onValueChange={(value) => updateItemInForm(index, 'locationId', value)}
                                >
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
                                <Label>Needed Quantity</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.neededQuantity}
                                  onChange={(e) => updateItemInForm(index, 'neededQuantity', parseInt(e.target.value) || 0)}
                                />
                              </div>
                              <div>
                                <Label>Order Quantity</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.orderQuantity}
                                  onChange={(e) => updateItemInForm(index, 'orderQuantity', parseInt(e.target.value) || 0)}
                                />
                              </div>
                              <div>
                                <Label>Price Per Unit ($)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.pricePerUnit}
                                  onChange={(e) => updateItemInForm(index, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                                />
                              </div>
                              <div>
                                <Label>Total Price</Label>
                                <Input
                                  type="text"
                                  value={formatCurrency((item.orderQuantity || 0) * (item.pricePerUnit || 0) * 100)}
                                  disabled
                                  className="bg-gray-50"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateOrder} disabled={createOrderMutation.isPending}>
                        {createOrderMutation.isPending ? "Creating..." : "Create Order"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Purchase Orders List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Purchase Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading purchase orders...</p>
                </div>
              ) : purchaseOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No purchase orders yet</p>
                  <p className="text-sm text-gray-500 mt-1">Create your first purchase order to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {purchaseOrders.map((order: PurchaseOrder) => (
                    <div key={order.id} className="border rounded-lg p-6 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          {getStatusIcon(order.status)}
                          <div>
                            <h3 className="text-lg font-medium">{order.poNumber}</h3>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={getStatusColor(order.status)}>
                                {order.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                Created {new Date(order.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-medium">{formatCurrency(order.totalAmount)}</div>
                          <div className="text-sm text-gray-500">
                            {order.items.length} items
                          </div>
                        </div>
                      </div>
                      
                      {order.items.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Supply</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Needed</TableHead>
                              <TableHead>Ordered</TableHead>
                              <TableHead>Received</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {order.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <div 
                                      className="w-4 h-4 rounded border"
                                      style={{ backgroundColor: item.supply.hexColor }}
                                    />
                                    <span>{item.supply.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{item.location.name}</TableCell>
                                <TableCell>{item.neededQuantity}</TableCell>
                                <TableCell>{item.orderQuantity}</TableCell>
                                <TableCell>{item.receivedQuantity}</TableCell>
                                <TableCell>{formatCurrency(item.pricePerUnit)}</TableCell>
                                <TableCell>{formatCurrency(item.totalPrice)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                      
                      {order.additionalComments && (
                        <div className="mt-4 p-3 bg-gray-50 rounded">
                          <p className="text-sm text-gray-700">{order.additionalComments}</p>
                        </div>
                      )}
                      
                      <div className="flex justify-end space-x-2 mt-4">
                        {order.status === 'ordered' && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowReceiveDialog(true);
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Received
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => { setEmailPoId(order.id); setEmailOpen(true); setEmailForm({ to: "", cc: "", bcc: "", subject: `Purchase Order ${order.poNumber}`, message: "" }); }}>
                          <Mail className="w-4 h-4 mr-2" />
                          Send Email
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Receive Order Dialog */}
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Receive Purchase Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="receive-date">Date Received</Label>
                <Input
                  id="receive-date"
                  type="date"
                  value={receiveForm.dateReceived}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, dateReceived: e.target.value }))}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReceiveOrder} disabled={receiveOrderMutation.isPending}>
                  {receiveOrderMutation.isPending ? "Receiving..." : "Mark as Received"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Email PO Dialog */}
        <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email Purchase Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>To</Label>
                <Input value={emailForm.to} onChange={(e) => setEmailForm((f) => ({ ...f, to: e.target.value }))} placeholder="vendor@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>CC</Label>
                  <Input value={emailForm.cc} onChange={(e) => setEmailForm((f) => ({ ...f, cc: e.target.value }))} placeholder="cc@example.com" />
                </div>
                <div>
                  <Label>BCC</Label>
                  <Input value={emailForm.bcc} onChange={(e) => setEmailForm((f) => ({ ...f, bcc: e.target.value }))} placeholder="bcc@example.com" />
                </div>
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={emailForm.subject} onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject" />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea value={emailForm.message} onChange={(e) => setEmailForm((f) => ({ ...f, message: e.target.value }))} rows={6} placeholder="Message body" />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button onClick={() => sendEmailMutation.mutate()} disabled={sendEmailMutation.isPending}>Send Email</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
} 