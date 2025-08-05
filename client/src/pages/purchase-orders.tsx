import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Calendar, Plus, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";
import { useLocation } from "wouter";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      
      const response = await fetch(`/api/purchase-orders?${params}`);
      if (!response.ok) throw new Error("Failed to fetch purchase orders");
      return response.json();
    }
  });

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
        return 'bg-yellow-100 text-yellow-800';
      case 'ordered':
        return 'bg-blue-100 text-blue-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  return (
    <Layout currentTime={currentTime}>
      <div className="flex h-screen bg-gray-50">
        {/* Left Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 p-6">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <nav className="text-sm text-gray-500 mb-2">
                <span>Home / Inventory / Purchase Orders</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="search"
                    placeholder="Search PO# or item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="fromDate">From Date</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="toDate">To Date</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="ordered">Ordered</option>
                  <option value="received">Received</option>
                </select>
              </div>

              <Button 
                onClick={handleCreatePurchaseOrder}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Purchase Order
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Purchase Orders ({filteredPurchaseOrders.length})
                </h2>
                <p className="text-sm text-gray-500">
                  Manage and track purchase orders
                </p>
              </div>
            </div>
          </div>

          {/* Purchase Orders List */}
          <div className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading purchase orders...</p>
              </div>
            ) : filteredPurchaseOrders.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase orders found</h3>
                <p className="text-gray-500">Get started by creating your first purchase order.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPurchaseOrders.map((po: PurchaseOrder) => (
                  <Card key={po.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <CardTitle className="text-lg">{po.poNumber}</CardTitle>
                            <p className="text-sm text-gray-500">
                              Created by {po.createdByUser.username}
                            </p>
                          </div>
                          <Badge className={getStatusBadgeColor(po.status)}>
                            {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{formatCurrency(po.totalAmount)}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(po.dateOrdered)}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {po.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex-1">
                              <p className="font-medium">{item.supply.name}</p>
                              <p className="text-sm text-gray-500">
                                Vendor: {item.vendor.name} • Qty: {item.quantity} • 
                                Price: {formatCurrency(item.pricePerUnit)}/unit
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
                              <p className="text-sm text-gray-500">
                                On Hand: {item.supply.quantityOnHand}
                              </p>
                            </div>
                          </div>
                        ))}
                        {po.additionalComments && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-md">
                            <p className="text-sm text-gray-600">
                              <strong>Comments:</strong> {po.additionalComments}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
} 