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
import TrialBlockModal from "@/components/TrialBlockModal";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { barbershop, loading: shopLoading, isImpersonating } = useBarbershop();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isInitialLoadRef = useRef(true);

  // ÉPICO 2: Realtime silencioso — escuta mudanças na tabela appointments
  useLiveAppointments((barbershop as any)?.id);

  // Bloqueio por expiração de trial
  const isTrialExpired = useMemo(() => {
    if (!barbershop) return false;
    const shop = barbershop as any;
    // Se tem plano ativo no saas_plans, não bloqueia
    if (shop.plan_status === "active") return false;
    // Se trial_ends_at existe e já passou
    if (shop.trial_ends_at) {
      return new Date(shop.trial_ends_at) < new Date();
    }
    return false;
  }, [barbershop]);

  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (!authLoading && !shopLoading) {
        if (!user) {
          navigate("/auth", { replace: true });
          return;
        }
        if (isAdmin && !barbershop && !isImpersonating) {
          navigate("/super-admin", { replace: true });
          return;
        }
        isInitialLoadRef.current = false;
      }
    }
  }, [user, isAdmin, barbershop, isImpersonating, authLoading, shopLoading, navigate]);

  if (isInitialLoadRef.current && (authLoading || shopLoading)) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex min-h-screen w-full">
      <TrialBlockModal open={isTrialExpired} />
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

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
