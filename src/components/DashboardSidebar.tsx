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
  Store,
  Calendar,
  DollarSign
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
    icon: Calendar,
    path: "#",
    subItems: [
      { label: "Agendamentos", icon: CalendarDays, path: "/dashboard/agenda" },
      { label: "Agendamento Online", icon: Globe, path: "/dashboard/agendamento-online" },
    ]
  },
  {
    label: "Equipe & Serviços",
    icon: Store,
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
    icon: Smile,
    path: "#",
    subItems: [
      { label: "Listagem", icon: Users, path: "/dashboard/clientes" },
      { label: "Aniversários", icon: Cake, path: "/dashboard/aniversarios" },
    ]
  },
  {
    label: "Financeiro",
    icon: DollarSign,
    path: "#",
    subItems: [
      { label: "Caixa", icon: ShoppingCart, path: "/dashboard/caixa" },
      { label: "Despesas", icon: TrendingDown, path: "/dashboard/despesas" },
      { label: "Relatórios", icon: BarChart3, path: "/dashboard/relatorios" },
    ],
  },
  {
    label: "Configurações",
    icon: Settings,
    path: "#",
    subItems: [
      { label: "Pagamentos", icon: CreditCard, path: "/dashboard/pagamentos" },
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
    "Agenda": pathname.includes("/agenda") || pathname.includes("/agendamento-online"),
    "Equipe & Serviços": pathname.includes("/profissionais") || pathname.includes("/servicos") || pathname.includes("/produtos") || pathname.includes("/pacotes"),
    "Clientes": pathname.includes("/clientes") || pathname.includes("/aniversarios"),
    "Financeiro": pathname.includes("/caixa") || pathname.includes("/despesas") || pathname.includes("/relatorios"),
    "Configurações": pathname.includes("/configuracoes") || pathname.includes("/horarios") || pathname.includes("/mensagens") || pathname.includes("/pagamentos")
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
      {/* Overlay mobile melhorado */}
      {open && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300" 
          onClick={onClose} 
        />
      )}

      <aside
        className={cn(
          // Ajuste de altura para cobrir 100% da viewport (h-screen e h-[100dvh])
          "fixed top-0 left-0 z-50 h-screen h-[100dvh] flex flex-col bg-card border-r border-border shadow-xl transition-transform duration-300 ease-in-out",
          // Largura mobile um pouco maior (w-72) e desktop compacta (md:w-64)
          "w-72 md:w-64",
          "md:translate-x-0 md:static md:z-auto md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header fixo no topo da sidebar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <img src={logoAgenda} alt="Logo" className="h-8 w-auto opacity-90 object-contain" />
          <button onClick={onClose} className="md:hidden p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Badge de Trial */}
        {trialDaysLeft && (
          <div className="px-5 py-2.5 border-b border-border bg-amber-500/5 shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Pro Trial: {trialDaysLeft}d restantes</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000" 
                style={{ width: `${Math.max(5, (trialDaysLeft / 30) * 100)}%` }} 
              />
            </div>
          </div>
        )}

        {/* Navegação principal com preenchimento total (flex-1) */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {navItems.map((item) => {
            if (item.external) {
              return (
                <a 
                  key={item.label} 
                  href={item.external} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                >
                  <item.icon className="h-4.5 w-4.5 text-emerald-500" />
                  {item.label}
                </a>
              );
            }

            if (item.subItems) {
              const isMenuOpen = openMenus[item.label];
              const hasActiveChild = item.subItems.some(sub => isActive(sub.path));
              return (
                <div key={item.label} className="space-y-1">
                  <button 
                    onClick={() => toggleMenu(item.label)} 
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all", 
                      hasActiveChild && !isMenuOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-4.5 w-4.5", hasActiveChild ? "text-primary" : "text-muted-foreground")} />
                      <span>{item.label}</span>
                    </div>
                    {isMenuOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-50" /> : <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                  </button>
                  <div 
                    className={cn(
                      "pl-9 pr-2 space-y-1 overflow-hidden transition-all duration-300 ease-in-out", 
                      isMenuOpen ? "max-h-[300px] opacity-100 py-1" : "max-h-0 opacity-0"
                    )}
                  >
                    {item.subItems.map(sub => (
                      <Link 
                        key={sub.path} 
                        to={sub.path} 
                        onClick={onClose} 
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", 
                          isActive(sub.path) 
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                        )}
                      >
                        <sub.icon className="h-3.5 w-3.5 shrink-0" />
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link 
                key={item.label} 
                to={item.path} 
                onClick={onClose} 
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all", 
                  isActive(item.path) 
                    ? "gold-gradient text-primary-foreground shadow-lg shadow-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé fixo na base da sidebar */}
        <div className="border-t border-border p-4 space-y-3 bg-card/80 shrink-0">
          <div className="flex items-center justify-between px-1">
            <ThemeToggle />
            <button 
              onClick={signOut} 
              className="flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-destructive transition-colors group"
            >
              <LogOut className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /> 
              Sair
            </button>
          </div>
          <div className="px-1 pt-1">
            <p className="text-[9px] font-bold text-muted-foreground/40 leading-tight">
              Desenvolvido por Jotatechinfo
              <br />
              © 2026 · v1.2.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;