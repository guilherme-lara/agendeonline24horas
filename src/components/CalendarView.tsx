import { useMemo, useState } from "react";
import { format, isSameDay, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  client_name: string;
  service_name: string;
  scheduled_at: string;
  price: number;
  status: string;
}

interface CalendarViewProps {
  appointments: Appointment[];
  barbershopId?: string;
  onRefresh?: () => void; // Adicionado para recarregar a tela após soltar
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 - 19:00

const statusConfig: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: "bg-primary/15", border: "border-primary/40", text: "text-primary" },
  pending: { bg: "bg-muted", border: "border-muted-foreground/30", text: "text-muted-foreground" },
  completed: { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-400" },
  cancelled: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive" },
};

const CalendarView = ({ appointments, onRefresh }: CalendarViewProps) => {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Estado para controle visual de onde o card está passando
  const [draggingApptId, setDraggingApptId] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((a) => isSameDay(new Date(a.scheduled_at), day) && a.status !== "cancelled");

  // --- MUTAÇÃO: REMARCAR NO BANCO DE DADOS ---
  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, newDateStr }: { id: string; newDateStr: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ scheduled_at: newDateStr })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Agendamento remarcado!", description: "A agenda foi atualizada com sucesso." });
      if (onRefresh) onRefresh(); // Recarrega os dados do componente pai (Agenda.tsx)
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remarcar", description: err.message, variant: "destructive" });
    },
    onSettled: () => setDraggingApptId(null)
  });

  // --- HANDLERS DE DRAG AND DROP ---
  const handleDragStart = (e: React.DragEvent, apptId: string) => {
    e.dataTransfer.setData("appt_id", apptId);
    setDraggingApptId(apptId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o Drop
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    const apptId = e.dataTransfer.getData("appt_id");
    if (!apptId) return;

    // Calcula a nova data/hora com base no bloco onde foi solto
    const newDate = new Date(day);
    newDate.setHours(hour, 0, 0, 0); // Zera os minutos para encaixar perfeitamente no bloco

    rescheduleMutation.mutate({ id: apptId, newDateStr: newDate.toISOString() });
  };

  return (
    <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl relative">
      
      {/* Overlay de carregamento durante o arrastar */}
      {rescheduleMutation.isPending && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((p) => addDays(p, -7))} className="hover:bg-primary/20 hover:text-primary rounded-xl">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-display text-sm font-black tracking-widest uppercase text-muted-foreground">
          {format(days[0], "dd MMM", { locale: ptBR })} — {format(days[6], "dd MMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((p) => addDays(p, 7))} className="hover:bg-primary/20 hover:text-primary rounded-xl">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-card">
            <div className="p-2" />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`p-3 text-center border-l border-border ${
                  isSameDay(day, new Date()) ? "bg-primary/5" : ""
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</p>
                <p className={`text-lg font-black mt-1 ${isSameDay(day, new Date()) ? "text-primary" : "text-foreground"}`}>
                  {format(day, "dd")}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 min-h-[60px]">
              <div className="p-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-3 pt-2">
                {String(hour).padStart(2, "0")}:00
              </div>
              
              {days.map((day) => {
                const dayAppts = getAppointmentsForDay(day).filter((a) => {
                  const h = new Date(a.scheduled_at).getHours();
                  return h === hour;
                });
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className="border-l border-border/50 p-1 relative transition-colors hover:bg-primary/5 data-[is-dragover=true]:bg-primary/20"
                    
                    // EVENTOS DE DROP ZONE (RECEBER O CARD)
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => e.currentTarget.setAttribute('data-is-dragover', 'true')}
                    onDragLeave={(e) => e.currentTarget.removeAttribute('data-is-dragover')}
                    onDrop={(e) => {
                      e.currentTarget.removeAttribute('data-is-dragover');
                      handleDrop(e, day, hour);
                    }}
                  >
                    {dayAppts.map((a) => {
                      const cfg = statusConfig[a.status] || statusConfig.pending;
                      const isDraggingThis = draggingApptId === a.id;
                      
                      return (
                        <div
                          key={a.id}
                          
                          // EVENTOS DE DRAG (ARRASTAR O CARD)
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, a.id)}
                          onDragEnd={() => setDraggingApptId(null)}
                          
                          className={`rounded-lg px-2 py-1.5 mb-1 border shadow-sm transition-all
                            ${cfg.bg} ${cfg.border} ${cfg.text} 
                            cursor-grab active:cursor-grabbing
                            hover:brightness-110 hover:scale-[1.02]
                            ${isDraggingThis ? "opacity-50 scale-95 border-dashed" : "opacity-100"}
                          `}
                          title={`${a.client_name} - ${a.service_name}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-black text-[9px] tracking-widest uppercase bg-background/50 px-1 rounded-sm">
                              {format(new Date(a.scheduled_at), "HH:mm")}
                            </span>
                            {/* Você pode adicionar um ícone de "grip" aqui se quiser */}
                          </div>
                          <p className="font-bold text-xs truncate leading-tight">{a.client_name}</p>
                          <p className="text-[9px] font-medium truncate opacity-80">{a.service_name}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
