import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Calendar, Plus, Search, Filter, Package, DollarSign, Clock, CheckCircle, AlertCircle, Truck } from "lucide-react";
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
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
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
    return filteredPurchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
  };

  return (
    <Layout currentTime={currentTime}>
      <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        {/* Left Sidebar */}
        <div className="w-80 bg-white/80 backdrop-blur-sm border-r border-gray-200/60 shadow-lg">
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

          {/* Purchase Orders List */}
          <div className="flex-1 overflow-auto px-8 py-6">
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
              <div className="space-y-4">
                {filteredPurchaseOrders.map((po: PurchaseOrder) => (
                  <Card key={po.id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm hover:-translate-y-1 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                    
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="p-3 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-xl">
                            <FileText className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <CardTitle className="text-xl font-bold text-gray-900 mb-1">{po.poNumber}</CardTitle>
                            <p className="text-sm text-gray-500 flex items-center space-x-2">
                              <span>Created by {po.createdByUser.username}</span>
                              <span>•</span>
                              <span>{formatDate(po.dateOrdered)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge className={`${getStatusBadgeColor(po.status)} border flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-full`}>
                            {getStatusIcon(po.status)}
                            <span>{po.status.charAt(0).toUpperCase() + po.status.slice(1)}</span>
                          </Badge>
                          <div className="text-right">
                            <p className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                              {formatCurrency(po.totalAmount)}
                            </p>
                            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {po.items.map((item, index) => (
                          <div key={item.id} className={`flex items-center justify-between py-3 px-4 rounded-lg transition-all duration-200 ${index % 2 === 0 ? 'bg-gray-50/50' : 'bg-blue-50/30'} hover:bg-indigo-50/50 group/item`}>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                  <Package className="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 group-hover/item:text-indigo-700 transition-colors">
                                    {item.supply.name}
                                  </p>
                                  <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                    <span className="flex items-center space-x-1">
                                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                      <span>{item.vendor.name}</span>
                                    </span>
                                    <span>Qty: <span className="font-medium text-gray-700">{item.quantity}</span></span>
                                    <span>Price: <span className="font-medium text-gray-700">{formatCurrency(item.pricePerUnit)}/unit</span></span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-lg font-bold text-gray-900">{formatCurrency(item.totalPrice)}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs text-gray-500">Stock:</span>
                                <Badge className={`text-xs px-2 py-0.5 ${item.supply.quantityOnHand > 10 ? 'bg-green-100 text-green-700' : item.supply.quantityOnHand > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                  {item.supply.quantityOnHand}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {po.additionalComments && (
                          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                            <div className="flex items-start space-x-3">
                              <div className="p-1.5 bg-blue-100 rounded-lg">
                                <FileText className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-blue-800 mb-1">Additional Comments</p>
                                <p className="text-sm text-blue-700 leading-relaxed">{po.additionalComments}</p>
                              </div>
                            </div>
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