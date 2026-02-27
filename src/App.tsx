// 1. Core React e Bibliotecas Externas
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// 2. Supabase e Integrações
import { supabase } from "@/integrations/supabase/client";

// 3. Hooks e Contextos Global
import { useBarbershop } from "@/hooks/useBarbershop";
import { BookingProvider } from "@/contexts/BookingContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

// 4. Componentes de UI e Layout
import { Loader2, ShieldAlert, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ErrorBoundary";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DashboardLayout from "./components/DashboardLayout";

// 5. Páginas Públicas e Autenticação
import SaaSLanding from "./pages/SaaSLanding";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Subscribe from "./pages/Subscribe";
import PublicBooking from "./pages/PublicBooking";
import Booking from "./pages/Booking";
import BookingSuccess from "./pages/BookingSuccess";
import MyAppointments from "./pages/MyAppointments";
import NotFound from "./pages/NotFound";

// 6. Páginas Administrativas
import SuperAdmin from "./pages/SuperAdmin";
import Admin from "./pages/Admin";

// 7. Sub-páginas do Dashboard
import Dashboard from "./pages/Dashboard";
import Agenda from "./pages/dashboard/Agenda";
import Clientes from "./pages/dashboard/Clientes";
import Servicos from "./pages/dashboard/Servicos";
import Profissionais from "./pages/dashboard/Profissionais";
import Configuracoes from "./pages/dashboard/Configuracoes";
import AgendamentoOnline from "./pages/dashboard/AgendamentoOnline";
import Caixa from "./pages/dashboard/Caixa";
import Relatorios from "./pages/dashboard/Relatorios";
import Despesas from "./pages/dashboard/Despesas";
import Produtos from "./pages/dashboard/Produtos";
import Aniversarios from "./pages/dashboard/Aniversarios";
import Pacotes from "./pages/dashboard/Pacotes";
import Pagamentos from "./pages/dashboard/Pagamentos";
import AprovacaoSinais from "./pages/dashboard/AprovacaoSinais";

// --- CONFIGURAÇÃO INDUSTRIAL DO MOTOR DE CACHE ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Revalida ao voltar para a aba
      refetchOnReconnect: 'always', // Reconecta se o Wi-Fi oscilar
      staleTime: 1000 * 30, // Dados considerados "frescos" por 30 segundos
      retry: 2,
      gcTime: 1000 * 60 * 60, // Limpa o cache após 1 hora de inatividade
    },
  },
});

// --- COMPONENTE PORTEIRO DE PLANOS (MONETIZAÇÃO) ---
const PlanGate = ({ children, minPlan }: { children: React.ReactNode, minPlan: 'essential' | 'growth' | 'pro' }) => {
  const { barbershop, loading } = useBarbershop() as any;
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-2" />
        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Validando Licença...</p>
      </div>
    );
  }

  const planRank = { essential: 0, growth: 1, pro: 2 };
  const currentPlan = (barbershop?.plan_name?.toLowerCase() || 'essential') as keyof typeof planRank;
  
  if (planRank[currentPlan] < planRank[minPlan]) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-300">
        <div className="bg-amber-500/10 p-6 rounded-[2rem] mb-6 border border-amber-500/20">
          <ShieldAlert className="h-12 w-12 text-amber-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Recurso Premium</h2>
        <p className="text-slate-400 max-w-md mb-8 text-sm">
          O acesso a este módulo está disponível apenas nos planos <span className="text-cyan-400 font-bold">Growth</span> ou <span className="text-amber-400 font-bold">Pro</span>.
        </p>
        <Button 
          onClick={() => window.location.href = '/dashboard/configuracoes'} 
          className="bg-amber-500 hover:bg-amber-400 text-black font-black px-10 h-14 rounded-2xl shadow-xl shadow-amber-900/20"
        >
          <Rocket className="h-5 w-5 mr-2" /> Fazer Upgrade Agora
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};

// --- CONTEÚDO PRINCIPAL COM GERENCIAMENTO DE ROTAS ---
const AppContent = () => {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const hideFooter = pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin");

  // --- O SEGREDO: SINCRONIA DE SESSÃO ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Garante que o app "acorde" ao renovar o token
        queryClient.invalidateQueries(); 
      }
      if (event === 'SIGNED_OUT') {
        queryClient.clear(); // Limpa o cache por segurança ao sair
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return (
    <>
      <Header />
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/" element={<SaaSLanding />} />
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/subscribe/:planId" element={<Subscribe />} />

        {/* Rotas de Cliente (Booking) */}
        <Route path="/agendamentos/:slug" element={<PublicBooking />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/meus-agendamentos" element={<MyAppointments />} />
        <Route path="/appointments" element={<MyAppointments />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/booking/success" element={<BookingSuccess />} />
        <Route path="/:slug/success" element={<BookingSuccess />} />

        {/* Gestão Administrativa */}
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/admin" element={<Admin />} />

        {/* Dashboard e Sub-páginas com Sidebar */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="servicos" element={<Servicos />} />
          <Route path="profissionais" element={<Profissionais />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="agendamento-online" element={<AgendamentoOnline />} />
          
          {/* Growth Tier + */}
          <Route path="caixa" element={<PlanGate minPlan="growth"><Caixa /></PlanGate>} />
          <Route path="relatorios" element={<PlanGate minPlan="growth"><Relatorios /></PlanGate>} />
          <Route path="despesas" element={<PlanGate minPlan="growth"><Despesas /></PlanGate>} />
          <Route path="produtos" element={<PlanGate minPlan="growth"><Produtos /></PlanGate>} />
          <Route path="aniversarios" element={<PlanGate minPlan="growth"><Aniversarios /></PlanGate>} />

          {/* Pro Tier + */}
          <Route path="pacotes" element={<PlanGate minPlan="pro"><Pacotes /></PlanGate>} />
          <Route path="pagamentos" element={<PlanGate minPlan="pro"><Pagamentos /></PlanGate>} />
          <Route path="aprovacao-sinais" element={<PlanGate minPlan="pro"><AprovacaoSinais /></PlanGate>} />
        </Route>

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
