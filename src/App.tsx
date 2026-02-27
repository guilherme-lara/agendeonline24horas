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
import ErrorBoundary from "@/components/ErrorBoundary";
import Header from "@/components/Header";
import SaaSLanding from "./pages/SaaSLanding";
import Booking from "./pages/Booking";
import BookingSuccess from "./pages/BookingSuccess";
import MyAppointments from "./pages/MyAppointments";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import SuperAdmin from "./pages/SuperAdmin";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Subscribe from "./pages/Subscribe";
import PublicBooking from "./pages/PublicBooking";
import NotFound from "./pages/NotFound";
import Footer from "@/components/Footer";
import DashboardLayout from "./components/DashboardLayout";

// Dashboard sub-pages
import Agenda from "./pages/dashboard/Agenda";
import Despesas from "./pages/dashboard/Despesas";
import Clientes from "./pages/dashboard/Clientes";
import Aniversarios from "./pages/dashboard/Aniversarios";
import Pacotes from "./pages/dashboard/Pacotes";
import Relatorios from "./pages/dashboard/Relatorios";
import Profissionais from "./pages/dashboard/Profissionais";
import Produtos from "./pages/dashboard/Produtos";
import Configuracoes from "./pages/dashboard/Configuracoes";
import Servicos from "./pages/dashboard/Servicos";
import AgendamentoOnline from "./pages/dashboard/AgendamentoOnline";
import Pagamentos from "./pages/dashboard/Pagamentos";
import Caixa from "./pages/dashboard/Caixa";
import AprovacaoSinais from "./pages/dashboard/AprovacaoSinais";

// --- CONFIGURAÇÃO DO QUERY CLIENT BLINDADA ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // MÁGICA: Revalida os dados sempre que você volta para a aba
      refetchOnWindowFocus: true, 
      // Se os dados têm menos de 5 min, ele não faz barulho, apenas usa o cache
      staleTime: 1000 * 60 * 5, 
      // Tenta recuperar 3 vezes antes de mostrar erro
      retry: 3,
      // Se a aba hibernar por horas, o dado é jogado fora e buscado do zero ao voltar
      gcTime: 1000 * 60 * 60, 
    },
  },
});

// --- COMPONENTE PORTEIRO DE PLANOS (PLAN GATE) ---
const PlanGate = ({ children, minPlan }: { children: React.ReactNode, minPlan: 'essential' | 'growth' | 'pro' }) => {
  const { barbershop, loading } = useBarbershop();
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-2" />
        <p className="text-xs text-slate-500 uppercase tracking-tighter">Validando Licença...</p>
      </div>
    );
  }

  const planRank = { essential: 0, growth: 1, pro: 2 };
  // Normaliza o nome do plano vindo do banco (padrão essential)
  const currentPlan = (barbershop?.plan_name?.toLowerCase() || 'essential') as keyof typeof planRank;
  
  // Se o plano atual for menor que o mínimo exigido
  if (planRank[currentPlan] < planRank[minPlan]) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-300">
        <div className="bg-amber-500/10 p-6 rounded-full mb-6 border border-amber-500/20">
          <ShieldAlert className="h-12 w-12 text-amber-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Recurso Premium</h2>
        <p className="text-slate-400 max-w-md mb-8">
          O acesso ao <strong>{window.location.pathname.split('/').pop()?.toUpperCase()}</strong> está disponível apenas nos planos <span className="text-cyan-400 font-bold">Growth</span> ou <span className="text-amber-400 font-bold">Pro</span>.
        </p>
        <div className="flex gap-4">
          <Button 
            onClick={() => window.location.href = '/dashboard/configuracoes'} 
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold px-8"
          >
            <Rocket className="h-4 w-4 mr-2" /> Fazer Upgrade Agora
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { pathname } = useLocation();
  const hideFooter = pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin");

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<SaaSLanding />} />
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/booking/success" element={<BookingSuccess />} />
        <Route path="/appointments" element={<MyAppointments />} />
        <Route path="/meus-agendamentos" element={<MyAppointments />} />
        <Route path="/subscribe/:planId" element={<Subscribe />} />
        <Route path="/agendamentos/:slug" element={<PublicBooking />} />
        <Route path="/book/:slug" element={<PublicBooking />} />

        {/* Dashboard + sub-pages share the sidebar layout */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="servicos" element={<Servicos />} />
          <Route path="profissionais" element={<Profissionais />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="agendamento-online" element={<AgendamentoOnline />} />
          
          {/* RECURSOS BLOQUEADOS PARA PLANO ESSENTIAL (Exigem Growth) */}
          <Route path="caixa" element={
            <PlanGate minPlan="growth">
              <Caixa />
            </PlanGate>
          } />
          <Route path="relatorios" element={
            <PlanGate minPlan="growth">
              <Relatorios />
            </PlanGate>
          } />
          <Route path="despesas" element={
            <PlanGate minPlan="growth">
              <Despesas />
            </PlanGate>
          } />
          <Route path="produtos" element={
            <PlanGate minPlan="growth">
              <Produtos />
            </PlanGate>
          } />

          {/* RECURSOS BLOQUEADOS PARA PLANOS ESSENTIAL/GROWTH (Exigem Pro) */}
          <Route path="pacotes" element={
            <PlanGate minPlan="pro">
              <Pacotes />
            </PlanGate>
          } />
          <Route path="pagamentos" element={
            <PlanGate minPlan="pro">
              <Pagamentos />
            </PlanGate>
          } />
          <Route path="aprovacao-sinais" element={
            <PlanGate minPlan="pro">
              <AprovacaoSinais />
            </PlanGate>
          } />
          <Route path="aniversarios" element={
            <PlanGate minPlan="growth">
              <Aniversarios />
            </PlanGate>
          } />
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
