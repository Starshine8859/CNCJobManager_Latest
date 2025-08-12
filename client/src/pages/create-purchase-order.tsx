import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, Info, ShoppingCart, Package, DollarSign, AlertTriangle, CheckCircle, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

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
  contact_info: string | null;
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
  locationId: number; // needed by backend
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

  // Fetch vendors for selected supply
  const { data: vendorsForSupply = [] } = useQuery({
    queryKey: ["vendors", selectedSupply],
    queryFn: async () => {
      if (!selectedSupply) return [];
      const response = await fetch(`/api/supplies/${selectedSupply}/vendors`);
      if (!response.ok) throw new Error("Failed to fetch vendors for supply");
      return response.json();
    },
    enabled: !!selectedSupply
  });

  // Fetch all vendors (for fallback)
  const { data: allVendors = [] } = useQuery({
    queryKey: ["all-vendors"],
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

  // Fetch supplies at selected location
  const { data: suppliesAtLocation = [] } = useQuery({
    queryKey: ["supplies-at-location", selectedLocation],
    queryFn: async () => {
      if (!selectedLocation) return [];
      const response = await fetch(`/api/locations/${selectedLocation}/supplies`);
      if (!response.ok) throw new Error("Failed to fetch supplies at location");
      return response.json();
    },
    enabled: !!selectedLocation
  });

  // Get selected supply details
  const selectedSupplyDetails = suppliesAtLocation.find((supply: any) => 
    supply.id.toString() === selectedSupply
  );

  // Auto-selection logic when location changes
  const handleLocationChange = (locationId: string) => {
    setSelectedLocation(locationId);
    
    // Reset selections - will be populated when data is fetched
    setSelectedSupply("");
    setSelectedVendor("");
    setPricePerUnit(0);
  };

  // Handle supply selection change
  const handleSupplyChange = (supplyId: string) => {
    setSelectedSupply(supplyId);
    setSelectedVendor(""); // Reset vendor selection
    setPricePerUnit(0);
  };

  // Create purchase order mutation
  const createPurchaseOrderMutation = useMutation({
    mutationFn: async (data: { orderData: any; items: PurchaseOrderItem[] }) => {
      if (!data.items || data.items.length === 0) {
        throw new Error("No items to create purchase order");
      }

      // Disallow 'Retail' placeholder vendor (id 0)
      if (data.items.some((it) => it.vendorId === 0)) {
        throw new Error("Please select a vendor for all items (Retail is not allowed)");
      }

      // Use the first item's vendor as the order vendor to satisfy backend validation
      const topLevelVendorId = data.items[0].vendorId;

      const payload = {
        vendorId: topLevelVendorId,
        expectedDeliveryDate: undefined,
        notes: data.orderData?.additionalComments || undefined,
        sendEmail: false,
        items: data.items.map((it) => ({
          supplyId: it.supplyId,
          vendorId: it.vendorId,
          locationId: (it as any).locationId,
          neededQuantity: it.neededQty ?? 0,
          orderQuantity: it.quantity,
          // backend expects cents (integers)
          pricePerUnit: Math.round((it.pricePerUnit ?? 0) * 100),
        })),
      };

      const response = await fetch("/api/purchase-orders/enhanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to create purchase order");
      return response.json();
    },
    onSuccess: async (data: any) => {
      toast({
        title: "Success",
        description: "Purchase order created successfully",
      });
      try {
        const poId = data?.order?.id;
        if (poId) {
          await fetch(`/api/purchase-orders/${poId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: "ordered" })
          });
        }
      } catch {}
      // Ensure downstream On Order table refreshes
      queryClient.invalidateQueries({ queryKey: ["enhanced-pos"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-pos", "ordered"] });
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

    const supply = suppliesAtLocation.find((s: any) => s.id.toString() === selectedSupply);
    const vendor = vendorsForSupply.find((v: any) => v.id.toString() === selectedVendor);
    
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
      vendorName: selectedVendor === "retail" ? "Retail($0.00)" : (vendor?.company || "Unknown"),
      locationId: parseInt(selectedLocation),
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
    const vendor = allVendors.find((v: Vendor) => v.id.toString() === newVendorId);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/60 p-8">
              <nav className="text-sm text-indigo-600 mb-4 flex items-center space-x-2">
                <span className="flex items-center space-x-1">
                  <span>Home</span>
                  <span>/</span>
                  <span>Supplies</span>
                  <span>/</span>
                  <span>Purchase Orders</span>
                  <span>/</span>
                  <span className="text-indigo-800 font-semibold">Create Purchase Orders</span>
                </span>
              </nav>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-xl">
                    <ShoppingCart className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-1">Create Purchase Order</h1>
                    <p className="text-gray-600">Add supplies to your purchase order</p>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Order Minimum Notice */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-xl p-6 shadow-lg">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Order Minimum Requirements</h3>
                  <p className="text-blue-800 leading-relaxed">
                    Please note that we require a minimum order of <span className="font-bold">$200 per color/style</span>. 
                    Orders under $200 per color/style will be subject to a <span className="font-bold">$100 fee per color/style</span>.
                  </p>
                  <p className="text-blue-700 text-sm mt-2 italic">*Terms and conditions apply</p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {purchaseOrderItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-700 font-semibold mb-1">Total Items</p>
                    <p className="text-3xl font-bold text-emerald-900">{purchaseOrderItems.length}</p>
                  </div>
                  <Package className="w-10 h-10 text-emerald-500" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 font-semibold mb-1">Total Quantity</p>
                    <p className="text-3xl font-bold text-blue-900">
                      {purchaseOrderItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </p>
                  </div>
                  <ShoppingCart className="w-10 h-10 text-blue-500" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-6 rounded-xl border border-amber-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-700 font-semibold mb-1">Total Value</p>
                    <p className="text-3xl font-bold text-amber-900">{formatCurrency(calculateTotal() * 100)}</p>
                  </div>
                  <DollarSign className="w-10 h-10 text-amber-500" />
                </div>
              </div>
            </div>
          )}

          {/* Main Form */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
            
            <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50/50 border-b border-gray-200/60">
              <CardTitle className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg">
                  <Plus className="w-6 h-6 text-indigo-600" />
                </div>
                <span>Order Extra Supplies</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-8">
              <div className="space-y-8">
                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span>Location</span>
                    </Label>
                    <Select value={selectedLocation} onValueChange={handleLocationChange}>
                      <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200">
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

                  <div className="space-y-2">
                    <Label htmlFor="item" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                      <Package className="w-4 h-4 text-gray-500" />
                      <span>Item</span>
                    </Label>
                    <Select value={selectedSupply} onValueChange={handleSupplyChange}>
                      <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliesAtLocation.map((supply: any) => (
                          <SelectItem key={supply.id} value={supply.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>{supply.name}</span>
                              <Badge className="ml-2 bg-gray-100 text-gray-700">
                                Stock: {supply.onHandQuantity}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vendor" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span>Vendor</span>
                    </Label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200">
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span>Retail ($0.00)</span>
                          </div>
                        </SelectItem>
                        {vendorsForSupply.map((vendor: any) => (
                          <SelectItem key={vendor.id} value={vendor.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>{vendor.company}</span>
                              <Badge className="ml-2 bg-blue-100 text-blue-700">
                                ${(vendor.price / 100).toFixed(2)}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-sm font-semibold text-gray-700">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pricePerUnit" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span>Price per Unit ($)</span>
                    </Label>
                    <Input
                      id="pricePerUnit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                      className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="orderGroups" className="text-sm font-semibold text-gray-700">Order in groups of</Label>
                    <Input
                      id="orderGroups"
                      type="number"
                      value="1"
                      disabled
                      className="bg-gray-100 border-gray-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* Add to Purchase Order Button */}
                {!showExpandedSection && (
                  <Button 
                    onClick={handleAddToPurchaseOrder}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white py-3 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                    disabled={!selectedSupply || !selectedVendor || quantity <= 0 || pricePerUnit <= 0}
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add to Purchase Order
                  </Button>
                )}

                {/* Expanded Section with Items Table */}
                {showExpandedSection && purchaseOrderItems.length > 0 && (
                  <div className="space-y-6">
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-r from-emerald-100 to-green-100 rounded-lg">
                          <FileText className="w-6 h-6 text-emerald-600" />
                        </div>
                        <span>Purchase Order Items</span>
                      </h3>
                    
                      {/* Items Table */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gradient-to-r from-gray-50 to-blue-50/50">
                              <tr>
                                <th className="px-6 py-4 text-left font-semibold text-gray-700">Item Name</th>
                                <th className="px-6 py-4 text-left font-semibold text-gray-700">Needed Qty</th>
                                <th className="px-6 py-4 text-left font-semibold text-gray-700">Order Qty</th>
                                <th className="px-6 py-4 text-left font-semibold text-gray-700">Vendor</th>
                                <th className="px-6 py-4 text-left font-semibold text-gray-700">Price/Unit</th>
                                <th className="px-6 py-4 text-left font-semibold text-gray-700">Total</th>
                                <th className="px-6 py-4 text-left font-semibold text-gray-700">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {purchaseOrderItems.map((item, index) => (
                                <tr key={item.id} className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                      <div className="p-2 bg-indigo-100 rounded-lg">
                                        <Package className="w-4 h-4 text-indigo-600" />
                                      </div>
                                      <span className="font-medium text-gray-900">{item.supplyName}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <Badge className="bg-yellow-100 text-yellow-800">
                                      {item.neededQty}
                                    </Badge>
                                  </td>
                                  <td className="px-6 py-4">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                                      className="w-24 border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <Select 
                                      value={item.vendorId === 0 ? "retail" : item.vendorId.toString()} 
                                      onValueChange={(value) => updateItemVendor(item.id, value)}
                                    >
                                      <SelectTrigger className="w-40 border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="retail">Retail($0.00)</SelectItem>
                                        {vendorsForSupply.map((vendor: any) => (
                                          <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                            {vendor.company} - ${(vendor.price / 100).toFixed(2)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-6 py-4 font-semibold text-gray-900">
                                    {formatCurrency(item.pricePerUnit * 100)}
                                  </td>
                                  <td className="px-6 py-4 font-bold text-lg text-indigo-600">
                                    {formatCurrency(item.totalPrice * 100)}
                                  </td>
                                  <td className="px-6 py-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveItem(item.id)}
                                      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg transition-all duration-200"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 mt-6 border border-indigo-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-3 bg-indigo-100 rounded-xl">
                              <DollarSign className="w-6 h-6 text-indigo-600" />
                            </div>
                            <span className="text-xl font-semibold text-indigo-900">Order Total</span>
                          </div>
                          <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                            {formatCurrency(calculateTotal() * 100)}
                          </span>
                        </div>
                      </div>

                      {/* Disclaimer */}
                      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 rounded-xl p-6 mt-6">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <p className="text-yellow-800 leading-relaxed">
                            <span className="font-semibold">Important:</span> If there is a discrepancy on the prices listed above, 
                            please hold the order and advise us immediately for adjustments.
                          </p>
                        </div>
                      </div>

                      {/* Signature */}
                      <div className="text-center mt-6 p-6 bg-gradient-to-r from-gray-50 to-blue-50/50 rounded-xl">
                        <p className="text-gray-600 mb-2">Thanks in advance!</p>
                        <p className="text-lg font-semibold text-gray-800">-The team at Smart Custom Closets</p>
                      </div>

                      {/* Additional Comments */}
                      <div className="space-y-3 mt-6">
                        <Label htmlFor="comments" className="text-lg font-semibold text-gray-700">Additional Comments (optional)</Label>
                        <Textarea
                          id="comments"
                          placeholder="Enter any additional comments or special instructions..."
                          value={additionalComments}
                          onChange={(e) => setAdditionalComments(e.target.value)}
                          rows={4}
                          className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200"
                        />
                      </div>

                      {/* Create Purchase Order Button */}
                      <div className="flex justify-end mt-8">
                        <Button 
                          onClick={handleCreatePurchaseOrder}
                          disabled={createPurchaseOrderMutation.isPending}
                          className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                        >
                          {createPurchaseOrderMutation.isPending ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Creating...</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-5 h-5" />
                              <span>Create Purchase Order</span>
                            </div>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* New Form for Next Item */}
                {showExpandedSection && (
                  <div className="border-t border-gray-200 pt-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg">
                        <Plus className="w-5 h-5 text-blue-600" />
                      </div>
                      <span>Add Another Item</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="newLocation" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span>Location</span>
                        </Label>
                        <Select value={selectedLocation} onValueChange={handleLocationChange}>
                          <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200">
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

                      <div className="space-y-2">
                        <Label htmlFor="newItem" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                          <Package className="w-4 h-4 text-gray-500" />
                          <span>Item</span>
                        </Label>
                        <Select value={selectedSupply} onValueChange={setSelectedSupply}>
                          <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliesAtLocation.map((supply: any) => (
                              <SelectItem key={supply.id} value={supply.id.toString()}>
                                {supply.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newVendor" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span>Vendor</span>
                        </Label>
                        <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                          <SelectTrigger className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200">
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="retail">Retail($0.00)</SelectItem>
                            {allVendors.map((vendor: Vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newQuantity" className="text-sm font-semibold text-gray-700">Quantity</Label>
                        <Input
                          id="newQuantity"
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                          className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newPricePerUnit" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-gray-500" />
                          <span>Price per Unit ($)</span>
                        </Label>
                        <Input
                          id="newPricePerUnit"
                          type="number"
                          min="0"
                          step="0.01"
                          value={pricePerUnit}
                          onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                          className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newOrderGroups" className="text-sm font-semibold text-gray-700">Order in groups of</Label>
                        <Input
                          id="newOrderGroups"
                          type="number"
                          value="1"
                          disabled
                          className="bg-gray-100 border-gray-200 rounded-lg"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleAddToPurchaseOrder}
                      className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white py-3 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                      disabled={!selectedSupply || !selectedVendor || quantity <= 0 || pricePerUnit <= 0}
                    >
                      <Plus className="w-5 h-5 mr-2" />
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