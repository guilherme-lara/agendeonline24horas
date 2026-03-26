import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, DollarSign, Calendar, Clock, CheckCircle2, LogOut, FileText, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toBRT, nowBRT } from "@/lib/timezone";
import BarberStatementPDF from "@/components/BarberStatementPDF";

const statusColors: Record<string, string> = {
  completed: "border-emerald-500/30 bg-emerald-500/5",
  paid: "border-emerald-500/30 bg-emerald-500/5",
  confirmed: "border-blue-500/30 bg-blue-500/5",
  pending: "border-yellow-500/30 bg-yellow-500/5",
};

const statusLabel: Record<string, { text: string; color: string }> = {
  completed: { text: "✓ Concluído", color: "text-emerald-500" },
  paid: { text: "✓ Pago", color: "text-emerald-500" },
  confirmed: { text: "Agendado", color: "text-blue-500" },
  pending: { text: "Pendente", color: "text-yellow-500" },
};

const BarberDashboard = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showStatement, setShowStatement] = useState(false);
  const [activeTab, setActiveTab] = useState<"agenda" | "ganhos">("agenda");
  const today = nowBRT();

  const { data: barber, isLoading: barberLoading } = useQuery({
    queryKey: ["barber-self", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("barbers") as any)
        .select("*, barbershops:barbershop_id(name, logo_url, slug)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const barberBarbershopId = barber?.barbershop_id;

  // Realtime: escuta mudanças em appointments da barbearia do barbeiro
  useEffect(() => {
    if (!barberBarbershopId) return;
    const channel = supabase
      .channel(`barber-live-${barberBarbershopId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: `barbershop_id=eq.${barberBarbershopId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["barber-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["barber-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [barberBarbershopId, queryClient]);

  const { data: appointments = [], isLoading: apptLoading } = useQuery({
    queryKey: ["barber-appointments", barber?.name, barber?.barbershop_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", barber.barbershop_id)
        .eq("barber_name", barber.name)
        .gte("scheduled_at", startOfMonth(today).toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!barber?.name && !!barber?.barbershop_id,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["barber-orders", barber?.name, barber?.barbershop_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("barbershop_id", barber.barbershop_id)
        .eq("barber_name", barber.name)
        .eq("status", "paid")
        .gte("created_at", startOfMonth(today).toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!barber?.name && !!barber?.barbershop_id,
  });

  // No Pay No Slot: filtra agendamentos pix_online com pagamento pendente
  const confirmedAppointments = useMemo(() => 
    appointments.filter((a: any) => {
      if (a.payment_method === 'pix_online' && ['pending', 'awaiting'].includes(a.payment_status)) return false;
      return true;
    }), [appointments]);

  const commissionRate = barber?.commission_pct || 50;

  const stats = useMemo(() => {
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const completedToday = appointments.filter((a: any) => {
      const d = toBRT(a.scheduled_at);
      return d >= todayStart && d <= todayEnd && a.status === "completed";
    });

    const todayGross = completedToday.reduce((sum: number, a: any) => sum + (a.price || 0), 0);
    
    const monthCompleted = appointments.filter((a: any) => a.status === "completed");
    const monthGross = monthCompleted.reduce((sum: number, a: any) => sum + (a.price || 0), 0);

    const pendingAppts = appointments.filter((a: any) =>
      a.status === "confirmed" || a.status === "pending"
    );

    return {
      todayEarnings: todayGross * (commissionRate / 100),
      monthCommission: monthGross * (commissionRate / 100),
      pendingCount: pendingAppts.length,
    };
  }, [appointments, commissionRate, today]);

  const todayAppointments = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    return appointments.filter((a: any) => {
      const d = toBRT(a.scheduled_at);
      return format(d, "yyyy-MM-dd") === todayStr && a.status !== "cancelled";
    });
  }, [appointments, today]);

  const handleMarkDone = async (appointmentId: string) => {
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", appointmentId);
    queryClient.invalidateQueries({ queryKey: ["barber-appointments"] });
  };

  if (barberLoading || apptLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <User className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">Conta não vinculada</h1>
          <p className="text-sm text-muted-foreground">Sua conta não está vinculada a nenhuma barbearia. Contate o administrador.</p>
          <Button variant="outline" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold">{barber.name}</h1>
          <p className="text-[10px] text-muted-foreground">{(barber as any).barbershops?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowStatement(true)} className="h-8 text-xs">
            <FileText className="h-3.5 w-3.5 mr-1" /> Extrato
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut} className="h-8 text-xs text-muted-foreground">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Financial Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-lg font-black text-foreground">
                R$ {stats.todayEarnings.toFixed(0)}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Meu Ganho Hoje</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-lg font-black text-foreground">
                R$ {stats.monthCommission.toFixed(0)}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Comissão Mês</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
              <p className="text-lg font-black text-foreground">{stats.pendingCount}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Pendentes</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Comissão: {commissionRate}% sobre serviços concluídos
        </p>

        {/* Tab content based on activeTab */}
        {activeTab === "agenda" && (
          <>
            {/* Today's Agenda */}
            <div>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Agenda de Hoje — {format(today, "dd/MM", { locale: ptBR })}
              </h2>

              {todayAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento para hoje.</p>
              ) : (
                <div className="space-y-2">
                  {todayAppointments.map((appt: any) => {
                    const time = format(toBRT(appt.scheduled_at), "HH:mm");
                    const isDone = appt.status === "completed";
                    const status = statusLabel[appt.status] || statusLabel.pending;
                    const colorClass = statusColors[appt.status] || statusColors.pending;
                    return (
                      <div key={appt.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${colorClass} ${isDone ? "opacity-70" : ""}`}>
                        <div className="text-center min-w-[50px]">
                          <p className="text-sm font-black">{time}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{appt.client_name}</p>
                          <p className="text-xs text-muted-foreground">{appt.service_name} • R$ {appt.price}</p>
                        </div>
                        {!isDone ? (
                          <Button size="sm" onClick={() => handleMarkDone(appt.id)} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Realizado
                          </Button>
                        ) : (
                          <span className={`text-[10px] font-bold ${status.color}`}>{status.text}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming */}
            {appointments.filter((a: any) => {
              const d = toBRT(a.scheduled_at);
              return d > endOfDay(today) && a.status !== "cancelled";
            }).length > 0 && (
              <div>
                <h2 className="text-sm font-bold mb-3">Próximos Dias</h2>
                <div className="space-y-2">
                  {appointments
                    .filter((a: any) => toBRT(a.scheduled_at) > endOfDay(today) && a.status !== "cancelled")
                    .slice(0, 10)
                    .map((appt: any) => {
                      const status = statusLabel[appt.status] || statusLabel.pending;
                      const colorClass = statusColors[appt.status] || statusColors.pending;
                      return (
                        <div key={appt.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${colorClass}`}>
                          <div className="text-center min-w-[70px]">
                            <p className="text-[10px] text-muted-foreground">{format(toBRT(appt.scheduled_at), "dd/MM")}</p>
                            <p className="text-sm font-bold">{format(toBRT(appt.scheduled_at), "HH:mm")}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{appt.client_name}</p>
                            <p className="text-xs text-muted-foreground">{appt.service_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold">R$ {appt.price}</p>
                            <p className={`text-[9px] font-bold ${status.color}`}>{status.text}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "ganhos" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold">Serviços Concluídos no Mês</h2>
            {appointments.filter((a: any) => a.status === "completed").length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço concluído este mês.</p>
            ) : (
              <div className="space-y-2">
                {appointments.filter((a: any) => a.status === "completed").map((appt: any) => {
                  const commission = (appt.price || 0) * (commissionRate / 100);
                  return (
                    <div key={appt.id} className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                      <div className="text-center min-w-[70px]">
                        <p className="text-[10px] text-muted-foreground">{format(toBRT(appt.scheduled_at), "dd/MM")}</p>
                        <p className="text-sm font-bold">{format(toBRT(appt.scheduled_at), "HH:mm")}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{appt.client_name}</p>
                        <p className="text-xs text-muted-foreground">{appt.service_name} • R$ {appt.price}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Meu Ganho</p>
                        <p className="text-sm font-black text-emerald-500">R$ {commission.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav for Barber */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab("agenda")}
            className={`flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-xl transition-colors ${activeTab === "agenda" ? "text-primary" : "text-muted-foreground"}`}
          >
            <Calendar className={`h-5 w-5 ${activeTab === "agenda" ? "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : ""}`} />
            <span className="text-[10px] font-bold">Agenda</span>
          </button>
          <button
            onClick={() => setActiveTab("ganhos")}
            className={`flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-xl transition-colors ${activeTab === "ganhos" ? "text-primary" : "text-muted-foreground"}`}
          >
            <DollarSign className={`h-5 w-5 ${activeTab === "ganhos" ? "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : ""}`} />
            <span className="text-[10px] font-bold">Ganhos</span>
          </button>
          <button
            onClick={() => setShowStatement(true)}
            className="flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-xl transition-colors text-muted-foreground"
          >
            <FileText className="h-5 w-5" />
            <span className="text-[10px] font-bold">Extrato</span>
          </button>
          <button
            onClick={() => navigate("/barber/perfil")}
            className="flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-xl transition-colors text-muted-foreground"
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-bold">Perfil</span>
          </button>
        </div>
      </nav>

      {/* Statement Modal */}
      {showStatement && (
        <BarberStatementPDF
          barber={barber}
          orders={orders}
          appointments={appointments}
          commissionRate={commissionRate}
          onClose={() => setShowStatement(false)}
        />
      )}
    </div>
  );
};

export default BarberDashboard;
