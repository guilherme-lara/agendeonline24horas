// 1. Core React e React Router
import { useState, useEffect, useRef, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";

// 2. Hooks de Estado Global
import { useBarbershop } from "@/hooks/useBarbershop";
import { useAuth } from "@/hooks/useAuth";
import { useLiveAppointments } from "@/hooks/useLiveAppointments";

// 3. Componentes de UI
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import BottomNav from "@/components/BottomNav";
import InstallAppBanner from "@/components/InstallAppBanner";
import ExpirationBanner from "@/components/ExpirationBanner";
import LicenseOverlay from "@/components/LicenseOverlay";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isBarber, loading: authLoading } = useAuth();
  const { barbershop, loading: shopLoading, isImpersonating } = useBarbershop();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isInitialLoadRef = useRef(true);

  // ÉPICO 2: Realtime silencioso — escuta mudanças na tabela appointments
  useLiveAppointments((barbershop as any)?.id);

  // Bloqueio por expiração de trial
  const isTrialExpired = useMemo(() => {
    if (!barbershop) return false;
    const shop = barbershop as any;
    // Admin impersonating should never be blocked
    if (isAdmin) return false;
    // If there's an active plan, never block
    if (shop.plan_status === "active") return false;
    // If trial_ends_at exists and has passed
    if (shop.trial_ends_at) {
      return new Date(shop.trial_ends_at) < new Date();
    }
    // No trial date and no active plan = block (legacy data safety)
    return false;
  }, [barbershop, isAdmin]);

  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (!authLoading && !shopLoading) {
        if (!user) {
          navigate("/auth", { replace: true });
          return;
        }
        // Barbeiros devem ir para seu dashboard específico
        if (isBarber) {
          navigate("/barber/dashboard", { replace: true });
          return;
        }
        if (isAdmin && !barbershop && !isImpersonating) {
          navigate("/super-admin", { replace: true });
          return;
        }
        // SEGURANÇA DE ROTA: Se o carregamento terminou e barbershop é nulo,
        // redireciona o usuário para o onboarding
        if (!isAdmin && !barbershop) {
          navigate("/onboarding", { replace: true });
          return;
        }
        isInitialLoadRef.current = false;
      }
    }
  }, [
    user,
    isAdmin,
    isBarber,
    barbershop,
    isImpersonating,
    authLoading,
    shopLoading,
    navigate,
  ]);

  if (isInitialLoadRef.current && (authLoading || shopLoading)) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex min-h-screen w-full">
      {isTrialExpired && <LicenseOverlay barbershopId={(barbershop as any)?.id} />}
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        barbershopSlug={(barbershop as any)?.slug}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-muted-foreground">
            {(barbershop as any)?.name || "Dashboard"}
          </span>
        </div>

        <main className="flex-1 pb-20 md:pb-0">
          <div className="px-4 pt-4 md:px-0 md:pt-0">
            <InstallAppBanner />
            <ExpirationBanner />
          </div>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
};

export default DashboardLayout;
