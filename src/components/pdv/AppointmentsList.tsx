import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { format, parseISO } from "date-fns";
import { Loader2, Calendar, User, CheckCircle2, Clock, Plus, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface AppointmentsListProps {
  onSelect: (appointment: any) => void;
  professionalId?: string;
  filter?: "agendados" | "abertas" | "finalizados";
  selectedAppointmentIds?: string[];
}

export function AppointmentsList({ 
  onSelect, 
  professionalId, 
  filter = "agendados",
  selectedAppointmentIds = [] 
}: AppointmentsListProps) {
  const { clinic } = useClinic() as any;

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["pdv-appointments", clinic?.id, professionalId],
    queryFn: async () => {
      if (!clinic?.id) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let query = (supabase as any)
        .from("appointments")
        .select(`
          id,
          client_name,
          client_id,
          client_phone,
          service_name,
          price,
          total_price,
          barber_id,
          barber_name,
          scheduled_at,
          status,
          payment_status,
          confirmation_status,
          has_signal,
          signal_value,
          advance_payment_amount,
          appointment_items (id, service_name, price)
        `)
        .eq("barbershop_id", clinic.id)
        .gte("scheduled_at", today.toISOString())
        .lt("scheduled_at", tomorrow.toISOString())
        .order("scheduled_at", { ascending: true });

      if (professionalId) {
        query = query.eq("barber_id", professionalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];

    return appointments.filter((appt: any) => {
      const isFinished = appt.status === "completed" || appt.payment_status === "paid";
      const isInProgress = appt.status === "in_progress";
      const isCancelled = appt.status === "cancelled";

      if (isCancelled) return false;

      if (filter === "agendados") {
        return !isFinished && !isInProgress;
      }
      if (filter === "abertas") {
        return isInProgress;
      }
      if (filter === "finalizados") {
        return isFinished;
      }
      return true;
    });
  }, [appointments, filter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-xs text-muted-foreground font-medium">Carregando agendamentos...</p>
      </div>
    );
  }

  if (filteredAppointments.length === 0) {
    const emptyMessages = {
      agendados: "Nenhum agendamento pendente para hoje.",
      abertas: "Nenhum atendimento em andamento no momento.",
      finalizados: "Nenhum atendimento finalizado hoje ainda."
    };

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-64">
        <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
          <Calendar className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="font-semibold text-sm text-foreground">{emptyMessages[filter]}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {filter === "agendados" ? "Novos clientes agendados aparecerão automaticamente aqui." : "As alterações serão refletidas em tempo real."}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-1">
      <div className="space-y-2.5 pb-4">
        {filteredAppointments.map((appt: any) => {
          const date = parseISO(appt.scheduled_at);
          const isFinished = appt.status === "completed" || appt.payment_status === "paid";
          const isInCart = selectedAppointmentIds.includes(appt.id);
          const signalAmount = (appt.has_signal && appt.signal_value ? Number(appt.signal_value) : 0) || Number(appt.advance_payment_amount || 0);
          const finalPrice = Number(appt.total_price ?? appt.price ?? 0);

          return (
            <div 
              key={appt.id} 
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                isFinished 
                  ? "bg-muted/30 border-border/60 opacity-70" 
                  : isInCart
                    ? "bg-emerald-500/5 border-emerald-500/30 shadow-xs"
                    : "bg-card border-border hover:border-primary/40 hover:shadow-xs shadow-2xs"
              }`}
            >
              {/* Left Info: Time + Client + Service */}
              <div className="flex items-center gap-3.5 min-w-0 pr-4">
                <div className="flex flex-col items-center justify-center bg-muted/60 text-foreground px-2.5 py-1.5 rounded-lg border border-border/60 shrink-0">
                  <span className="text-xs font-black tracking-tight">{format(date, "HH:mm")}</span>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground truncate">
                      {appt.client_name}
                    </span>
                    {appt.confirmation_status === "pending" && !isFinished && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-sm border border-amber-500/20">
                        <Clock className="w-2.5 h-2.5" /> A Confirmar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate">
                    <span className="truncate">{appt.service_name}</span>
                    {appt.barber_name && (
                      <>
                        <span>•</span>
                        <span className="truncate text-foreground/80 font-medium">{appt.barber_name}</span>
                      </>
                    )}
                  </div>

                  {signalAmount > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded-sm border border-emerald-500/20">
                        Sinal Pago: R$ {signalAmount.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Action: Price + Clear Button */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground block">
                    R$ {finalPrice.toFixed(2).replace(".", ",")}
                  </span>
                </div>

                {isFinished ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs py-1 h-8">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Finalizado
                  </Badge>
                ) : isInCart ? (
                  <Button
                    disabled
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Na Comanda
                  </Button>
                ) : (
                  <Button 
                    size="sm"
                    onClick={() => onSelect(appt)}
                    className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar à Comanda
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
