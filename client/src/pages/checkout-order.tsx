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
  allocatedQuantity?: number;
  availableQuantity?: number;
  minimumQuantity: number;
  reorderPoint: number;
  orderGroupSize: number;
  suggestedOrderQty?: number;
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
  const [hideFullyReceived, setHideFullyReceived] = useState(true);
  const [needPage, setNeedPage] = useState(1);
  const [onOrderPage, setOnOrderPage] = useState(1);
  const pageSize = 10;

  const displayedOnOrderRows: EnhancedPOItemRow[] = useMemo(() => {
    const base = !hideFullyReceived ? onOrderRows : onOrderRows.filter((r) => (r.receivedQuantity || 0) < (r.orderedQuantity || 0));
    return base;
  }, [onOrderRows, hideFullyReceived]);

  const totalOnOrder = displayedOnOrderRows.length;
  const totalOnOrderPages = Math.max(1, Math.ceil(totalOnOrder / pageSize));
  const onOrderStart = (onOrderPage - 1) * pageSize;
  const onOrderEnd = Math.min(totalOnOrder, onOrderStart + pageSize);
  const paginatedOnOrderRows = displayedOnOrderRows.slice(onOrderStart, onOrderEnd);

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
      toast({ title: "Saved", description: "Received quantity updated" });
      refetchOnOrder();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to update received", variant: "destructive" })
  });

  // Manual Check-In/Out state
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedSupplyId, setSelectedSupplyId] = useState<string>("");
  const [manualCheckInQty, setManualCheckInQty] = useState<number>(0);
  const [manualCheckOutQty, setManualCheckOutQty] = useState<number>(0);
  const [manualNotes, setManualNotes] = useState<string>("");

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

  // Manual add-to-order box state
  const [manualOrderQty, setManualOrderQty] = useState<number>(1);
  const [manualAdditions, setManualAdditions] = useState<NeedToPurchaseRow[]>([]);

  const addManualItemToOrder = () => {
    const locId = Number(selectedLocationId);
    const supId = Number(selectedSupplyId);
    if (!locId || !supId || !selectedSupply || manualOrderQty <= 0) return;
    const loc = (locations as any[]).find((l: any) => l.id === locId);
    const key = `${supId}-${locId}`;

    const newRow: NeedToPurchaseRow = {
      supplyId: supId,
      locationId: locId,
      onHandQuantity: selectedSupply.onHandQuantity || 0,
      allocatedQuantity: 0,
      availableQuantity: selectedSupply.onHandQuantity || 0,
      minimumQuantity: 0,
      reorderPoint: 0,
      orderGroupSize: 1,
      suggestedOrderQty: manualOrderQty,
      supply: {
        id: supId,
        name: selectedSupply.name || "",
        hexColor: "#cccccc",
        pieceSize: "",
      },
      location: {
        id: locId,
        name: loc?.name || "",
      },
    };

    setManualAdditions((prev) => {
      // prevent duplicate identical row
      if (prev.find((r) => r.supplyId === supId && r.locationId === locId)) return prev;
      return [...prev, newRow];
    });
    setSelectedRows((prev) => ({ ...prev, [key]: true }));
    setQtyOverrides((prev) => ({ ...prev, [key]: Math.max(1, manualOrderQty) }));
    setManualOrderQty(1);
  };

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
          referenceType: "manual",
          notes: manualNotes?.trim() ? manualNotes.trim() : "Manual check-out",
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
      setManualNotes("");
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

  const createGroupedOrders = useMutation({
    mutationFn: async () => {
      // Build items grouped by preferred vendor
      const selected = rows.filter((r) => selectedRows[`${r.supplyId}-${r.locationId}`]);
      if (selected.length === 0) throw new Error("No rows selected");

      const groups: Record<number, any[]> = {};

      // Resolve vendor and price per unit per row
      for (const r of selected) {
        const resp = await fetch(`/api/supplies/${r.supplyId}/vendors`, { credentials: "include" });
        if (!resp.ok) continue;
        const vs = await resp.json();
        // Prefer vendor with isPreferred; else first
        const preferred = (vs || []).find((v: any) => v.isPreferred) || (vs || [])[0];
        if (!preferred || !preferred.id) continue;

        const vendorId = preferred.id as number;
        const key = `${r.supplyId}-${r.locationId}`;
        const orderQty = qtyOverrides[key] || suggestedQty(r);
        if (!groups[vendorId]) groups[vendorId] = [];
        groups[vendorId].push({
          supplyId: r.supplyId,
          vendorId,
          locationId: r.locationId,
          neededQuantity: suggestedQty(r),
          orderQuantity: orderQty,
          pricePerUnit: Math.max(0, Math.floor((preferred.price ?? 0))),
        });
      }

      const vendorIds = Object.keys(groups).map((k) => parseInt(k));
      if (vendorIds.length === 0) throw new Error("No preferred vendors found for selected items");

      const results = [] as any[];
      for (const vendorId of vendorIds) {
        const payload = {
          vendorId,
          expectedDeliveryDate: null,
          notes: "Auto-generated from Need to Purchase (preferred vendors)",
          items: groups[vendorId],
          sendEmail: false,
        };
        const res = await fetch("/api/purchase-orders/enhanced", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create purchase order");
        const json = await res.json();
        // Explicitly set status to ordered (defensive)
        try {
          const poId = json?.order?.id;
          if (poId) {
            await fetch(`/api/purchase-orders/${poId}/status`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ status: "ordered" })
            });
          }
        } catch {}
        results.push(json);
      }
      return results;
    },
    onSuccess: () => {
      setSelectedRows({});
      setQtyOverrides({});
      queryClient.invalidateQueries({ queryKey: ["need-to-purchase"] });
      refetchOnOrder();
      toast({ title: "Success", description: "Purchase orders created by preferred vendors" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to create grouped POs", variant: "destructive" })
  });

  const toggleRow = (key: string) => {
    setSelectedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setRowQty = (key: string, value: number) => {
    setQtyOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const suggestedQty = (row: NeedToPurchaseRow) => {
    if (row.suggestedOrderQty && row.suggestedOrderQty > 0) return row.suggestedOrderQty;
    const available = typeof row.availableQuantity === 'number'
      ? row.availableQuantity
      : Math.max(0, (row.onHandQuantity || 0) - (row.allocatedQuantity || 0));
    const threshold = Math.max(row.reorderPoint || 0, row.minimumQuantity || 0);
    let base = Math.max(0, threshold - available);
    if ((row.allocatedQuantity || 0) > 0 && base < (row.allocatedQuantity || 0)) {
      base = row.allocatedQuantity || 0;
    }
    const group = Math.max(1, row.orderGroupSize || 1);
    const groups = Math.ceil(base / group);
    return Math.max(group, groups * group);
  };

  const rows = useMemo(() => [...needToPurchase, ...manualAdditions], [needToPurchase, manualAdditions]);
  const totalNeed = rows.length;
  const totalNeedPages = Math.max(1, Math.ceil(totalNeed / pageSize));
  const needStart = (needPage - 1) * pageSize;
  const needEnd = Math.min(totalNeed, needStart + pageSize);
  const paginatedNeedRows = rows.slice(needStart, needEnd);

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
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            {/* Main full-width */}
            <div className="lg:col-span-1">
              {/* Add Item to Order */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Add item to order
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">Location</Label>
                    <Select value={selectedLocationId} onValueChange={(v) => { setSelectedLocationId(v); setSelectedSupplyId(""); }}>
                      <SelectTrigger className="w-full">
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
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">Supply</Label>
                    <Select value={selectedSupplyId} onValueChange={setSelectedSupplyId} disabled={!selectedLocationId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={selectedLocationId ? "Select supply" : "Select location first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliesAtLocation.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} {s.partNumber ? `(${s.partNumber})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSupply && (
                      <div className="text-xs text-gray-500 mt-1">On hand: {selectedSupply.onHandQuantity}</div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">Qty to order</Label>
                    <Input type="number" min={1} value={manualOrderQty} onChange={(e) => setManualOrderQty(Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={addManualItemToOrder} disabled={!selectedLocationId || !selectedSupplyId || manualOrderQty <= 0}>Add to order list</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Need To Purchase */}
              <Card className="mt-6 overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Need To Purchase
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 px-3 py-1.5 text-sm">
                        Selected: {selectedCount}
                      </div>
                      <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 px-3 py-1.5 text-sm">
                        Total qty: {orderTotalItems}
                      </div>
                      <div className="w-64">
                        <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select vendor (single PO)" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((v: any) => (
                              <SelectItem key={v.id} value={String(v.id)}>
                                {v.company || v.name || `Vendor #${v.id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateOrder} disabled={!selectedVendor || selectedCount === 0 || (createOrderMutation as any).isPending}>Create PO</Button>
                      <Button variant="outline" onClick={() => (createGroupedOrders as any).mutate()} disabled={selectedCount === 0 || (createGroupedOrders as any).isPending}>Group by preferred vendors</Button>
                    </div>
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
                            <th className="px-4 py-3 text-center">Allocated</th>
                            <th className="px-4 py-3 text-center">Available</th>
                            <th className="px-4 py-3 text-center">Min</th>
                            <th className="px-4 py-3 text-center">Reorder</th>
                            <th className="px-4 py-3 text-center">Qty to Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedNeedRows.map((row: any) => {
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
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/60 text-sm text-gray-600">
                        <div>Showing {totalNeed === 0 ? 0 : needStart + 1}-{needEnd} of {totalNeed}</div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setNeedPage(Math.max(1, needPage - 1))} disabled={needPage === 1}>Previous</Button>
                          <span>Page {needPage} of {totalNeedPages}</span>
                          <Button variant="outline" size="sm" onClick={() => setNeedPage(Math.min(totalNeedPages, needPage + 1))} disabled={needPage === totalNeedPages}>Next</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* On Order retained here */}
              <Card className="mt-6 overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <Truck className="w-5 h-5 mr-2" />
                      On Order
                    </CardTitle>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" checked={hideFullyReceived} onChange={(e) => setHideFullyReceived(e.target.checked)} />
                      Hide fully received
                    </label>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {onOrderLoading ? (
                    <div className="p-6 text-gray-500">Loading...</div>
                  ) : displayedOnOrderRows.length === 0 ? (
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
                          {paginatedOnOrderRows.map((row) => {
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
                                          onClick={async () => {
                                            try {
                                              if (!row.location?.id || !row.supply?.id) return;
                                              const delta = Math.max(0, (currentQty || 0) - (row.receivedQuantity || 0));
                                              if (delta > 0) {
                                                await checkInMutation.mutateAsync({ supplyId: row.supply.id, locationId: row.location.id, quantity: delta, referenceId: row.poId });
                                              }
                                              await updateItemReceivedMutation.mutateAsync({ poId: row.poId, itemId: row.itemId, receivedQuantity: currentQty || 0 });
                                              toast({ title: "Success", description: delta > 0 ? "Received and checked in" : "Received updated" });
                                              refetchOnOrder();
                                            } catch (e: any) {
                                              toast({ title: "Error", description: e?.message || "Failed to receive", variant: "destructive" });
                                            }
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
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/60 text-sm text-gray-600">
                        <div>Showing {totalOnOrder === 0 ? 0 : onOrderStart + 1}-{onOrderEnd} of {totalOnOrder}</div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setOnOrderPage(Math.max(1, onOrderPage - 1))} disabled={onOrderPage === 1}>Previous</Button>
                          <span>Page {onOrderPage} of {totalOnOrderPages}</span>
                          <Button variant="outline" size="sm" onClick={() => setOnOrderPage(Math.min(totalOnOrderPages, onOrderPage + 1))} disabled={onOrderPage === totalOnOrderPages}>Next</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
