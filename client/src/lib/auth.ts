import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "./queryClient";

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthResponse {
  user: User;
}

export function useAuth() {
  const { data, isLoading, error } = useQuery<AuthResponse>({
    queryKey: ['/api/me'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: data?.user || null,
    loading: isLoading,
    error,
  };
}
