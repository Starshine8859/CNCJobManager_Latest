import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Clock, Menu, X, Settings, LogOut, Plus, Package, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
  currentTime?: Date;
}

export default function Layout({ children, currentTime = new Date() }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch dashboard stats for sidebar
  const { data: stats } = useQuery<{
    activeJobs: number;
    sheetsCutToday: number;
    avgJobTime: number;
    avgSheetTime: number;
    materialColors: number;
    jobsByStatus: { waiting: number; in_progress: number; paused: number; done: number };
  }>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/logout'),
    onSuccess: () => {
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    },
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const totalJobs = Number(stats?.jobsByStatus?.waiting || 0) + Number(stats?.jobsByStatus?.in_progress || 0) + Number(stats?.jobsByStatus?.paused || 0) + Number(stats?.jobsByStatus?.done || 0);

  const statusFilters = [
    {
      key: 'all',
      label: 'All jobs',
      color: 'bg-blue-500',
      count: totalJobs,
      badgeColor: 'bg-blue-100 text-blue-600',
    },
    {
      key: 'waiting',
      label: 'Waiting',
      color: 'bg-gray-400',
      count: Number(stats?.jobsByStatus?.waiting || 0),
      badgeColor: 'bg-gray-100 text-gray-600',
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      color: 'bg-orange-500',
      count: Number(stats?.jobsByStatus?.in_progress || 0),
      badgeColor: 'bg-orange-100 text-orange-600',
    },
    {
      key: 'paused',
      label: 'Paused',
      color: 'bg-yellow-500',
      count: Number(stats?.jobsByStatus?.paused || 0),
      badgeColor: 'bg-yellow-100 text-yellow-600',
    },
    {
      key: 'done',
      label: 'Done',
      color: 'bg-green-500',
      count: Number(stats?.jobsByStatus?.done || 0),
      badgeColor: 'bg-green-100 text-green-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="text-primary text-2xl">✂️</div>
                <h1 className="text-xl font-semibold text-gray-900">CNC Job Manager</h1>
              </div>
              <nav className="hidden md:flex space-x-6">
                <Link href="/">
                  <a className={`font-medium pb-2 ${
                    location === '/' 
                      ? 'text-primary border-b-2 border-primary' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}>
                    Dashboard
                  </a>
                </Link>

                {user?.role === 'super_admin' && (
                  <Link href="/users">
                    <a className={`font-medium pb-2 ${
                      location === '/users' 
                        ? 'text-primary border-b-2 border-primary' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                      User Management
                    </a>
                  </Link>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={`font-medium pb-2 h-auto p-0 ${
                      location.startsWith('/supplies') || location.startsWith('/purchase-orders') || location.startsWith('/checkout-order') || location.startsWith('/supply-locations')
                        ? 'text-primary border-b-2 border-primary' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                      <Package className="h-4 w-4 mr-2" />
                      <span>Inventory</span>
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => setLocation("/supplies")}>
                      <Package className="h-4 w-4 mr-2" />
                      Supplies
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/purchase-orders")}>
                      <Package className="h-4 w-4 mr-2" />
                      Purchase Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/checkout-order")}>
                      <Package className="h-4 w-4 mr-2" />
                      Checkout/Order
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/supply-locations")}>
                      <Package className="h-4 w-4 mr-2" />
                      Supply Locations
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="text-lg">👤</div>
                <span>{user?.username}</span>
                <Badge variant="secondary" className="text-xs">
                  {user?.role?.replace('_', ' ')}
                </Badge>
              </div>
              <div className="text-sm text-gray-500 flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{formatTime(currentTime)}</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <aside className={`w-64 bg-white shadow-sm border-r border-gray-200 ${
          sidebarOpen ? 'block' : 'hidden'
        } md:block`}>
          <div className="p-6">
            {/* Quick Actions */}
            <div className="mb-6">
              <Button 
                className="w-full"
                onClick={() => {
                  // This will be handled by the dashboard component
                  const event = new CustomEvent('openJobModal');
                  window.dispatchEvent(event);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            </div>

            {/* Job Status Filters */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Job Status</h3>
              <div className="space-y-2">
                {statusFilters.map((status) => (
                  <div
                    key={status.key}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      const event = new CustomEvent('filterByStatus', { detail: status.key });
                      window.dispatchEvent(event);
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 ${status.color} rounded-full`} />
                      <span className="text-sm text-gray-700">{status.label}</span>
                    </div>
                    <Badge className={`text-xs ${status.badgeColor}`}>
                      {status.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Activity</h3>
              <div className="space-y-3">
                <div className="text-xs text-gray-600">
                  <div className="font-medium">System ready</div>
                  <div className="text-gray-400">Real-time updates active</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
