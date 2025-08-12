import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, ShoppingCart, Filter, Users, CheckSquare, FileText, Truck, Mail, Download } from "lucide-react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NeedToPurchaseRow {
  supplyId: number;
  locationId: number;
  onHandQuantity: number;
  minimumQuantity: number;
  reorderPoint: number;
  orderGroupSize: number;
  supply: {
    id: number;
  name: string;
    hexColor: string;
    pieceSize: string;
  };
  location: {
    id: number;
    name: string;
  };
}

interface Vendor {
  id: number;
  name?: string;
  company?: string;
}

export default function CheckoutOrderPage() {
  const [currentTime] = useState(new Date());
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: needToPurchase = [], isLoading: needsLoading } = useQuery<NeedToPurchaseRow[]>({
    queryKey: ["need-to-purchase"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/need-to-purchase", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch need-to-purchase");
      return res.json();
    },
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
  });

  // On Order (enhanced purchase orders)
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
    id: number;
    poNumber: string;
    createdAt: string;
    dateOrdered?: string | null;
    items: Array<{
      id: number;
      supplyId: number;
      vendorId: number | null;
      locationId: number | null;
      neededQuantity: number | null;
      orderQuantity: number;
      receivedQuantity: number | null;
      pricePerUnit: number;
      totalPrice: number;
      supply?: { id: number; name: string; partNumber?: string | null } | null;
      location?: { id: number; name: string } | null;
    }>;
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

  const vendorById = useMemo(() => {
    const map: Record<number, Vendor> = {};
    vendors.forEach((v) => { if (v.id) map[v.id] = v; });
    return map;
  }, [vendors]);

  const onOrderRows: EnhancedPOItemRow[] = useMemo(() => {
    return (onOrder || []).flatMap((po) =>
      (po.items || []).map((it) => ({
        poId: po.id,
        poNumber: po.poNumber,
        orderDate: po.dateOrdered || po.createdAt,
        location: (it as any).location || null,
        supply: (it as any).supply || null,
        vendorId: it.vendorId ?? null,
        orderedQuantity: it.orderQuantity,
        receivedQuantity: it.receivedQuantity || 0,
        itemId: it.id,
      }))
    );
  }, [onOrder]);

  // Local state for receiving quantities per item
  const [receiveQty, setReceiveQty] = useState<Record<number, number>>({});

  // Update PO item received quantity
  const updateItemReceivedMutation = useMutation({
    mutationFn: async ({ poId, itemId, receivedQuantity }: { poId: number; itemId: number; receivedQuantity: number }) => {
      const res = await fetch(`/api/purchase-orders/${poId}/items/${itemId}` , {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ receivedQuantity }),
      });
      if (!res.ok) throw new Error("Failed to update received quantity");
      return res.json();
    },
    onSuccess: () => {
      refetchOnOrder();
    }
  });

  // Manual Check-In/Out state
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedSupplyId, setSelectedSupplyId] = useState<string>("");
  const [manualCheckInQty, setManualCheckInQty] = useState<number>(0);
  const [manualCheckOutQty, setManualCheckOutQty] = useState<number>(0);
  const [manualJobId, setManualJobId] = useState<string>("");

  // Load locations
  interface Location { id: number; name: string }
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["ci-locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    }
  });

  // Supplies at selected location (with stock)
  interface SupplyAtLocation {
    id: number;
    name: string;
    partNumber?: string | null;
    onHandQuantity: number;
  }
  const { data: suppliesAtLocation = [] } = useQuery<SupplyAtLocation[]>({
    queryKey: ["ci-supplies-at", selectedLocationId],
    queryFn: async () => {
      if (!selectedLocationId) return [] as SupplyAtLocation[];
      const res = await fetch(`/api/locations/${selectedLocationId}/supplies`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch supplies at location");
      return res.json();
    },
    enabled: !!selectedLocationId,
  });

  const selectedSupply = useMemo(() => {
    const id = Number(selectedSupplyId);
    return suppliesAtLocation.find((s) => s.id === id);
  }, [suppliesAtLocation, selectedSupplyId]);

  const manualCheckIn = useMutation({
    mutationFn: async () => {
      if (!selectedLocationId || !selectedSupplyId || manualCheckInQty <= 0) throw new Error("Missing fields");
      const res = await fetch("/api/inventory/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplyId: Number(selectedSupplyId),
          locationId: Number(selectedLocationId),
          quantity: manualCheckInQty,
          referenceType: "manual",
          notes: "Manual check-in"
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to check-in");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Checked in" });
      setManualCheckInQty(0);
      queryClient.invalidateQueries({ queryKey: ["ci-supplies-at", selectedLocationId] });
      queryClient.invalidateQueries({ queryKey: ["need-to-purchase"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Check-in failed", variant: "destructive" })
  });

  const manualCheckOut = useMutation({
    mutationFn: async () => {
      if (!selectedLocationId || !selectedSupplyId || manualCheckOutQty <= 0) throw new Error("Missing fields");
      const res = await fetch("/api/inventory/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplyId: Number(selectedSupplyId),
          locationId: Number(selectedLocationId),
          quantity: manualCheckOutQty,
          referenceType: manualJobId ? "job" : "manual",
          referenceId: manualJobId ? Number(manualJobId) : undefined,
          notes: manualJobId ? `Check-out for job ${manualJobId}` : "Manual check-out"
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to check-out");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Checked out" });
      setManualCheckOutQty(0);
      queryClient.invalidateQueries({ queryKey: ["ci-supplies-at", selectedLocationId] });
      queryClient.invalidateQueries({ queryKey: ["need-to-purchase"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Check-out failed", variant: "destructive" })
  });

  // Check-in inventory per item
  const checkInMutation = useMutation({
    mutationFn: async ({ supplyId, locationId, quantity, referenceId }: { supplyId: number; locationId: number; quantity: number; referenceId: number }) => {
      const res = await fetch(`/api/inventory/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplyId,
          locationId,
          quantity,
          referenceType: "purchase_order",
          referenceId,
          notes: `Check-in from PO ${referenceId}`,
        }),
      });
      if (!res.ok) throw new Error("Failed to check-in inventory");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["need-to-purchase"] });
    }
  });

  // =====================
  // Email PO Modal State
  // =====================
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailPoId, setEmailPoId] = useState<number | null>(null);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", bcc: "", subject: "", message: "" });

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
    onError: (err: any) => {
      toast({ title: "Email failed", description: err?.message || "Could not send email", variant: "destructive" });
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/purchase-orders/enhanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create purchase order");
      return res.json();
    },
    onSuccess: async (data: any) => {
      setSelectedRows({});
      setQtyOverrides({});
      queryClient.invalidateQueries({ queryKey: ["need-to-purchase"] });
      try {
        const poId = data?.order?.id;
        if (poId) {
          await fetch(`/api/purchase-orders/${poId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: "ordered" })
          });
          refetchOnOrder();
        }
      } catch {}
    },
    onError: (err: any) => {
      console.error('Create PO error:', err);
    }
  });

  const toggleRow = (key: string) => {
    setSelectedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setRowQty = (key: string, value: number) => {
    setQtyOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const suggestedQty = (row: NeedToPurchaseRow) => {
    const threshold = Math.max(row.reorderPoint || 0, row.minimumQuantity || 0);
    const deficit = Math.max(0, threshold - row.onHandQuantity);
    const group = Math.max(1, row.orderGroupSize || 1);
    const groups = Math.ceil(deficit / group);
    return Math.max(group * groups, group);
  };

  const rows = useMemo(() => needToPurchase, [needToPurchase]);

  const selectedCount = useMemo(
    () => rows.filter((r) => selectedRows[`${r.supplyId}-${r.locationId}`]).length,
    [rows, selectedRows]
  );

  const orderTotalItems = useMemo(
    () => rows.reduce((sum, r) => sum + (selectedRows[`${r.supplyId}-${r.locationId}`] ? (qtyOverrides[`${r.supplyId}-${r.locationId}`] || suggestedQty(r)) : 0), 0),
    [rows, selectedRows, qtyOverrides]
  );

  const handleCreateOrder = () => {
    if (!selectedVendor) return;

    const vendorId = parseInt(selectedVendor);
    const items = rows
      .filter((r) => selectedRows[`${r.supplyId}-${r.locationId}`])
      .map((r) => ({
        supplyId: r.supplyId,
        vendorId,
        locationId: r.locationId,
        neededQuantity: suggestedQty(r),
        orderQuantity: qtyOverrides[`${r.supplyId}-${r.locationId}`] || suggestedQty(r),
        pricePerUnit: 0, // unknown here; can be updated later
      }));

    if (items.length === 0) return;

    createOrderMutation.mutate({
      vendorId,
      expectedDeliveryDate: null,
      notes: "Auto-generated from Need to Purchase",
      items,
      sendEmail: false,
    });
  };

  return (
    <Layout currentTime={currentTime}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="w-full px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Checkout Order
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">Vendor</Label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            <div className="flex items-center justify-between w-full">
                              <span>{v.company || v.name || `Vendor #${v.id}`}</span>
        </div>
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

                  <Button
                    onClick={handleCreateOrder}
                    disabled={!selectedVendor || selectedCount === 0 || createOrderMutation.isPending}
                    className="w-full"
                  >
                    {createOrderMutation.isPending ? "Creating..." : "Create Purchase Order"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">Location</Label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">Supply at location</Label>
                      <Select value={selectedSupplyId} onValueChange={setSelectedSupplyId} disabled={!selectedLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedLocationId ? "Select supply" : "Select location first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliesAtLocation.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} {s.partNumber ? `(${s.partNumber})` : ""} — on hand: {s.onHandQuantity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                      {selectedSupply && (
                        <div className="text-xs text-gray-500 mt-1">Available: {selectedSupply.onHandQuantity}</div>
                      )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Manual Check-in</Label>
                    <div className="flex gap-2">
                      <Input type="number" min={1} value={manualCheckInQty || ""} onChange={(e) => setManualCheckInQty(Math.max(0, parseInt(e.target.value) || 0))} placeholder="Qty" />
                      <Button onClick={() => manualCheckIn.mutate()} disabled={!selectedLocationId || !selectedSupplyId || manualCheckIn.isPending || (manualCheckInQty <= 0)}>Check in</Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Manual Check-out</Label>
                    <div className="flex gap-2">
                      <Input type="number" min={1} value={manualCheckOutQty || ""} onChange={(e) => setManualCheckOutQty(Math.max(0, parseInt(e.target.value) || 0))} placeholder="Qty" />
                      <Input type="number" value={manualJobId} onChange={(e) => setManualJobId(e.target.value)} placeholder="Job ID (optional)" />
                      <Button onClick={() => manualCheckOut.mutate()} disabled={!selectedLocationId || !selectedSupplyId || (manualCheckOut?.isPending ?? false) || (manualCheckOutQty <= 0) || (!!selectedSupply && manualCheckOutQty > (selectedSupply?.onHandQuantity || 0))}>Check out</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
      </div>

            {/* Main */}
            <div className="lg:col-span-4">
              <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Need To Purchase
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
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
                            <th className="px-4 py-3 text-center">Min</th>
                            <th className="px-4 py-3 text-center">Reorder</th>
                            <th className="px-4 py-3 text-center">Qty to Order</th>
          </tr>
        </thead>
        <tbody>
                          {rows.map((row) => {
                            const key = `${row.supplyId}-${row.locationId}`;
                            const value = qtyOverrides[key] ?? suggestedQty(row);
                            return (
                              <tr key={key} className="border-t">
                                <td className="px-4 py-3 align-middle">
                                  <input
                                    type="checkbox"
                                    checked={!!selectedRows[key]}
                                    onChange={() => toggleRow(key)}
                                  />
                                </td>
                                <td className="px-4 py-3 align-middle whitespace-nowrap">{row.location.name}</td>
                                <td className="px-4 py-3 align-middle">
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className="w-4 h-4 rounded border"
                                      style={{ backgroundColor: row.supply.hexColor }}
                                    />
                                    <span>{row.supply.name}</span>
                                  </div>
              </td>
                                <td className="px-4 py-3 align-middle">{row.supply.pieceSize}</td>
                                <td className="px-4 py-3 align-middle text-center">{row.onHandQuantity}</td>
                                <td className="px-4 py-3 align-middle text-center">{row.minimumQuantity}</td>
                                <td className="px-4 py-3 align-middle text-center">{row.reorderPoint}</td>
                                <td className="px-4 py-3 align-middle text-center">
                                  <Input
                  type="number"
                                    value={value}
                                    min={1}
                                    onChange={(e) => setRowQty(key, Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-28 mx-auto"
                />
              </td>
            </tr>
                            );
                          })}
        </tbody>
      </table>
    </div>
                  )}
                </CardContent>
              </Card>

              {/* On Order */}
              <Card className="mt-6 overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <Truck className="w-5 h-5 mr-2" />
                      On Order
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {onOrderLoading ? (
                    <div className="p-6 text-gray-500">Loading...</div>
                  ) : onOrderRows.length === 0 ? (
                    <div className="p-6 text-gray-500">No items currently on order</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Location</th>
                            <th className="px-4 py-3 text-left">Item</th>
                            <th className="px-4 py-3 text-left">Part number</th>
                            <th className="px-4 py-3 text-left">PO#</th>
                            <th className="px-4 py-3 text-left">Vendor</th>
                            <th className="px-4 py-3 text-center">Ordered number</th>
                            <th className="px-4 py-3 text-center">Received number</th>
                            <th className="px-4 py-3 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {onOrderRows.map((row) => {
                            const vendorName = row.vendorId ? (vendorById[row.vendorId]?.company || vendorById[row.vendorId]?.name || `Vendor #${row.vendorId}`) : "-";
                            const currentQty = receiveQty[row.itemId] ?? row.receivedQuantity ?? 0;
                            return (
                              <tr key={row.itemId} className="border-t">
                                <td className="px-4 py-3 align-middle whitespace-nowrap">{row.orderDate ? new Date(row.orderDate).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-3 align-middle whitespace-nowrap">{row.location?.name || '-'}</td>
                                <td className="px-4 py-3 align-middle whitespace-nowrap">{row.supply?.name || '-'}</td>
                                <td className="px-4 py-3 align-middle whitespace-nowrap">{row.supply?.partNumber || '-'}</td>
                                <td className="px-4 py-3 align-middle whitespace-nowrap">{row.poNumber}</td>
                                <td className="px-4 py-3 align-middle whitespace-nowrap">{vendorName}</td>
                                <td className="px-4 py-3 align-middle text-center">{row.orderedQuantity}</td>
                                <td className="px-4 py-3 align-middle text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={currentQty}
                                    onChange={(e) => setReceiveQty((prev) => ({ ...prev, [row.itemId]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                    className="w-24 mx-auto"
                                  />
                                </td>
                                <td className="px-4 py-3 align-middle">
                                  <div className="flex items-center gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => updateItemReceivedMutation.mutate({ poId: row.poId, itemId: row.itemId, receivedQuantity: currentQty })}
                                          disabled={updateItemReceivedMutation.isPending}
                                        >
                                          <CheckSquare className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Update Received</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            if (!row.location?.id || !row.supply?.id) return;
                                            const qty = Math.max(0, currentQty - row.receivedQuantity);
                                            if (qty > 0) {
                                              checkInMutation.mutate({ supplyId: row.supply.id, locationId: row.location.id, quantity: qty, referenceId: row.poId });
                                            }
                                            updateItemReceivedMutation.mutate({ poId: row.poId, itemId: row.itemId, receivedQuantity: currentQty });
                                          }}
                                          disabled={checkInMutation.isPending || updateItemReceivedMutation.isPending}
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Receive & Check In</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            setEmailPoId(row.poId);
                                            setEmailForm({ to: "", cc: "", bcc: "", subject: `Purchase Order ${row.poNumber || row.poId}`, message: "" });
                                            setEmailOpen(true);
                                          }}
                                        >
                                          <Mail className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Email PO</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

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
                    <Button onClick={() => sendEmailMutation.mutate()} disabled={sendEmailMutation.isPending}>Send Email</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
