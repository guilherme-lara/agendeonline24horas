import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { BookingProvider } from "@/contexts/BookingContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, ShieldAlert, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react"; // <-- Adicionado
import { supabase } from "@/integrations/supabase/client"; // <-- Adicionado
import ErrorBoundary from "@/components/ErrorBoundary";
// ... (seus outros imports permanecem iguais)

// 1. CONFIGURAÇÃO MAIS AGRESSIVA PARA DASHBOARDS
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Acorda o app ao focar na aba
      refetchOnReconnect: 'always', // Se o Wi-Fi oscilou enquanto estava fora, força a volta
      staleTime: 1000 * 30, // Reduzi para 30 segundos (Dashboard precisa de dados frescos)
      retry: 2, 
      gcTime: 1000 * 60 * 60,
    },
  },
});

// ... (Componente PlanGate permanece igual)

const AppContent = () => {
  const { pathname } = useLocation();
  const hideFooter = pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin");

  // --- O SEGREDO: LISTENER DE SESSÃO ---
  // Este efeito garante que, se o token renovar no fundo, o QueryClient "acorde"
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Se o usuário voltou e o token renovou, limpamos o cache para garantir dados novos
        queryClient.invalidateQueries(); 
      }
      if (event === 'SIGNED_OUT') {
        queryClient.clear(); // Segurança: limpa tudo ao deslogar
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Header />
      <Routes>
        {/* ... suas rotas permanecem iguais */}
      </Routes>
      {!hideFooter && <Footer />}
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <BookingProvider>
              <AppContent />
            </BookingProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
