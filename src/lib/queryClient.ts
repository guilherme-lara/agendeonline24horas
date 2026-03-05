import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      refetchOnWindowFocus: false,
      staleTime: 300000,
      retry: 1
    },
    mutations: {
      networkMode: 'always'
    }
  }
});