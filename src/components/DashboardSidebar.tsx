import { Link, useLocation } from "react-router-dom";
import {
  MessageCircle, MessageSquare, CalendarDays, Globe, TrendingDown, BarChart3,
  Smile, Users, Scissors, ShoppingBag, PackageCheck, Cake, Settings, LogOut,
  X, ChevronRight, ChevronDown, CreditCard, LayoutDashboard, ShoppingCart,
  Crown, Clock, Briefcase, Store, Calendar, Sparkles
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lock } from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  clinicSlug?: string;
}

const navItems = [
  { label: "Caixa / PDV", icon: ShoppingCart, path: "/pdv" },
  { label: "Painel", icon: LayoutDashboard, path: "/dashboard/painel" },
  {
    label: "Agenda", icon: Calendar, path: "#",
    subItems: [
      { label: "Agendamentos", icon: CalendarDays, path: "/dashboard/agenda" },
      { label: "Agendamento Online", icon: Globe, path: "/dashboard/agendamento-online" },
    ],
  },
  {
    label: "Equipe & Serviços", icon: Store, path: "#",
    subItems: [
      { label: "Profissionais", icon: Users, path: "/dashboard/profissionais" },
      { label: "Serviços", icon: Scissors, path: "/dashboard/servicos" },
      { label: "Produtos", icon: ShoppingBag, path: "/dashboard/produtos" },
      { label: "Pacotes", icon: PackageCheck, path: "/dashboard/pacotes" },
    ],
  },
  {
    label: "Clientes", icon: Users, path: "#",
    subItems: [
      { label: "Clientes", icon: Smile, path: "/dashboard/clientes" },
      { label: "Aniversários", icon: Cake, path: "/dashboard/aniversarios" },
    ],
  },
  {
    label: "Financeiro", icon: Briefcase, path: "#",
    subItems: [
      { label: "Aprovação de Comandas", icon: PackageCheck, path: "/dashboard/aprovacoes" },
      { label: "Despesas", icon: TrendingDown, path: "/dashboard/despesas" },
      { label: "Relatórios", icon: BarChart3, path: "/dashboard/relatorios" },
    ],
  },
  {
    label: "Configurações", icon: Settings, path: "#",
    subItems: [
      { label: "Pagamentos", icon: CreditCard, path: "/dashboard/pagamentos" },
      { label: "Mensagens", icon: MessageSquare, path: "/dashboard/mensagens" },
      { label: "Sistema", icon: Settings, path: "/dashboard/configuracoes" },
      { label: "Horários", icon: Clock, path: "/dashboard/horarios" },
    ],
  },
  {
    label: "Suporte", icon: MessageCircle, path: "/dashboard?tab=support",
    external: "https://wa.me/5514996850047?text=Ol%C3%A1%2C+preciso+de+suporte!",
  },
];

const DashboardSidebar = ({ open, onClose }: SidebarProps) => {
  const { pathname } = useLocation();
  const { signOut, isProfessional } = useAuth();
  const { clinic } = useClinic() as any;

  const visibleNavItems = useMemo(() => {
    if (isProfessional) {
      return navItems.filter((item) =>
        ["Caixa / PDV", "Painel", "Agenda", "Clientes", "Suporte"].includes(item.label)
      );
    }
    return navItems;
  }, [isProfessional]);

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "Agenda": pathname.includes("/agenda") || pathname.includes("/agendamento-online"),
    "Equipe & Serviços": pathname.includes("/profissionais") || pathname.includes("/servicos") || pathname.includes("/produtos") || pathname.includes("/pacotes"),
    "Clientes": pathname.includes("/clientes") || pathname.includes("/aniversarios"),
    "Financeiro": pathname.includes("/despesas") || pathname.includes("/relatorios"),
    "Configurações": pathname.includes("/configuracoes") || pathname.includes("/horarios") || pathname.includes("/mensagens") || pathname.includes("/pagamentos"),
  });

  const toggleMenu = (label: string) => setOpenMenus((p) => ({ ...p, [label]: !p[label] }));

  const isActive = (itemPath: string) => {
    const cleanPath = itemPath.split("?")[0];
    return cleanPath === "/dashboard" ? pathname === "/dashboard" : pathname === cleanPath;
  };

  const trialDaysLeft = useMemo(() => {
    if (!clinic) return null;
    const endDate = clinic.trial_ends_at || clinic.plan_ends_at || clinic.expires_at;
    if (!endDate) return null;
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  }, [clinic]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen h-[100dvh] flex flex-col transition-transform duration-300 ease-out",
          "w-[85vw] max-w-[300px] md:w-72",
          "md:translate-x-0 md:static md:z-auto",
          "glass border-r border-border/60",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {clinic?.logo_url ? (
              <div className="h-10 w-10 rounded-2xl overflow-hidden border border-border elev-1 shrink-0 bg-card">
                <img src={clinic.logo_url} alt="Logo" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-base elev-2 shrink-0">
                {clinic?.name?.charAt(0)?.toUpperCase() || "T"}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-[14px] tracking-tight text-foreground truncate font-display">
                {clinic?.name || "Painel"}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-muted-foreground hover:bg-secondary rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Trial banner */}
        {trialDaysLeft && (
          <div className="mx-3 mt-3 rounded-2xl p-3 bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Pro Trial · {trialDaysLeft}d restantes
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-amber-500/15 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000"
                style={{ width: `${Math.max(5, (trialDaysLeft / 30) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar">
          {visibleNavItems.map((item) => {
            if ((item as any).external) {
              return (
                <a
                  key={item.label}
                  href={(item as any).external}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all duration-300"
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                </a>
              );
            }

            if ((item as any).subItems) {
              const sub = (item as any).subItems as { label: string; icon: any; path: string }[];
              const isMenuOpen = openMenus[item.label];
              const hasActiveChild = sub.some((s) => isActive(s.path));
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 relative",
                      hasActiveChild
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <item.icon className={cn("h-[18px] w-[18px] shrink-0", hasActiveChild && "text-primary")} />
                      <span className="truncate text-left">{item.label}</span>
                    </div>
                    {isMenuOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                  </button>
                  <div
                    className={cn(
                      "pl-4 ml-3 border-l border-border/60 space-y-0.5 overflow-hidden transition-all duration-300 ease-out",
                      isMenuOpen ? "max-h-[400px] opacity-100 py-1" : "max-h-0 opacity-0"
                    )}
                  >
                    {sub.map((s) => {
                      const active = isActive(s.path);
                      return (
                        <Link
                          key={s.path}
                          to={s.path}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 relative",
                            active
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                          )}
                        >
                          <s.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate flex-1">{s.label}</span>
                          {active && <span className="absolute -left-[17px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const active = isActive(item.path);
            return (
              <Link
                key={item.label}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 relative",
                  active
                    ? "bg-primary/10 text-primary font-semibold elev-1"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                )}
              >
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
                <span className="flex-1 truncate text-left">{item.label}</span>
                {active && <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/60 p-4 space-y-3 bg-card/40 shrink-0">
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-rose-500 transition-colors group px-2 py-1.5 rounded-lg hover:bg-rose-500/5"
            >
              <LogOut className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              Sair
            </button>
          </div>
          <div className="flex items-center gap-2 px-1 pt-1 text-[9px] text-muted-foreground/70">
            <Sparkles className="h-3 w-3 text-primary/60" />
            <span className="truncate">Desenvolvido por Jotatechinfo · v1.2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
