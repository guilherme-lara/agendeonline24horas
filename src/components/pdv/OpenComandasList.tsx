import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Loader2, ClipboardList, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  barbershopId?: string;
  professionalId?: string;
  onSelect: (appointment: any) => void;
}

const OPEN_STATUSES = ["confirmed", "in_progress", "pending", "pending_payment"];

/** Comandas em aberto (atendimentos ainda não pagos) de todos os profissionais. */
export function OpenComandasList({ barbershopId, professionalId, onSelect }: Props) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["pdv-appointments", "open-comandas", barbershopId, professionalId],
    enabled: !!barbershopId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      let q = (supabase as any)
        .from("appointments")
        .select("id, client_name, client_id, customer_id, service_name, price, total_price, barber_id, barber_name, scheduled_at, status, payment_status, appointment_items(id, service_name, price)")
        .eq("barbershop_id", barbershopId)
        .in("status", OPEN_STATUSES)
        .neq("payment_status", "paid")
        .gte("scheduled_at", since.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(200);
      if (professionalId) q = q.eq("barber_id", professionalId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>;
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center p-6">Nenhuma comanda de atendimento em aberto.</p>;
  }

  const groups = data.reduce((acc: Record<string, any[]>, a: any) => {
    const k = a.barber_name || "Sem profissional";
    (acc[k] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([barber, list]) => (
        <div key={barber}>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <User className="h-3 w-3" /> {barber} · {(list as any[]).length}
          </p>
          <div className="space-y-2">
            {(list as any[]).map((a) => {
              const total = Number(a.total_price ?? a.price ?? 0);
              return (
                <div
                  key={a.id}
                  onClick={() => onSelect(a)}
                  className="w-full rounded-xl border border-border bg-card p-3.5 hover:border-primary/50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-bold text-sm text-foreground truncate">{a.client_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseISO(a.scheduled_at), "dd/MM HH:mm")} · {a.status === "in_progress" ? "Em atendimento" : "Aguardando"} · {(a.appointment_items?.length || 1)} item(ns)
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 shrink-0">
                    <span className="font-bold text-primary text-sm">R$ {total.toFixed(2).replace(".", ",")}</span>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(a);
                      }}
                      className="h-8 text-xs font-bold gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar à Comanda
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
