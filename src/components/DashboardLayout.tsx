import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useAuth } from "@/hooks/useAuth";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardSkeleton from "@/components/DashboardSkeleton";

/**
 * Wraps all /dashboard/* routes.
 * - Redirects unauthenticated users to /auth
 * - Redirects Super Admin (isAdmin with no barbershop) to /super-admin
 * - Renders the retractable sidebar + <Outlet /> for nested routes
 */
const DashboardLayout = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { barbershop, loading: shopLoading } = useBarbershop();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (authLoading || shopLoading) return <DashboardSkeleton />;

  // Not logged in
  if (!user) {
    navigate("/auth");
    return null;
  }

  // Super Admin should never load the owner dashboard — redirect to master panel
  if (isAdmin && !barbershop) {
    navigate("/super-admin");
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full">
      {/* Sidebar */}
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        barbershopSlug={barbershop?.slug}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top-bar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-16 z-30">
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
