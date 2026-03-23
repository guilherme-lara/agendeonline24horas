import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, ShoppingCart, Users, Settings, MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const primaryItems = [
  { label: "Início", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Agenda", icon: CalendarDays, path: "/dashboard/agenda" },
  { label: "Caixa", icon: ShoppingCart, path: "/dashboard/caixa" },
  { label: "Clientes", icon: Users, path: "/dashboard/clientes" },
  { label: "Config", icon: Settings, path: "/dashboard/configuracoes" },
];

const BottomNav = () => {
  const { pathname } = useLocation();
  const { tapVibrate } = useHapticFeedback();

  const isActive = (itemPath: string) => {
    if (itemPath === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(itemPath);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {primaryItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={tapVibrate}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-xl transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]")} />
              <span className={cn(
                "text-[10px] font-bold tracking-tight",
                active && "text-primary"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
