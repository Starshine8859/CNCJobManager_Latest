import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { loginSchema, type Login } from "@shared/schema";

export default function Login() {
  const [isSetupMode, setIsSetupMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if setup is required
  const { data: setupData } = useQuery<{ required: boolean }>({
    queryKey: ['/api/setup/required'],
    retry: false,
  });

  const form = useForm<Login>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: (data: Login) => apiRequest('POST', '/api/login', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me'] });
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const setupMutation = useMutation({
    mutationFn: (data: Login) => apiRequest('POST', '/api/setup', data),
    onSuccess: (response, variables) => {
      toast({
        title: "Setup Complete",
        description: "Admin user created successfully. Logging you in...",
      });
      setTimeout(() => {
        loginMutation.mutate(variables);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to create admin user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Login) => {
    if (isSetupMode || setupData?.required) {
      setupMutation.mutate(data);
    } else {
      loginMutation.mutate(data);
    }
  };

  const isLoading = loginMutation.isPending || setupMutation.isPending;
  const showSetup = isSetupMode || setupData?.required;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-cyan-100 transition-colors duration-500 font-sans">
      <Card className="w-full max-w-md mx-4 shadow-2xl rounded-3xl border-0 animate-fade-in bg-white/80 backdrop-blur-md">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center justify-center space-y-2 mb-4">
            <div className="bg-indigo-500 rounded-full p-3 shadow-lg mb-2 animate-pop-in">
              <span className="text-white text-4xl">🧩</span>
            </div>
            <CardTitle className="text-3xl font-extrabold text-gray-900 tracking-tight">CNC Job Manager</CardTitle>
          </div>
          <p className="text-gray-500 text-base font-medium">
            {showSetup ? "Initial Setup - Create Admin User" : "Sign in to your account"}
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter username" 
                        {...field}
                        disabled={isLoading}
                        className="rounded-xl border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-semibold">Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter password" 
                        {...field}
                        disabled={isLoading}
                        className="rounded-xl border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-lg shadow-md transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? "Please wait..." : (showSetup ? "Create Admin User" : "Sign In")}
              </Button>
            </form>
          </Form>

          {!setupData?.required && !isSetupMode && (
            <div className="mt-6 text-center">
              <Button 
                variant="link" 
                onClick={() => setIsSetupMode(true)}
                className="text-sm text-indigo-500 hover:underline"
              >
                Need to run initial setup?
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <style>{`
        .animate-fade-in { animation: fadeIn 0.8s ease; }
        .animate-pop-in { animation: popIn 0.5s cubic-bezier(.68,-0.55,.27,1.55); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
