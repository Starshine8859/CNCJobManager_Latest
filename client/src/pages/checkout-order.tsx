import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, ShoppingCart, Filter, Users, CheckSquare, FileText } from "lucide-react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
    onSuccess: () => {
      setSelectedRows({});
      setQtyOverrides({});
      queryClient.invalidateQueries({ queryKey: ["need-to-purchase"] });
    },
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
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                <CardContent>
                  <p className="text-sm text-gray-500">No filters yet</p>
                </CardContent>
              </Card>
      </div>

            {/* Main */}
            <div className="lg:col-span-3">
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
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
