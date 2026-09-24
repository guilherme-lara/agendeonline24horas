import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-system-blue hover:bg-primary/25",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-system-red/15 text-system-red hover:bg-system-red/25",
        success: "border-transparent bg-system-green/15 text-system-green hover:bg-system-green/25",
        warning: "border-transparent bg-system-orange/15 text-system-orange hover:bg-system-orange/25",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

import { CheckCircle2, Clock, XCircle, Timer, AlertCircle } from "lucide-react";

export type StatusBadgeType = "confirmed" | "pending" | "cancelled" | "in_progress" | "completed" | "paid" | "pending_payment" | "pendente_pagamento";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusBadgeType | string;
  label?: string;
}

const statusConfig: Record<string, { className: string; icon: React.ElementType; defaultLabel: string }> = {
  confirmed: {
    className: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20",
    icon: CheckCircle2,
    defaultLabel: "Agendado"
  },
  pending: {
    className: "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border-yellow-500/20",
    icon: Clock,
    defaultLabel: "Pendente"
  },
  cancelled: {
    className: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20",
    icon: XCircle,
    defaultLabel: "Cancelado"
  },
  in_progress: {
    className: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/20",
    icon: Timer,
    defaultLabel: "Em Atendimento"
  },
  completed: {
    className: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
    defaultLabel: "Concluído"
  },
  paid: {
    className: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
    defaultLabel: "Pago"
  },
  pending_payment: {
    className: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20",
    icon: AlertCircle,
    defaultLabel: "Aguard. Pagamento"
  },
  pendente_pagamento: {
    className: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20",
    icon: AlertCircle,
    defaultLabel: "Aguard. Pagamento"
  }
};

function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status as string] || statusConfig.pending;
  const Icon = config.icon;
  
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors uppercase tracking-wider",
        config.className,
        className
      )} 
      {...props}
    >
      <Icon className="w-3 h-3" />
      <span>{label || config.defaultLabel}</span>
    </div>
  );
}

export { Badge, badgeVariants, StatusBadge };
