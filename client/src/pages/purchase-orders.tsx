import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Calendar, Plus, Search, Filter, Package, DollarSign, Clock, CheckCircle, AlertCircle, Truck, ShoppingCart, Mail, Download, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PurchaseOrder {
  id: number;
  poNumber: string;
  dateOrdered: string;
  dateReceived: string | null;
  totalAmount: number;
  status: string;
  additionalComments: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
  createdByUser: {
    id: number;
    username: string;
  };
}

interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  supplyId: number;
  vendorId: number;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  createdAt: string;
  supply: {
    id: number;
    name: string;
    quantityOnHand: number;
  };
  vendor: {
    id: number;
    name: string;
  };
}

export default function PurchaseOrders() {
  const [currentTime] = useState(new Date());
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const formatDateInput = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [fromDate, setFromDate] = useState(formatDateInput(firstOfMonth));
  const [toDate, setToDate] = useState(formatDateInput(lastOfMonth));
  const [statusFilter, setStatusFilter] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailPoId, setEmailPoId] = useState<number | null>(null);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", bcc: "", subject: "", message: "" });
  const sendEmailMutation = useMutation({
    mutationFn: async () => { if (!emailPoId) throw new Error("Missing PO"); const res = await fetch(`/api/purchase-orders/${emailPoId}/send-email`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(emailForm) }); if (!res.ok) throw new Error("Failed to send email"); return res.json(); },
    onSuccess: () => { setEmailOpen(false); toast({ title: "Email sent", description: "Purchase order email sent successfully" }); },
    onError: (err: any) => { toast({ title: "Email failed", description: err?.message || "Could not send email", variant: "destructive" }); }
  });

  // ===== Need To Purchase + Vendors (moved from Checkout/Order) =====
  interface NeedToPurchaseRow {
    supplyId: number;
    locationId: number;
    onHandQuantity: number;
    allocatedQuantity?: number;
    availableQuantity?: number;
    minimumQuantity: number;
    reorderPoint: number;
    orderGroupSize: number;
    suggestedOrderQty?: number;
    supply: { id: number; name: string; hexColor: string; pieceSize: string };
    location: { id: number; name: string };
  }

  interface Vendor { id: number; name?: string; company?: string }

  const { data: needToPurchase = [], isLoading: needsLoading } = useQuery<NeedToPurchaseRow[]>({
    queryKey: ["need-to-purchase"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/need-to-purchase", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch need-to-purchase");
      return res.json();
    },
  });

  const { data: vendorsList = [] } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
  });

  // On Order (enhanced)
  interface EnhancedPOItemRow {
    poId: number;
    poNumber: string;
    orderDate: string | null;
    location: { id: number; name: string } | null;
    supply: { id: number; name: string; partNumber?: string | null } | null;
    vendorId: number | null;
    orderedQuantity: number;
    receivedQuantity: number;
    itemId: number;
  }

  interface EnhancedPOResponse {
    id: number; poNumber: string; createdAt: string; dateOrdered?: string | null;
    items: Array<{ id: number; supplyId: number; vendorId: number | null; locationId: number | null; neededQuantity: number | null; orderQuantity: number; receivedQuantity: number | null; pricePerUnit: number; totalPrice: number; supply?: { id: number; name: string; partNumber?: string | null } | null; location?: { id: number; name: string } | null; }>
  }

  const { data: onOrder = [], isLoading: onOrderLoading, refetch: refetchOnOrder } = useQuery<EnhancedPOResponse[]>({
    queryKey: ["enhanced-pos", "ordered"],
    queryFn: async () => {
      const res = await fetch(`/api/purchase-orders/enhanced?status=ordered`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch purchase orders");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      
             const response = await fetch(`/api/purchase-orders/enhanced?${params}`);
       if (!response.ok) throw new Error("Failed to fetch purchase orders");
       return response.json();
    }
  });

  // Fetch all vendors for mapping vendorId -> company (reuse vendorsList)

  const vendorCompanyById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const v of vendorsList as any[]) {
      map[v.id] = v.company ?? v.name ?? "-";
    }
    return map;
  }, [vendorsList]);

  const vendorById = useMemo(() => {
    const map: Record<number, any> = {};
    (vendorsList as any[]).forEach((v: any) => { if (v.id) map[v.id] = v; });
    return map;
  }, [vendorsList]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100); // Convert from cents
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-200';
      case 'ordered':
        return 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-blue-200';
      case 'received':
        return 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3" />;
      case 'ordered':
        return <Truck className="w-3 h-3" />;
      case 'received':
        return <CheckCircle className="w-3 h-3" />;
      default:
        return <AlertCircle className="w-3 h-3" />;
    }
  };

  const filteredPurchaseOrders = purchaseOrders.filter((po: PurchaseOrder) => {
    const matchesSearch = po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.items.some(item => item.supply.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !statusFilter || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreatePurchaseOrder = () => {
    setLocation("/create-purchase-order");
  };

  const getTotalValue = () => {
    return (filteredPurchaseOrders as any[]).reduce((sum: number, po: any) => sum + (po.totalAmount || 0), 0);
  };

  // ====== Mutations and helpers for moved sections ======
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) => setSelectedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  const setRowQty = (key: string, value: number) => setQtyOverrides((prev) => ({ ...prev, [key]: value }));

  const suggestedQty = (row: NeedToPurchaseRow) => {
    if (row.suggestedOrderQty && row.suggestedOrderQty > 0) return row.suggestedOrderQty;
    const available = typeof row.availableQuantity === 'number' ? row.availableQuantity : Math.max(0, (row.onHandQuantity || 0) - (row.allocatedQuantity || 0));
    const threshold = Math.max(row.reorderPoint || 0, row.minimumQuantity || 0);
    let base = Math.max(0, threshold - available);
    if ((row.allocatedQuantity || 0) > 0 && base < (row.allocatedQuantity || 0)) base = row.allocatedQuantity || 0;
    const group = Math.max(1, row.orderGroupSize || 1);
    const groups = Math.ceil(base / group);
    return Math.max(group, groups * group);
  };

  const rows = useMemo(() => needToPurchase, [needToPurchase]);
  const selectedCount = useMemo(() => rows.filter((r) => selectedRows[`${r.supplyId}-${r.locationId}`]).length, [rows, selectedRows]);
  const orderTotalItems = useMemo(() => rows.reduce((sum, r) => sum + (selectedRows[`${r.supplyId}-${r.locationId}`] ? (qtyOverrides[`${r.supplyId}-${r.locationId}`] || suggestedQty(r)) : 0), 0), [rows, selectedRows, qtyOverrides]);

  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/purchase-orders/enhanced", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed to create purchase order");
      return res.json();
    },
    onSuccess: async (data: any) => {
      setSelectedRows({}); setQtyOverrides({}); queryClient.invalidateQueries({ queryKey: ["need-to-purchase"] });
      try { const poId = data?.order?.id; if (poId) { await fetch(`/api/purchase-orders/${poId}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: "ordered" }) }); refetchOnOrder(); } } catch {}
    }
  });

  const handleCreateOrder = () => {
    if (!selectedVendor) return; const vendorId = parseInt(selectedVendor);
    const items = rows.filter((r) => selectedRows[`${r.supplyId}-${r.locationId}`]).map((r) => ({
      supplyId: r.supplyId, vendorId, locationId: r.locationId, neededQuantity: suggestedQty(r), orderQuantity: qtyOverrides[`${r.supplyId}-${r.locationId}`] || suggestedQty(r), pricePerUnit: 0,
    }));
    if (items.length === 0) return;
    createOrderMutation.mutate({ vendorId, expectedDeliveryDate: null, notes: "Auto-generated from Need to Purchase", items, sendEmail: false });
  };

  const createGroupedOrders = useMutation({
    mutationFn: async () => {
      const selected = rows.filter((r) => selectedRows[`${r.supplyId}-${r.locationId}`]); if (selected.length === 0) throw new Error("No rows selected");
      const groups: Record<number, any[]> = {};
      for (const r of selected) {
        const resp = await fetch(`/api/supplies/${r.supplyId}/vendors`, { credentials: "include" }); if (!resp.ok) continue; const vs = await resp.json();
        const preferred = (vs || []).find((v: any) => v.isPreferred) || (vs || [])[0]; if (!preferred || !preferred.id) continue;
        const vendorId = preferred.id as number; const key = `${r.supplyId}-${r.locationId}`; const orderQty = qtyOverrides[key] || suggestedQty(r);
        if (!groups[vendorId]) groups[vendorId] = [];
        groups[vendorId].push({ supplyId: r.supplyId, vendorId, locationId: r.locationId, neededQuantity: suggestedQty(r), orderQuantity: orderQty, pricePerUnit: Math.max(0, Math.floor((preferred.price ?? 0))) });
      }
      const vendorIds = Object.keys(groups).map((k) => parseInt(k)); if (vendorIds.length === 0) throw new Error("No preferred vendors found for selected items");
      const results = [] as any[]; for (const vendorId of vendorIds) {
        const payload = { vendorId, expectedDeliveryDate: null, notes: "Auto-generated from Need to Purchase (preferred vendors)", items: groups[vendorId], sendEmail: false };
        const res = await fetch("/api/purchase-orders/enhanced", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) }); if (!res.ok) throw new Error("Failed to create purchase order");
        const json = await res.json(); try { const poId = json?.order?.id; if (poId) { await fetch(`/api/purchase-orders/${poId}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: "ordered" }) }); } } catch {}
        results.push(json);
      }
      return results;
    },
    onSuccess: () => { setSelectedRows({}); setQtyOverrides({}); queryClient.invalidateQueries({ queryKey: ["need-to-purchase"] }); refetchOnOrder(); toast({ title: "Success", description: "Purchase orders created by preferred vendors" }); },
  });

  // Manual check-in/out removed from Purchase Orders page per requirement

  return (
    <Layout currentTime={currentTime}>
      <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        {/* Left Sidebar */}
        <div className="w-96 bg-white/80 backdrop-blur-sm border-r border-gray-200/60 shadow-lg overflow-y-auto">
          {/* Sidebar Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Purchase Orders</h1>
                <p className="text-indigo-100 text-sm">Inventory Management</p>
              </div>
            </div>
            <nav className="text-sm text-indigo-200">
              <span className="flex items-center space-x-1">
                <span>Home</span>
                <span>/</span>
                <span>Inventory</span>
                <span>/</span>
                <span className="text-white font-medium">Purchase Orders</span>
              </span>
            </nav>
          </div>

          {/* Filters Section */}
          <div className="p-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Total Orders</p>
                    <p className="text-2xl font-bold text-blue-900">{filteredPurchaseOrders.length}</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-700">Total Value</p>
                    <p className="text-lg font-bold text-emerald-900">{formatCurrency(getTotalValue())}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="search" className="text-sm font-semibold text-gray-700 mb-2 block">Search Orders</Label>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 w-4 h-4 transition-colors" />
                  <Input
                    id="search"
                    placeholder="Search PO# or item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="fromDate" className="text-sm font-semibold text-gray-700 mb-2 block">From Date</Label>
                  <Input
                    id="fromDate"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200"
                  />
                </div>

                <div>
                  <Label htmlFor="toDate" className="text-sm font-semibold text-gray-700 mb-2 block">To Date</Label>
                  <Input
                    id="toDate"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-lg transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status" className="text-sm font-semibold text-gray-700 mb-2 block">Status Filter</Label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select
                    id="status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white transition-all duration-200"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                  </select>
                </div>
              </div>

              <Button 
                onClick={handleCreatePurchaseOrder}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 rounded-lg py-2.5"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Purchase Order
              </Button>

              {/* ===== Vendor and PO creation controls ===== */}
              <div className="pt-6 border-t border-gray-200" />
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Vendor (for single-PO)</Label>
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(vendorsList as any[]).map((v: any) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.company || v.name || `Vendor #${v.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Selected items</span>
                    <Badge variant="secondary">{selectedCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span>Total quantity</span>
                    <Badge variant="secondary">{orderTotalItems}</Badge>
                  </div>
                </div>

                <Button onClick={handleCreateOrder} disabled={!selectedVendor || selectedCount === 0 || (createOrderMutation as any).isPending} className="w-full">
                  {(createOrderMutation as any).isPending ? "Creating..." : "Create Purchase Order"}
                </Button>
                <Button variant="outline" onClick={() => (createGroupedOrders as any).mutate()} disabled={selectedCount === 0 || (createGroupedOrders as any).isPending} className="w-full">
                  {(createGroupedOrders as any).isPending ? "Creating..." : "Create POs by Preferred Vendors"}
                </Button>

                {/* Manual CI/CO removed */}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Main Header */}
          <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 shadow-sm">
            <div className="px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    Purchase Orders Overview
                  </h2>
                  <p className="text-gray-600 flex items-center space-x-2">
                    <span>Manage and track your purchase orders</span>
                    <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                      {filteredPurchaseOrders.length} orders
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content (includes Need to Purchase and On Order) */}
          <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
            {/* Need To Purchase */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
              <div className="px-6 py-4 border-b bg-gray-50/60 flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  <h3 className="font-semibold">Need To Purchase</h3>
                </div>
              </div>
              <div className="p-0">
                {needsLoading ? (
                  <div className="p-6 text-gray-500">Loading...</div>
                ) : rows.length === 0 ? (
                  <div className="p-6 text-gray-500">No items need purchasing</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left w-10"></th>
                          <th className="px-4 py-3 text-left">Location</th>
                          <th className="px-4 py-3 text-left">Item</th>
                          <th className="px-4 py-3 text-left">Piece Size</th>
                          <th className="px-4 py-3 text-center">On Hand</th>
                          <th className="px-4 py-3 text-center">Allocated</th>
                          <th className="px-4 py-3 text-center">Available</th>
                          <th className="px-4 py-3 text-center">Min</th>
                          <th className="px-4 py-3 text-center">Reorder</th>
                          <th className="px-4 py-3 text-center">Qty to Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row: any) => {
                          const key = `${row.supplyId}-${row.locationId}`;
                          const value = qtyOverrides[key] ?? suggestedQty(row);
                          return (
                            <tr key={key} className="border-t">
                              <td className="px-4 py-3 align-middle">
                                <input type="checkbox" checked={!!selectedRows[key]} onChange={() => toggleRow(key)} />
                              </td>
                              <td className="px-4 py-3 align-middle whitespace-nowrap">{row.location.name}</td>
                              <td className="px-4 py-3 align-middle">
                                <div className="flex items-center space-x-2">
                                  <div className="w-4 h-4 rounded border" style={{ backgroundColor: row.supply.hexColor }} />
                                  <span>{row.supply.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 align-middle">{row.supply.pieceSize}</td>
                              <td className="px-4 py-3 align-middle text-center">{row.onHandQuantity}</td>
                              <td className="px-4 py-3 align-middle text-center">{row.allocatedQuantity ?? 0}</td>
                              <td className="px-4 py-3 align-middle text-center">{typeof row.availableQuantity === 'number' ? row.availableQuantity : Math.max(0, (row.onHandQuantity || 0) - (row.allocatedQuantity || 0))}</td>
                              <td className="px-4 py-3 align-middle text-center">{row.minimumQuantity}</td>
                              <td className="px-4 py-3 align-middle text-center">{row.reorderPoint}</td>
                              <td className="px-4 py-3 align-middle text-center">
                                <Input type="number" value={value} min={1} onChange={(e) => setRowQty(key, Math.max(1, parseInt(e.target.value) || 1))} className="w-28 mx-auto" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Email PO Modal */}
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
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
                  <Button onClick={() => (sendEmailMutation as any).mutate()} disabled={(sendEmailMutation as any).isPending}>Send Email</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {isLoading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Purchase Orders</h3>
                <p className="text-gray-500">Please wait while we fetch your data...</p>
              </div>
            ) : filteredPurchaseOrders.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-gray-100 to-slate-100 rounded-full mb-6">
                  <FileText className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Purchase Orders Found</h3>
                <p className="text-gray-500 mb-6">Get started by creating your first purchase order to track your inventory.</p>
                <Button 
                  onClick={handleCreatePurchaseOrder}
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Order
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/60">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">PO#</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date ordered</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date received</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Company</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total price</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {(filteredPurchaseOrders as any[]).map((po: any) => {
                      const firstVendorId = po.items?.[0]?.vendorId as number | undefined;
                      const company = firstVendorId ? (vendorCompanyById[firstVendorId] ?? "-") : "-";
                      const dateOrdered = po.dateOrdered ?? po.createdAt;
                      const dateReceived = po.dateReceived;
                      return (
                        <tr key={po.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="px-6 py-3 text-sm font-semibold text-gray-900">{po.poNumber}</td>
                          <td className="px-6 py-3 text-sm text-gray-700">{dateOrdered ? new Date(dateOrdered).toLocaleDateString() : "-"}</td>
                          <td className="px-6 py-3 text-sm text-gray-700">{dateReceived ? new Date(dateReceived).toLocaleDateString() : "-"}</td>
                          <td className="px-6 py-3 text-sm text-gray-700">{company}</td>
                          <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(po.totalAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}