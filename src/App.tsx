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
        {/* --- ÁREA PÚBLICA / LANDING --- */}
        <Route path="/" element={<SaaSLanding />} />
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Login />} />
        
        {/* --- FLUXO DE CLIENTE (BOOKING) --- */}
        <Route path="/agendamentos/:slug" element={<PublicBooking />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/meus-agendamentos" element={<MyAppointments />} />
        <Route path="/appointments" element={<MyAppointments />} />
        <Route path="/:slug/success" element={<BookingSuccess />} />
        
        {/* --- ONBOARDING E VENDAS --- */}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/subscribe/:planId" element={<Subscribe />} />

        {/* --- PAINÉIS ADMINISTRATIVOS --- */}
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/admin" element={<Admin />} />

        {/* --- ECOSSISTEMA DASHBOARD (COM SIDEBAR) --- */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="servicos" element={<Servicos />} />
          <Route path="profissionais" element={<Profissionais />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="agendamento-online" element={<AgendamentoOnline />} />
          
          {/* RECURSOS BLOQUEADOS (PLANO GROWTH +) */}
          <Route path="caixa" element={
            <PlanGate minPlan="growth"><Caixa /></PlanGate>
          } />
          <Route path="relatorios" element={
            <PlanGate minPlan="growth"><Relatorios /></PlanGate>
          } />
          <Route path="despesas" element={
            <PlanGate minPlan="growth"><Despesas /></PlanGate>
          } />
          <Route path="produtos" element={
            <PlanGate minPlan="growth"><Produtos /></PlanGate>
          } />
          <Route path="aniversarios" element={
            <PlanGate minPlan="growth"><Aniversarios /></PlanGate>
          } />

          {/* RECURSOS EXCLUSIVOS (PLANO PRO) */}
          <Route path="pacotes" element={
            <PlanGate minPlan="pro"><Pacotes /></PlanGate>
          } />
          <Route path="pagamentos" element={
            <PlanGate minPlan="pro"><Pagamentos /></PlanGate>
          } />
          <Route path="aprovacao-sinais" element={
            <PlanGate minPlan="pro"><AprovacaoSinais /></PlanGate>
          } />
        </Route>

        {/* FALLBACK 404 */}
        <Route path="*" element={<NotFound />} />
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
