// 1. Core React e Bibliotecas Externas
import React, { lazy, Suspense, useEffect, useState } from "react";
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
import BarberDashboard from "./pages/BarberDashboard";
import BarberProfile from "./pages/BarberProfile";

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

// 8. Sub-páginas do Dashboard (Lazy Loaded)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Agenda = lazy(() => import("./pages/dashboard/Agenda"));
const Clientes = lazy(() => import("./pages/dashboard/Clientes"));
const Servicos = lazy(() => import("./pages/dashboard/Servicos"));
const Profissionais = lazy(() => import("./pages/dashboard/Profissionais"));
const Configuracoes = lazy(() => import("./pages/dashboard/Configuracoes"));
const Horarios = lazy(() => import("./pages/dashboard/Horarios"));
const Mensagens = lazy(() => import("./pages/dashboard/Mensagens"));
const AgendamentoOnline = lazy(() => import("./pages/dashboard/AgendamentoOnline"));
const Caixa = lazy(() => import("./pages/dashboard/Caixa"));
const Relatorios = lazy(() => import("./pages/dashboard/Relatorios"));
const Despesas = lazy(() => import("./pages/dashboard/Despesas"));
const Produtos = lazy(() => import("./pages/dashboard/Produtos"));
const Aniversarios = lazy(() => import("./pages/dashboard/Aniversarios"));
const Pacotes = lazy(() => import("./pages/dashboard/Pacotes"));
const Pagamentos = lazy(() => import("./pages/dashboard/Pagamentos"));


// 9. Hook da Barbearia (para o PlanGate)
import { useBarbershop } from "@/hooks/useBarbershop";
import { usePlanGate, type PlanTier } from "@/hooks/usePlanGate";
import UpgradeModal from "@/components/UpgradeModal";
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

// --- LAZY LOADING FALLBACK ---
const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-[300px]">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

// --- CONTEÚDO PRINCIPAL COM GERENCIAMENTO DE ROTAS ---
const AppContent = () => {
  const { pathname } = useLocation();
  const hideFooter = pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin") || pathname.startsWith("/barber");

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

        {/* Dashboard do Barbeiro */}
        <Route path="/barber/dashboard" element={<BarberDashboard />} />
        <Route path="/barber/perfil" element={<BarberProfile />} />

        {/* Dashboard e Sub-páginas com Sidebar (Lazy Loaded) */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<LazyFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="agenda"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Agenda />
              </Suspense>
            }
          />
          <Route
            path="clientes"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Clientes />
              </Suspense>
            }
          />
          <Route
            path="servicos"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Servicos />
              </Suspense>
            }
          />
          <Route
            path="profissionais"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Profissionais />
              </Suspense>
            }
          />
          <Route
            path="configuracoes"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Configuracoes />
              </Suspense>
            }
          />
          <Route
            path="horarios"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Horarios />
              </Suspense>
            }
          />
          <Route
            path="mensagens"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Mensagens />
              </Suspense>
            }
          />
          <Route
            path="agendamento-online"
            element={
              <Suspense fallback={<LazyFallback />}>
                <AgendamentoOnline />
              </Suspense>
            }
          />

          {/* Bronze Tier + (Caixa disponível em todos os planos) */}
          <Route
            path="caixa"
            element={
              <Suspense fallback={<LazyFallback />}>
                <PlanGate minPlan="bronze" featureName="Caixa">
                  <Caixa />
                </PlanGate>
              </Suspense>
            }
          />
          <Route
            path="relatorios"
            element={
              <Suspense fallback={<LazyFallback />}>
                <PlanGate minPlan="prata" featureName="Relatórios">
                  <Relatorios />
                </PlanGate>
              </Suspense>
            }
          />
          <Route
            path="despesas"
            element={
              <Suspense fallback={<LazyFallback />}>
                <PlanGate minPlan="prata" featureName="Despesas">
                  <Despesas />
                </PlanGate>
              </Suspense>
            }
          />
          <Route
            path="produtos"
            element={
              <Suspense fallback={<LazyFallback />}>
                <PlanGate minPlan="prata" featureName="Produtos">
                  <Produtos />
                </PlanGate>
              </Suspense>
            }
          />
          <Route
            path="aniversarios"
            element={
              <Suspense fallback={<LazyFallback />}>
                <PlanGate minPlan="prata" featureName="Aniversários">
                  <Aniversarios />
                </PlanGate>
              </Suspense>
            }
          />

          {/* Ouro Tier + */}
          <Route
            path="pacotes"
            element={
              <Suspense fallback={<LazyFallback />}>
                <PlanGate minPlan="ouro" featureName="Pacotes">
                  <Pacotes />
                </PlanGate>
              </Suspense>
            }
          />
          <Route
            path="pagamentos"
            element={
              <Suspense fallback={<LazyFallback />}>
                <PlanGate minPlan="ouro" featureName="Pagamentos">
                  <Pagamentos />
                </PlanGate>
              </Suspense>
            }
          />
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
