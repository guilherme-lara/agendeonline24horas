import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { BookingProvider } from "@/contexts/BookingContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
import Comandas from "./pages/dashboard/Comandas";
import Despesas from "./pages/dashboard/Despesas";
import Clientes from "./pages/dashboard/Clientes";
import Aniversarios from "./pages/dashboard/Aniversarios";
import Pacotes from "./pages/dashboard/Pacotes";
import Relatorios from "./pages/dashboard/Relatorios";
import Profissionais from "./pages/dashboard/Profissionais";
import Produtos from "./pages/dashboard/Produtos";
import Configuracoes from "./pages/dashboard/Configuracoes";
import AgendamentoOnline from "./pages/dashboard/AgendamentoOnline";
import Pagamentos from "./pages/dashboard/Pagamentos";
import Caixa from "./pages/dashboard/Caixa";
import AprovacaoSinais from "./pages/dashboard/AprovacaoSinais";

const queryClient = new QueryClient();

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
          <Route path="comandas" element={<Comandas />} />
          <Route path="despesas" element={<Despesas />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="aniversarios" element={<Aniversarios />} />
          <Route path="pacotes" element={<Pacotes />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="profissionais" element={<Profissionais />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="agendamento-online" element={<AgendamentoOnline />} />
          <Route path="pagamentos" element={<Pagamentos />} />
          <Route path="caixa" element={<Caixa />} />
          <Route path="aprovacao-sinais" element={<AprovacaoSinais />} />
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
