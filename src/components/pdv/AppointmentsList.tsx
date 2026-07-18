import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Calendar, User, Scissors, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AppointmentsListProps {
  onSelect: (appointment: any) => void;
}

export function AppointmentsList({ onSelect }: AppointmentsListProps) {
  const { clinic } = useClinic() as any;

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["pdv-appointments", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", clinic.id)
        .gte("scheduled_at", today.toISOString())
        .lt("scheduled_at", tomorrow.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!clinic?.id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando fila do dia...</p>
      </div>
    );
  }

  if (!appointments || appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-full text-center">
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
          <Calendar className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="font-semibold text-lg">Nenhum agendamento hoje</h3>
        <p className="text-sm text-muted-foreground max-w-xs mt-1">
          Os clientes agendados para hoje aparecerão aqui para o checkout.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-4 -mr-4">
      <div className="space-y-3 pb-4">
        {appointments.map((appt) => {
          const date = parseISO(appt.scheduled_at);
          const isFinished = appt.status === "completed" || appt.payment_status === "paid";

          return (
            <div 
              key={appt.id} 
              className={`flex flex-col p-4 rounded-xl border transition-all ${
                isFinished 
                  ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60" 
                  : "bg-white dark:bg-slate-900 border-slate-200 shadow-sm hover:shadow hover:border-primary/50 cursor-pointer"
              }`}
              onClick={() => !isFinished && onSelect(appt)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-sm font-bold tracking-tight">
                    {format(date, "HH:mm")}
                  </div>
                  {isFinished && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                      <CheckCircle className="w-3 h-3" /> Concluído
                    </span>
                  )}
                  {appt.confirmation_status === "pending" && !isFinished && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <Clock className="w-3 h-3" /> A Confirmar
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold">R$ {appt.price.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{appt.client_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Scissors className="w-4 h-4" />
                  <span className="truncate">{appt.service_name} • {appt.barber_name}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
