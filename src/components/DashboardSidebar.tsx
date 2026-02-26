import { Link, useLocation } from "react-router-dom";
import {
  MessageCircle, CalendarDays, Globe, Ticket, TrendingDown,
  BarChart3, Smile, Users, Scissors, ShoppingBag, PackageCheck,
  Cake, Settings, FileText, Shield, LogOut, X, ChevronRight,
  CreditCard, LayoutDashboard, ShoppingCart, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import logoAgenda from "@/assets/logo-agenda.png";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  barbershopSlug?: string;
}

const navItems = [
  { label: "Suporte", icon: MessageCircle, path: "/dashboard?tab=support", external: "https://wa.me/5514996850047?text=Ol%C3%A1%2C+preciso+de+suporte+com+o+TechBarber!" },
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Agenda", icon: CalendarDays, path: "/dashboard/agenda" },
  { label: "Caixa / PDV", icon: ShoppingCart, path: "/dashboard/caixa" },
  { label: "Agendamento Online", icon: Globe, path: "/dashboard/agendamento-online" },
  { label: "Aprovação de Sinais", icon: AlertTriangle, path: "/dashboard/aprovacao-sinais" },
  { label: "Comandas", icon: Ticket, path: "/dashboard/comandas" },
  { label: "Despesas", icon: TrendingDown, path: "/dashboard/despesas" },
  { label: "Relatórios", icon: BarChart3, path: "/dashboard/relatorios" },
  { label: "Clientes", icon: Smile, path: "/dashboard/clientes" },
  { label: "Profissionais", icon: Users, path: "/dashboard/profissionais" },
  { label: "Serviços", icon: Scissors, path: "/dashboard/configuracoes" },
  { label: "Produtos", icon: ShoppingBag, path: "/dashboard/produtos" },
  { label: "Pacotes", icon: PackageCheck, path: "/dashboard/pacotes" },
  { label: "Aniversários", icon: Cake, path: "/dashboard/aniversarios" },
  { label: "Pagamentos", icon: CreditCard, path: "/dashboard/pagamentos" },
  { label: "Configurações", icon: Settings, path: "/dashboard/configuracoes" },
  { label: "Termos de uso", icon: FileText, path: "/termos" },
  { label: "Política de privacidade", icon: Shield, path: "/privacidade" },
];

const DashboardSidebar = ({ open, onClose, barbershopSlug }: SidebarProps) => {
  const { pathname } = useLocation();
  const { signOut } = useAuth();

  const isActive = (itemPath: string) => {
    const cleanPath = itemPath.split("?")[0];
    if (cleanPath === "/dashboard") return pathname === "/dashboard";
    return pathname === cleanPath;
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-72 flex flex-col bg-card border-r border-border shadow-2xl transition-transform duration-300",
          "md:translate-x-0 md:static md:z-auto md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <img src={logoAgenda} alt="Logo" className="h-8 w-auto" />
          <button
            onClick={onClose}
            className="md:hidden rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.path);
            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.external}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <item.icon className="h-4 w-4 flex-shrink-0 text-green-500" />
                  {item.label}
                </a>
              );
            }
            return (
              <Link
                key={item.label + item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "gold-gradient text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-2">
          {barbershopSlug && (
            <a
              href={`/agendamentos/${barbershopSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              Ver página pública
            </a>
          )}
          <div className="flex items-center justify-between px-3">
            <ThemeToggle />
            <button
              onClick={signOut}
              className="flex items-center gap-2 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
          <p className="px-3 text-[10px] text-muted-foreground/50 leading-tight">
            Desenvolvido por Guilherme Lara<br />Jotatechinfo · © 2026
          </p>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
