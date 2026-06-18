// 1. Core React e React Router
import { useState, useEffect, useRef, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";

// 2. Hooks de Estado Global
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { useLiveAppointments } from "@/hooks/useLiveAppointments";

// 3. Componentes de UI
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import BottomNav from "@/components/BottomNav";
import InstallAppBanner from "@/components/InstallAppBanner";
import ExpirationBanner from "@/components/ExpirationBanner";
import TrialBanner from "@/components/TrialBanner"; // Ponto 2: Importando o novo banner
import LicenseOverlay from "@/components/LicenseOverlay";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isProfessional, loading: authLoading } = useAuth();
  const { clinic, loading: shopLoading, isImpersonating } = useClinic();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isInitialLoadRef = useRef(true);

  // ÉPICO 2: Realtime silencioso — escuta mudanças na tabela appointments
  useLiveAppointments((clinic as any)?.id);

  // Bloqueio por expiração de trial ou assinatura
  const isTrialExpired = useMemo(() => {
    if (!clinic) return false;
    const shop = clinic as any;
    
    // 1. Bloqueios explícitos (Status da Assinatura)
    if (shop.plan_status === "expired" || shop.plan_status === "canceled") return true;

    // 2. Liberação explícita (Assinatura Ativa)
    if (shop.plan_status === "active") return false;

    // 3. Lógica de Trial (Baseado em datas)
    const trialEnd = shop.trial_ends_at || shop.trial_end_date || shop.plan_ends_at || shop.expires_at;
    if (trialEnd) {
      const trialDate = new Date(trialEnd);
      if (isNaN(trialDate.getTime())) return true; // Data inválida = bloqueia por segurança
      
      // Bloqueia se a data de término for anterior ao momento atual
      return trialDate.getTime() < Date.now();
    }

    // 4. Fallback: Se não há plano ativo e não há data de trial definida, considera expirado.
    return true; 
  }, [clinic]);

  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (!authLoading && !shopLoading) {
        if (!user) {
          navigate("/auth", { replace: true });
          return;
        }

        if (isAdmin && !clinic && !isImpersonating) {
          navigate("/super-admin", { replace: true });
          return;
        }
        // SEGURANÇA DE ROTA: Se o carregamento terminou e clinic é nulo,
        // redireciona o usuário para o onboarding
        if (!isAdmin && !clinic) {
          navigate("/onboarding", { replace: true });
          return;
        }
        isInitialLoadRef.current = false;
      }
    }
  }, [
    user,
    isAdmin,
    isProfessional,
    clinic,
    isImpersonating,
    authLoading,
    shopLoading,
    navigate,
  ]);

  if (isInitialLoadRef.current && (authLoading || shopLoading)) {
    return <DashboardSkeleton />;
  }

  // PONTO DE BLOQUEIO TOTAL
  if (isTrialExpired) {
    return (
      <div className="dashboard-theme">
        <LicenseOverlay barbershopId={(clinic as any)?.id} />
      </div>
    );
  }

  return (
    <div className="dashboard-theme flex min-h-screen w-full bg-sys-bg-base bg-mesh text-sys-text-primary selection:bg-sys-brand-primary/20">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        clinicSlug={(clinic as any)?.slug}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar (mobile) — surface + sys tokens */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30 bg-sys-surface/85 backdrop-blur-xl border-b border-sys-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-sys-text-muted hover:text-sys-text-primary hover:bg-sys-bg-base transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold tracking-tight text-sys-text-primary truncate">
            {(clinic as any)?.name || "Painel"}
          </span>
        </div>

        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-8 space-y-4">
          <TrialBanner />
          <InstallAppBanner />
          <ExpirationBanner />
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
};

export default DashboardLayout;
