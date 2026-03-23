// 1. Core React e Bibliotecas Externas
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// 2. Singleton QueryClient - Criado FORA de qualquer componente React
import { queryClient } from "@/lib/queryClient";

// 3. Supabase e Integrações
import { supabase } from "@/integrations/supabase/client";

// 4. Hooks e Contextos Global
import { AuthProvider } from "@/hooks/useAuth";
import { BookingProvider } from "@/contexts/BookingContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

// 5. Componentes de UI e Layout
import { Loader2, ShieldAlert, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ErrorBoundary";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DashboardLayout from "./components/DashboardLayout";

// 6. Páginas Públicas e Autenticação
import SaaSLanding from "./pages/SaaSLanding";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Subscribe from "./pages/Subscribe";
import PublicBooking from "./pages/PublicBooking";
import Booking from "./pages/Booking";
import BookingSuccess from "./pages/BookingSuccess";
import MyAppointments from "./pages/MyAppointments";
import NotFound from "./pages/NotFound";

// 7. Páginas Administrativas
import SuperAdmin from "./pages/SuperAdmin";
import Admin from "./pages/Admin";

// 8. Sub-páginas do Dashboard
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


// 9. Hook da Barbearia (para o PlanGate)
import { useBarbershop } from "@/hooks/useBarbershop";

// --- COMPONENTE PORTEIRO DE PLANOS (MONETIZAÇÃO) ---
const PlanGate = ({ children, minPlan, featureName }: { children: React.ReactNode, minPlan: PlanTier, featureName?: string }) => {
  const { canAccessFeature, getUpgradePlan, currentPlan } = usePlanGate();
  const { barbershop, loading } = useBarbershop() as any;
  const [showUpgrade, setShowUpgrade] = React.useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Validando Licença...</p>
      </div>
    );
  }

  if (!canAccessFeature(minPlan)) {
    const requiredPlan = getUpgradePlan(minPlan);
    return (
      <>
        <UpgradeModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          requiredPlan={requiredPlan}
          featureName={featureName || "Este recurso"}
        />
        <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-300">
          <div className="bg-primary/10 p-6 rounded-[2rem] mb-6 border border-primary/20">
            <ShieldAlert className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight font-display">Recurso Premium</h2>
          <p className="text-muted-foreground max-w-md mb-4 text-sm">
            O acesso a este módulo está disponível a partir do plano <span className="text-primary font-bold">{requiredPlan}</span>.
          </p>
          <p className="text-muted-foreground/70 max-w-md mb-8 text-xs">
            Seu plano atual: <span className="font-bold text-foreground">{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</span>
          </p>
          <Button
            onClick={() => setShowUpgrade(true)}
            className="gold-gradient text-primary-foreground font-black px-10 h-14 rounded-2xl shadow-gold"
          >
            <Rocket className="h-5 w-5 mr-2" /> Fazer Upgrade Agora
          </Button>
        </div>
      </>
    );
  }

  return <>{children}</>;
};

// --- RECONECTOR GLOBAL DE VISIBILIDADE ---
// REMOVIDO: estava causando conflitos com React Query
// O React Query agora está configurado para não refazer queries ao voltar foco
// const GlobalVisibilityReconnector = () => {
//   useEffect(() => {
//     const handleVisibilityChange = () => {
//       if (document.visibilityState === "visible") {
//         // REMOVIDO: estava causando flickering
//         // supabase.auth.getSession().catch(() => {});
//       }
//     };

//     document.addEventListener("visibilitychange", handleVisibilityChange);
//     return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
//   }, []);

//   return null;
// };

// --- CONTEÚDO PRINCIPAL COM GERENCIAMENTO DE ROTAS ---
const AppContent = () => {
  const { pathname } = useLocation();
  const hideFooter = pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin");

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
          
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideFooter && <Footer />}
    </>
  );
};

// --- APP PRINCIPAL - ARQUITETURA DE NÍVEL ENTERPRISE ---
const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {/* Reconector Global REMOVIDO - estava causando conflitos */}
          <BrowserRouter>
            <AuthProvider>
              <BookingProvider>
                <AppContent />
              </BookingProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
