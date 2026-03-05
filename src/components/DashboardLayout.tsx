// 1. Core React e React Router
import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";

// 2. Hooks de Estado Global
import { useBarbershop } from "@/hooks/useBarbershop";
import { useAuth } from "@/hooks/useAuth";

// 3. Componentes de UI
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardSkeleton from "@/components/DashboardSkeleton";

// 4. DASHBOARD LAYOUT - VERSÃO SIMPLIFICADA E ESTÁVEL
const DashboardLayout = () => {
  const navigate = useNavigate();

  // Estado global
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { barbershop, loading: shopLoading, isImpersonating } = useBarbershop();

  // Estado local
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Flag simples: só mostra loading na PRIMEIRA carga absoluta
  const isInitialLoadRef = useRef(true);

  // Lógica de navegação - só executa uma vez
  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (!authLoading && !shopLoading) {
        // Dados carregados, pode navegar se necessário
        if (!user) {
          navigate("/auth", { replace: true });
          return;
        }
        if (isAdmin && !barbershop && !isImpersonating) {
          navigate("/super-admin", { replace: true });
          return;
        }
        // Marca que inicialização terminou
        isInitialLoadRef.current = false;
      }
    }
  }, [user, isAdmin, barbershop, isImpersonating, authLoading, shopLoading, navigate]);

  // MOSTRA LOADING APENAS na carga inicial absoluta
  if (isInitialLoadRef.current && (authLoading || shopLoading)) {
    return <DashboardSkeleton />;
  }

  // APÓS CARGA INICIAL, SEMPRE RENDERIZA O LAYOUT
  // Nunca mais volta para loading, independente do que acontecer
  return (
    <div className="flex min-h-screen w-full">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        barbershopSlug={barbershop?.slug}
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
            {barbershop?.name || "Dashboard"}
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
