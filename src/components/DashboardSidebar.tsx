import { Link, useLocation } from "react-router-dom";
import {
  MessageCircle,
  MessageSquare,
  CalendarDays,
  Globe,
  TrendingDown,
  BarChart3,
  Smile,
  Users,
  Scissors,
  ShoppingBag,
  PackageCheck,
  Cake,
  Settings,
  LogOut,
  X,
  ChevronRight,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  ShoppingCart,
  Crown,
  Clock,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import logoAgenda from "@/assets/nova-logo.jpeg";
import { useMemo, useState } from "react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  barbershopSlug?: string;
}

const navItems = [
 
  { label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
  {
    label: "Agenda",
    icon: Briefcase,
    path: "#",
    subItems: [
      { label: "Agendamentos", icon: CalendarDays, path: "/dashboard/agenda" },
      { label: "Agendamento Online", icon: Globe, path: "/dashboard/agendamento-online" },
    ]
  },
  {
    label: "Equipe & Serviços",
    icon: Briefcase,
    path: "#",
    subItems: [
      { label: "Profissionais", icon: Users, path: "/dashboard/profissionais" },
      { label: "Serviços", icon: Scissors, path: "/dashboard/servicos" },
      { label: "Produtos", icon: ShoppingBag, path: "/dashboard/produtos" },
      { label: "Pacotes", icon: PackageCheck, path: "/dashboard/pacotes" },  
    ]
  },
  {
    label: "Clientes",
    icon: Briefcase,
    path: "#",
    subItems: [
      { label: "Clientes", icon: Smile, path: "/dashboard/clientes" },
      { label: "Aniversários", icon: Cake, path: "/dashboard/aniversarios" },
    ]
  },
  {
    label: "Financeiro",
    icon: Briefcase,
    path: "#",
    subItems: [
      { label: "Caixa", icon: ShoppingCart, path: "/dashboard/caixa" },
      { label: "Despesas", icon: TrendingDown, path: "/dashboard/despesas" },
      { label: "Relatórios", icon: BarChart3, path: "/dashboard/relatorios" },
      { label: "Pagamentos", icon: CreditCard, path: "/dashboard/pagamentos" },
    ],
  },

  {
    label: "Configurações",
    icon: Settings,
    path: "#",
    subItems: [
      { label: "Mensagens", icon: MessageSquare, path: "/dashboard/mensagens" },
      { label: "Sistema", icon: Settings, path: "/dashboard/configuracoes" },
      { label: "Horários", icon: Clock, path: "/dashboard/horarios" },
    ],
  },
  {
    label: "Suporte",
    icon: MessageCircle,
    path: "/dashboard?tab=support",
    external: "https://wa.me/5514996850047?text=Ol%C3%A1%2C+preciso+de+suporte!",
  }
];

const DashboardSidebar = ({ open, onClose, barbershopSlug }: SidebarProps) => {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { barbershop } = useBarbershop() as any;

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Financeiro: pathname.includes("/caixa") || pathname.includes("/despesas") || pathname.includes("/relatorios") || pathname.includes("/pagamentos"),
    Configurações: pathname.includes("/configuracoes") || pathname.includes("/horarios")
  });

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (itemPath: string) => {
    const cleanPath = itemPath.split("?")[0];
    return cleanPath === "/dashboard" ? pathname === "/dashboard" : pathname === cleanPath;
  };

  const trialDaysLeft = useMemo(() => {
    if (!barbershop) return null;
    const endDate = barbershop.trial_ends_at || barbershop.plan_ends_at || barbershop.expires_at;
    if (!endDate) return null;
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  }, [barbershop]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={onClose} />}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 flex flex-col bg-card border-r border-border shadow-xl transition-transform duration-300",
          "md:translate-x-0 md:static md:z-auto md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <img src={logoAgenda} alt="Logo" className="h-7 w-auto opacity-90" />
          <button onClick={onClose} className="md:hidden p-1 text-muted-foreground hover:bg-secondary rounded-md">
            <X className="h-4 w-4" />
          </button>
        </div>

        {trialDaysLeft && (
          <div className="px-4 py-2 border-b border-border bg-amber-500/5">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-black text-amber-600 uppercase">Pro Trial: {trialDaysLeft}d</span>
            </div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${Math.max(5, (trialDaysLeft / 30) * 100)}%` }} />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 custom-scrollbar">
          {navItems.map((item) => {
            if (item.external) {
              return (
                <a key={item.label} href={item.external} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <item.icon className="h-4 w-4 text-green-500" />
                  {item.label}
                </a>
              );
            }

            if (item.subItems) {
              const isMenuOpen = openMenus[item.label];
              const hasActiveChild = item.subItems.some(sub => isActive(sub.path));
              return (
                <div key={item.label} className="space-y-0.5">
                  <button onClick={() => toggleMenu(item.label)} className={cn("w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors", hasActiveChild && !isMenuOpen ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-secondary")}>
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-4 w-4", hasActiveChild && !isMenuOpen ? "text-primary" : "")} />
                      <span>{item.label}</span>
                    </div>
                    {isMenuOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  <div className={cn("pl-8 space-y-0.5 overflow-hidden transition-all", isMenuOpen ? "max-h-48 opacity-100 py-1" : "max-h-0 opacity-0")}>
                    {item.subItems.map(sub => (
                      <Link key={sub.path} to={sub.path} onClick={onClose} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all", isActive(sub.path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
                        <sub.icon className="h-3.5 w-3.5" />
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link key={item.label} to={item.path} onClick={onClose} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors", isActive(item.path) ? "gold-gradient text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3 space-y-2 bg-card/50">
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
            <button onClick={signOut} className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="h-3 w-3" /> Sair
            </button>
          </div>
          <p className="px-2 text-[9px] text-muted-foreground/40 text-center">
            Desenvolvido por Guilherme Lara<br/>Jotatechinfo © 2026
          </p>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;