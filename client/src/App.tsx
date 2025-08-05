import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import UserManagement from "@/pages/user-management";
import PopupPage from "@/pages/popup";
import NotFound from "@/pages/not-found";
import Supplies from "@/pages/supplies";
import PurchaseOrders from "@/pages/purchase-orders";
import CreatePurchaseOrder from "@/pages/create-purchase-order";
import CheckoutOrder from "@/pages/checkout-order";
import SupplyLocations from "@/pages/supply-locations";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

function Router() {
  const { user, loading } = useAuth();

  // Check if setup is required
  const { data: setupData, isLoading: setupLoading } = useQuery<{ required: boolean }>({
    queryKey: ['/api/setup/required'],
    retry: false,
  });

  if (loading || setupLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Always show login page first (it handles setup internally)
  if (!user) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/admin" component={Admin} />
      <Route path="/users" component={UserManagement} />
      <Route path="/popup/:jobId" component={PopupPage} />
      <Route path="/supplies" component={Supplies} />
      <Route path="/purchase-orders" component={PurchaseOrders} />
      <Route path="/create-purchase-order" component={CreatePurchaseOrder} />
      <Route path="/checkout-order" component={CheckoutOrder} />
      <Route path="/supply-locations" component={SupplyLocations} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
