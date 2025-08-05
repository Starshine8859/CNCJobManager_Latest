import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";
import { useLocation } from "wouter";

interface Supply {
  id: number;
  name: string;
  needed: number;
  quantityOnHand: number;
  location: {
    id: number;
    name: string;
  } | null;
  defaultVendorId?: number;
  defaultVendorPrice?: number;
}

interface Vendor {
  id: number;
  name: string;
  contactInfo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

interface PurchaseOrderItem {
  id: string;
  supplyId: number;
  supplyName: string;
  vendorId: number;
  vendorName: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  neededQty: number;
}

export default function CreatePurchaseOrder() {
  const [currentTime] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedSupply, setSelectedSupply] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [additionalComments, setAdditionalComments] = useState("");
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [showExpandedSection, setShowExpandedSection] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch supplies
  const { data: supplies = [] } = useQuery({
    queryKey: ["supplies"],
    queryFn: async () => {
      const response = await fetch("/api/supplies");
      if (!response.ok) throw new Error("Failed to fetch supplies");
      return response.json();
    }
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const response = await fetch("/api/vendors");
      if (!response.ok) throw new Error("Failed to fetch vendors");
      return response.json();
    }
  });

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await fetch("/api/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    }
  });

  // Filter supplies by location
  const filteredSupplies = supplies.filter((supply: Supply) => 
    !selectedLocation || supply.location?.id.toString() === selectedLocation
  );

  // Get selected supply details
  const selectedSupplyDetails = supplies.find((supply: Supply) => 
    supply.id.toString() === selectedSupply
  );

  // Auto-selection logic when location changes
  const handleLocationChange = (locationId: string) => {
    setSelectedLocation(locationId);
    
    // Auto-select first item for this location
    const locationItems = supplies.filter((supply: Supply) => 
      supply.location?.id.toString() === locationId
    );
    
    if (locationItems.length > 0) {
      const defaultItem = locationItems[0];
      setSelectedSupply(defaultItem.id.toString());
      
      // Auto-select default vendor if available
      if (defaultItem.defaultVendorId) {
        setSelectedVendor(defaultItem.defaultVendorId.toString());
        setPricePerUnit((defaultItem.defaultVendorPrice || 50) / 100); // Convert from cents
      } else {
        setSelectedVendor("retail"); // Default to retail
        setPricePerUnit(0);
      }
    } else {
      setSelectedSupply("");
      setSelectedVendor("");
      setPricePerUnit(0);
    }
  };

  // Create purchase order mutation
  const createPurchaseOrderMutation = useMutation({
    mutationFn: async (data: { orderData: any; items: PurchaseOrderItem[] }) => {
      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to create purchase order");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Purchase order created successfully",
      });
      setLocation("/checkout-order");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const calculateTotal = () => {
    return purchaseOrderItems.reduce((total, item) => total + item.totalPrice, 0);
  };

  const handleAddToPurchaseOrder = () => {
    if (!selectedSupply || !selectedVendor || quantity <= 0 || pricePerUnit <= 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const supply = supplies.find((s: Supply) => s.id.toString() === selectedSupply);
    const vendor = vendors.find((v: Vendor) => v.id.toString() === selectedVendor);
    
    if (!supply) {
      toast({
        title: "Error",
        description: "Invalid supply selection",
        variant: "destructive",
      });
      return;
    }

    const newItem: PurchaseOrderItem = {
      id: Date.now().toString(),
      supplyId: parseInt(selectedSupply),
      supplyName: supply.name,
      vendorId: selectedVendor === "retail" ? 0 : parseInt(selectedVendor),
      vendorName: selectedVendor === "retail" ? "Retail($0.00)" : (vendor?.name || "Unknown"),
      quantity,
      pricePerUnit,
      totalPrice: quantity * pricePerUnit,
      neededQty: supply.needed || 0
    };

    setPurchaseOrderItems([...purchaseOrderItems, newItem]);
    setShowExpandedSection(true);
    
    // Reset form completely
    setSelectedLocation("");
    setSelectedSupply("");
    setSelectedVendor("");
    setQuantity(1);
    setPricePerUnit(0);
  };

  const handleRemoveItem = (itemId: string) => {
    setPurchaseOrderItems(purchaseOrderItems.filter(item => item.id !== itemId));
    if (purchaseOrderItems.length === 1) {
      setShowExpandedSection(false);
    }
  };

  const updateItemQuantity = (itemId: string, newQuantity: string) => {
    const quantity = parseInt(newQuantity) || 0;
    setPurchaseOrderItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity, totalPrice: quantity * item.pricePerUnit }
        : item
    ));
  };

  const updateItemVendor = (itemId: string, newVendorId: string) => {
    const vendor = vendors.find((v: Vendor) => v.id.toString() === newVendorId);
    if (vendor) {
      setPurchaseOrderItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, vendorId: parseInt(newVendorId), vendorName: vendor.name }
          : item
      ));
    } else if (newVendorId === "retail") {
      setPurchaseOrderItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, vendorId: 0, vendorName: "Retail($0.00)" }
          : item
      ));
    }
  };

  const handleCreatePurchaseOrder = () => {
    if (purchaseOrderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the purchase order",
        variant: "destructive",
      });
      return;
    }

    createPurchaseOrderMutation.mutate({
      orderData: {
        additionalComments
      },
      items: purchaseOrderItems
    });
  };

  return (
    <Layout currentTime={currentTime}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <nav className="text-sm text-gray-500 mb-2">
              <span>Home / Supplies / Purchase Orders / Create Purchase Orders</span>
            </nav>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">Create Purchase Orders</h1>
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <Info className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>

          {/* Order Minimum Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Order Minimum:</strong> Please note that we require a minimum order of $200 per color/style. 
              Orders under $200 per color/style will be subject to a $100 fee per color/style. 
              <em> *Terms and conditions apply</em>
            </p>
          </div>

          {/* Main Form */}
          <Card>
            <CardHeader>
              <CardTitle>Order Extra Supplies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Select value={selectedLocation} onValueChange={handleLocationChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location: any) => (
                          <SelectItem key={location.id} value={location.id.toString()}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="item">Item</Label>
                    <Select value={selectedSupply} onValueChange={setSelectedSupply}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSupplies.map((supply: Supply) => (
                          <SelectItem key={supply.id} value={supply.id.toString()}>
                            {supply.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="vendor">Vendor</Label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">Retail($0.00)</SelectItem>
                        {vendors.map((vendor: Vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id.toString()}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="quantity">Qty</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="pricePerUnit">Price per Unit ($)</Label>
                    <Input
                      id="pricePerUnit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="orderGroups">Order in groups of</Label>
                    <Input
                      id="orderGroups"
                      type="number"
                      value="1"
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                </div>

                {/* Add to Purchase Order Button - Only show if no items or expanded section not shown */}
                {!showExpandedSection && (
                  <Button 
                    onClick={handleAddToPurchaseOrder}
                    className="w-full"
                    disabled={!selectedSupply || !selectedVendor || quantity <= 0 || pricePerUnit <= 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Purchase Order
                  </Button>
                )}

                {/* Expanded Section with Items Table */}
                {showExpandedSection && purchaseOrderItems.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Purchase Order Items</h3>
                    
                    {/* Items Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Needed Qty</th>
                            <th className="px-4 py-3 text-left font-medium">Order Qty</th>
                            <th className="px-4 py-3 text-left font-medium">Vendor</th>
                            <th className="px-4 py-3 text-left font-medium">Price/Unit</th>
                            <th className="px-4 py-3 text-left font-medium">Total</th>
                            <th className="px-4 py-3 text-left font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseOrderItems.map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="px-4 py-3">{item.supplyName}</td>
                              <td className="px-4 py-3">{item.neededQty}</td>
                              <td className="px-4 py-3">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                                  className="w-20"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Select 
                                  value={item.vendorId === 0 ? "retail" : item.vendorId.toString()} 
                                  onValueChange={(value) => updateItemVendor(item.id, value)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="retail">Retail($0.00)</SelectItem>
                                    {vendors.map((vendor: Vendor) => (
                                      <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                        {vendor.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-4 py-3">{formatCurrency(item.pricePerUnit * 100)}</td>
                              <td className="px-4 py-3 font-medium">{formatCurrency(item.totalPrice * 100)}</td>
                              <td className="px-4 py-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Total */}
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        Total: {formatCurrency(calculateTotal() * 100)}
                      </p>
                    </div>

                    {/* Disclaimer */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        If there is a discrepancy on the prices listed above, please hold the order and advise us immediately For adjustments.
                      </p>
                    </div>

                    {/* Signature */}
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Thanks in advance!</p>
                      <p className="text-sm font-medium text-gray-800">-The team at Smart Custom Closets</p>
                    </div>

                    {/* Additional Comments */}
                    <div>
                      <Label htmlFor="comments">Additional Comments (optional)</Label>
                      <Textarea
                        id="comments"
                        placeholder="Enter any additional comments..."
                        value={additionalComments}
                        onChange={(e) => setAdditionalComments(e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Create Purchase Order Button - Bottom right */}
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleCreatePurchaseOrder}
                        disabled={createPurchaseOrderMutation.isPending}
                      >
                        {createPurchaseOrderMutation.isPending ? "Creating..." : "Create Purchase Order"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* New Form for Next Item - Only show if expanded section is visible */}
                {showExpandedSection && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Add Another Item</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="newLocation">Location</Label>
                        <Select value={selectedLocation} onValueChange={handleLocationChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((location: any) => (
                              <SelectItem key={location.id} value={location.id.toString()}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="newItem">Item</Label>
                        <Select value={selectedSupply} onValueChange={setSelectedSupply}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredSupplies.map((supply: Supply) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="newVendor">Vendor</Label>
                        <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="retail">Retail($0.00)</SelectItem>
                            {vendors.map((vendor: Vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="newQuantity">Qty</Label>
                        <Input
                          id="newQuantity"
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="newPricePerUnit">Price per Unit ($)</Label>
                        <Input
                          id="newPricePerUnit"
                          type="number"
                          min="0"
                          step="0.01"
                          value={pricePerUnit}
                          onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="newOrderGroups">Order in groups of</Label>
                        <Input
                          id="newOrderGroups"
                          type="number"
                          value="1"
                          disabled
                          className="bg-gray-100"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleAddToPurchaseOrder}
                      className="w-full mt-4"
                      disabled={!selectedSupply || !selectedVendor || quantity <= 0 || pricePerUnit <= 0}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Purchase Order
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
} 