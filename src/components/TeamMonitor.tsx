import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { toBRT } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, Scissors, Clock } from "lucide-react";
import { useMemo } from "react";

export default function TeamMonitor({ barbershopId, barbers }: { barbershopId: string, barbers: any[] }) {
  const today = new Date();
  
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["team-monitor-appointments", barbershopId, format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("id, barber_id, barber_name, status, price, total_price")
        .eq("barbershop_id", barbershopId)
        .gte("scheduled_at", start)
        .lte("scheduled_at", end);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000 // Polling a cada 10s para o painel do gestor
  });

  const statsByBarber = useMemo(() => {
    if (!appointments) return {};
    
    const stats: Record<string, any> = {};
    
    barbers.forEach(b => {
      stats[b.id] = {
        inProgress: 0,
        completedCount: 0,
        revenue: 0,
        estimatedCommission: 0,
      };
    });

    appointments.forEach(appt => {
      // Usar barber_id preferencialmente. Fallback para barber_name se legado.
      const bId = appt.barber_id || barbers.find(b => b.name === appt.barber_name)?.id;
      if (!bId || !stats[bId]) return;

      const barber = barbers.find(b => b.id === bId);
      const commissionRate = barber?.commission_pct || 50;

      if (appt.status === "in_progress") {
        stats[bId].inProgress += 1;
      } else if (appt.status === "completed") {
        stats[bId].completedCount += 1;
        const val = Number(appt.total_price || appt.price || 0);
        stats[bId].revenue += val;
        stats[bId].estimatedCommission += val * (commissionRate / 100);
      }
    });

    return stats;
  }, [appointments, barbers]);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Monitoramento de Hoje
        </h3>
        <span className="text-[10px] uppercase font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-md">Ao Vivo</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {barbers.filter(b => b.active).map(b => {
          const s = statsByBarber[b.id] || { inProgress: 0, completedCount: 0, revenue: 0, estimatedCommission: 0 };
          return (
            <Card key={b.id} className="border-border bg-card shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                  <p className="font-bold text-sm truncate pr-2">{b.name}</p>
                  {s.inProgress > 0 ? (
                    <span className="text-[10px] font-black text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" /> Em Atendimento
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">Livre</span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-secondary/50 rounded-lg p-2">
                    <Scissors className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm font-black">{s.completedCount}</p>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Concluídos</p>
                  </div>
                  <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                    <p className="text-xs font-black text-emerald-600">R$ {s.revenue.toFixed(0)}</p>
                    <p className="text-[9px] uppercase font-bold text-emerald-600/80 mb-1">Faturamento</p>
                    <p className="text-[10px] font-medium text-emerald-600/70 border-t border-emerald-500/20 pt-1 mt-1">
                      Comissão: R$ {s.estimatedCommission.toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
