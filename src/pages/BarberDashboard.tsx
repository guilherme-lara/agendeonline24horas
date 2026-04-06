import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, DollarSign, Calendar, Clock, CheckCircle2, LogOut, FileText, User, Target, Send, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toBRT, nowBRT } from "@/lib/timezone";
import BarberStatementPDF from "@/components/BarberStatementPDF";
import { useSoundFeedback } from "@/hooks/useSoundFeedback";
import confetti from "canvas-confetti";

const statusColors: Record<string, string> = {
  completed: "border-emerald-500/30 bg-emerald-500/5",
  paid: "border-emerald-500/30 bg-emerald-500/5",
  confirmed: "border-blue-500/30 bg-blue-500/5",
  pending: "border-yellow-500/30 bg-yellow-500/5",
  pending_payment: "border-amber-500/30 bg-amber-500/5",
  pendente_pagamento: "border-amber-500/30 bg-amber-500/5",
};

const statusLabel: Record<string, { text: string; color: string }> = {
  completed: { text: "Concluído", color: "text-emerald-500" },
  paid: { text: "Pago", color: "text-emerald-500" },
  confirmed: { text: "Agendado", color: "text-blue-500" },
  pending: { text: "Pendente", color: "text-yellow-500" },
  pending_payment: { text: "⏳ Aguard. Pagamento", color: "text-amber-500" },
  pendente_pagamento: { text: "⏳ Aguard. Pagamento", color: "text-amber-500" },
};

const DAILY_GOAL_KEY = "barber_daily_goal";

const BarberDashboard = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showStatement, setShowStatement] = useState(false);
  const [activeTab, setActiveTab] = useState<"agenda" | "ganhos">("agenda");
  const today = nowBRT();
  const { playCaching } = useSoundFeedback();
  const prevCountRef = useRef<number | null>(null);
  const goalCelebratedRef = useRef(false);
  const [dailyGoal, setDailyGoal] = useState(() => {
    const stored = localStorage.getItem(DAILY_GOAL_KEY);
    return stored ? Number(stored) : 300;
  });

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

  // Realtime: escuta mudanças em appointments da barbearia do barbeiro + som
  useEffect(() => {
    if (!barberBarbershopId) return;
    const channel = supabase
      .channel(`barber-live-${barberBarbershopId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: `barbershop_id=eq.${barberBarbershopId}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["barber-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["barber-orders"] });
        if (payload.eventType === "INSERT" || (payload.eventType === "UPDATE" && payload.new?.status === "confirmed")) {
          playCaching();
        }
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `barbershop_id=eq.${barberBarbershopId}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["barber-orders"] });
        if (payload.eventType === "INSERT") {
          playCaching();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [barberBarbershopId, queryClient, playCaching]);

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

    const completedToday = confirmedAppointments.filter((a: any) => {
      const d = toBRT(a.scheduled_at);
      return d >= todayStart && d <= todayEnd && a.status === "completed";
    });

    const todayGross = completedToday.reduce((sum: number, a: any) => sum + (a.price || 0), 0);
    
    const monthCompleted = confirmedAppointments.filter((a: any) => a.status === "completed");
    const monthGross = monthCompleted.reduce((sum: number, a: any) => sum + (a.price || 0), 0);

    const pendingAppts = confirmedAppointments.filter((a: any) =>
      a.status === "confirmed" || a.status === "pending"
    );

    const todayEarnings = todayGross * (commissionRate / 100);
    const completedTodayCount = completedToday.length;

    return {
      todayEarnings,
      monthCommission: monthGross * (commissionRate / 100),
      pendingCount: pendingAppts.length,
      completedTodayCount,
    };
  }, [confirmedAppointments, commissionRate, today]);

  // Goal progress
  const goalProgress = dailyGoal > 0 ? Math.min((stats.todayEarnings / dailyGoal) * 100, 100) : 0;

  // Celebrate on 100% goal
  useEffect(() => {
    if (goalProgress >= 100 && !goalCelebratedRef.current) {
      goalCelebratedRef.current = true;
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      playCaching();
    }
    if (goalProgress < 100) goalCelebratedRef.current = false;
  }, [goalProgress, playCaching]);

  const handleGoalChange = useCallback((val: string) => {
    const n = Number(val.replace(/\D/g, ""));
    setDailyGoal(n);
    localStorage.setItem(DAILY_GOAL_KEY, String(n));
  }, []);

  const handleCloseDay = useCallback(() => {
    const todayStr = format(today, "dd/MM/yyyy");
    const msg = `📊 *Relatório Final de Hoje (${todayStr})*%0A✅ Atendimentos: ${stats.completedTodayCount}%0A💰 Minha Comissão: R$ ${stats.todayEarnings.toFixed(2)}%0A%0ADia finalizado com sucesso! 🎯`;
    const phone = "";
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  }, [today, stats]);

  const todayAppointments = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    return confirmedAppointments.filter((a: any) => {
      const d = toBRT(a.scheduled_at);
      return format(d, "yyyy-MM-dd") === todayStr && a.status !== "cancelled";
    });
  }, [confirmedAppointments, today]);

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

        {/* Daily Goal Progress */}
        <Card className="border-border bg-card overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Target className="h-3 w-3" /> Meta Diária
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">R$</span>
                <Input
                  value={dailyGoal}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  className="h-7 w-20 text-xs text-right bg-secondary border-border"
                />
              </div>
            </div>
            <Progress value={goalProgress} className="h-3 bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:via-cyan-400 [&>div]:to-cyan-300 [&>div]:shadow-[0_0_12px_rgba(0,255,200,0.4)]" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground">
                R$ {stats.todayEarnings.toFixed(0)} <span className="text-muted-foreground font-normal">/ R$ {dailyGoal}</span>
              </span>
              <span className={`text-xs font-black ${goalProgress >= 100 ? "text-emerald-400" : "text-cyan-400"}`}>
                {goalProgress.toFixed(0)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Close Day Button */}
        <Button
          variant="outline"
          onClick={handleCloseDay}
          className="w-full h-10 rounded-xl border-border text-xs font-black flex items-center gap-2"
        >
          <Send className="h-3.5 w-3.5" /> Fechar Dia (WhatsApp)
        </Button>

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
                          <div className="flex items-center gap-1">
                            {appt.client_phone && (
                              <Button size="sm" variant="ghost" onClick={() => {
                                const cleanPhone = appt.client_phone.replace(/\D/g, "");
                                const dateStr = format(toBRT(appt.scheduled_at), "dd/MM");
                                const timeStr = format(toBRT(appt.scheduled_at), "HH:mm");
                                const msg = encodeURIComponent(`Olá, ${appt.client_name}! Passando para confirmar seu agendamento na nossa barbearia para o dia ${dateStr} às ${timeStr}. Qualquer dúvida, estamos à disposição!`);
                                window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, '_blank');
                              }} className="h-8 text-xs text-emerald-500">
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" onClick={() => handleMarkDone(appt.id)} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Realizado
                            </Button>
                          </div>
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
            {confirmedAppointments.filter((a: any) => {
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
            {confirmedAppointments.filter((a: any) => a.status === "completed").length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço concluído este mês.</p>
            ) : (
              <div className="space-y-2">
                {confirmedAppointments.filter((a: any) => a.status === "completed").map((appt: any) => {
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
