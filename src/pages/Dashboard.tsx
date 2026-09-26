import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSoundFeedback } from "@/hooks/useSoundFeedback";
import {
  DollarSign, AlertTriangle, Building2, RefreshCw, 
  Crown, CalendarDays, Wallet, ArrowUpRight, Clock, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  format, subDays, startOfMonth, endOfMonth, 
  isSameDay, startOfDay, isAfter
} from "date-fns";
import { toBRT } from "@/lib/timezone";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid 
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import UpgradeModal from "@/components/UpgradeModal";
import ExpirationBanner from "@/components/ExpirationBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clinic, loading: shopLoading, professionalId } = useClinic() as any;
  const { isProfessional } = useAuth();
  
  const [upgradeModal, setUpgradeModal] = useState({ open: false, plan: "", feature: "" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { playCaching } = useSoundFeedback();

  useEffect(() => {
    if (!lastUpdated) return;
    const timer = setTimeout(() => setLastUpdated(null), 5000);
    return () => clearTimeout(timer);
  }, [lastUpdated]);

  // --- REALTIME (WEB SOCKETS) ---
  useEffect(() => {
    if (!clinic?.id) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { 
        event: '*', schema: 'public', table: 'appointments', filter: `barbershop_id=eq.${clinic.id}` 
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
        if (payload.eventType === "INSERT" || (payload.eventType === "UPDATE" && payload.new?.status === "confirmed")) {
          playCaching();
          setLastUpdated(new Date());
        }
      })
      .on('postgres_changes', { 
        event: '*', schema: 'public', table: 'cash_movements', filter: `barbershop_id=eq.${clinic.id}` 
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-cash-movements"] });
        if (payload.eventType === "INSERT") {
          playCaching();
          setLastUpdated(new Date());
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinic?.id, queryClient, playCaching]);

  // --- QUERIES ---
  const monthStartIso = useMemo(() => {
    const now = toBRT(new Date().toISOString());
    return `${format(startOfMonth(now), "yyyy-MM-dd")}T00:00:00-03:00`;
  }, []);

  // 1. Appointments (Fonte da verdade para métricas operacionais e Ticket Médio)
  const { data: appointments = [], isLoading: loadingAppts, isError: errorAppts } = useQuery({
    queryKey: ["dashboard-appointments", clinic?.id, professionalId],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("id, client_name, service_name, scheduled_at, status, price, total_price, payment_status, barber_id, barber_name")
        .eq("barbershop_id", clinic.id)
        .gte("scheduled_at", monthStartIso);

      if (isProfessional && professionalId) {
        query = query.eq("barber_id", professionalId);
      }

      const { data, error } = await query.order("scheduled_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
    staleTime: 30 * 1000,
  });

  // 2. Cash Movements (Fonte da verdade para faturamento de caixa - sales e appointments)
  const { data: cashMovements = [], isLoading: loadingCash, isError: errorCash } = useQuery({
    queryKey: ["dashboard-cash-movements", clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("id, amount, created_at, movement_type, payment_method, description, appointment_id")
        .eq("barbershop_id", clinic.id)
        .in("movement_type", ["sale", "appointment"])
        .gte("created_at", monthStartIso)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      return data || [];
    },
    enabled: !!clinic?.id,
    staleTime: 30 * 1000,
  });

  // --- LÓGICA DE NEGÓCIO (KPIs) ---
  const kpis = useMemo(() => {
    const nowBrt = toBRT(new Date().toISOString());
    const today = startOfDay(nowBrt);
    const startMonth = startOfMonth(nowBrt);
    const endMonth = endOfMonth(nowBrt);

    let todayRevTotal = 0;
    let monthRevTotal = 0;

    // Faturamento Total lido estritamente de cash_movements
    cashMovements.forEach((movement: any) => {
      const moveDate = toBRT(movement.created_at);
      const val = Number(movement.amount || 0);
      if (moveDate >= startMonth && moveDate <= endMonth) monthRevTotal += val;
      if (isSameDay(startOfDay(moveDate), today)) todayRevTotal += val;
    });

    // Gráfico de 7 dias com base em cash_movements
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const dayTarget = subDays(today, 6 - i);
      let dayRev = 0;
      cashMovements.forEach((m: any) => {
        if (isSameDay(toBRT(m.created_at), dayTarget)) {
          dayRev += Number(m.amount || 0);
        }
      });
      return { 
        day: format(dayTarget, "EEE", { locale: ptBR }).toUpperCase(), 
        "Faturamento": dayRev 
      };
    });

    // Métricas Operacionais e Ticket Médio calculadas com base em appointments (status = 'completed')
    const completedTodayAppts = appointments.filter(
      (a: any) => isSameDay(toBRT(a.scheduled_at), today) && a.status === "completed"
    );
    const completedTodayCount = completedTodayAppts.length;
    const completedTodayRevenue = completedTodayAppts.reduce(
      (sum: number, a: any) => sum + Number(a.total_price ?? a.price ?? 0), 
      0
    );

    const ticketMedio = completedTodayCount > 0 
      ? (completedTodayRevenue / completedTodayCount) 
      : 0;

    // Métricas Operacionais (Agendamentos de Hoje)
    const todayAppointments = appointments.filter(
      (a: any) => isSameDay(toBRT(a.scheduled_at), today) && a.status !== "cancelled"
    );
    
    // Próximos Atendimentos (A partir de agora)
    const upcomingAppts = todayAppointments
      .filter((a: any) => isAfter(new Date(a.scheduled_at), new Date()) && (a.status === "scheduled" || a.status === "confirmed"))
      .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 5);

    // Live Feed de Atividade Recente (movimentações do dia / recentes)
    const todayMovements = cashMovements
      .filter((m: any) => isSameDay(toBRT(m.created_at), today))
      .slice(0, 10);

    return { 
      todayRevTotal, 
      monthRevTotal, 
      chartData, 
      ticketMedio, 
      todayApptsCount: todayAppointments.length,
      completedTodayCount,
      upcomingAppts,
      todayMovements
    };
  }, [appointments, cashMovements]);

  // --- RENDERING ---
  if (shopLoading || (loadingAppts && !appointments.length) || (loadingCash && !cashMovements.length)) return <DashboardSkeleton />;
  if (!clinic) return null;

  if (errorAppts || errorCash) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <AlertTriangle className="h-9 w-9 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Problema de conexão</h2>
        <Button onClick={() => queryClient.invalidateQueries()} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
        </Button>
      </div>
    );
  }

  const kpiCards = [
    { icon: CalendarDays, label: "Agendamentos Hoje", value: kpis.todayApptsCount.toString(), isCurrency: false, color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: Wallet, label: "Faturamento Hoje", value: kpis.todayRevTotal, isCurrency: true, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { icon: ArrowUpRight, label: "Ticket Médio", value: kpis.ticketMedio, isCurrency: true, color: "text-amber-500", bg: "bg-amber-500/10" },
    { icon: DollarSign, label: "Faturamento Mês", value: kpis.monthRevTotal, isCurrency: true, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <UpgradeModal open={upgradeModal.open} onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })} requiredPlan={upgradeModal.plan} featureName={upgradeModal.feature} />
      <ExpirationBanner />

      {/* HEADER */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-card border border-border flex items-center justify-center overflow-hidden shadow-xs">
            {clinic.logo_url ? <img src={clinic.logo_url} className="h-full w-full object-cover" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{clinic.name}</h1>
            <p className="text-muted-foreground text-sm font-medium mt-0.5 capitalize">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full animate-in fade-in">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sincronizado
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
            <Crown className="h-3.5 w-3.5" /> {clinic.plan_name || "Premium"}
          </span>
        </div>
      </div>

      {/* KPIs DE ALTO VALOR (Métricas Reais) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((kpi, i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-5 shadow-xs transition-all hover:border-primary/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", kpi.bg, kpi.color)}>
                <kpi.icon className="h-4 w-4" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {kpi.isCurrency ? `R$ ${Number(kpi.value).toFixed(2).replace(".", ",")}` : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* PAINEL OPERACIONAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO (2/3 da tela) */}
        <div className="lg:col-span-2 rounded-xl bg-card border border-border p-6 shadow-xs">
          <div className="mb-6">
            <h2 className="text-base font-bold text-foreground">Receita Semanal</h2>
            <p className="text-xs text-muted-foreground">Últimos 7 dias de faturamento (Caixa)</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  cursor={{ fill: "hsl(var(--primary) / 0.05)" }}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "12px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PAINEL DIREITO (1/3 da tela) COM TABS: ATIVIDADE LIVE vs PRÓXIMOS ATENDIMENTOS */}
        <div className="rounded-xl bg-card border border-border p-6 shadow-xs flex flex-col min-h-[400px]">
          <Tabs defaultValue="live" className="w-full flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-muted/60 p-1 rounded-xl h-9">
                <TabsTrigger value="live" className="text-xs font-bold rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Atividade Live
                </TabsTrigger>
                <TabsTrigger value="proximos" className="text-xs font-bold rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  <Clock className="h-3.5 w-3.5" />
                  Próximos ({kpis.upcomingAppts.length})
                </TabsTrigger>
              </TabsList>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => navigate("/dashboard/agenda")}>
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>

            {/* TAB 1: ATIVIDADE LIVE (Escuta e exibe cash_movements em tempo real) */}
            <TabsContent value="live" className="flex-1 flex flex-col mt-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Entradas no Caixa Hoje</span>
                <span className="font-bold text-foreground">{kpis.todayMovements.length} registro(s)</span>
              </div>

              {kpis.todayMovements.length > 0 ? (
                <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1 flex-1">
                  {kpis.todayMovements.map((move: any) => (
                    <div key={move.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/70 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {move.description || (move.movement_type === "sale" ? "Venda PDV" : "Entrada Caixa")}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                            <span className="capitalize">{move.payment_method || "balcão"}</span>
                            <span>•</span>
                            <span>{format(toBRT(move.created_at), "HH:mm")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          + R$ {Number(move.amount || 0).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-foreground">Caixa pronto</p>
                  <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada hoje ainda.</p>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: PRÓXIMOS ATENDIMENTOS */}
            <TabsContent value="proximos" className="flex-1 flex flex-col mt-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Fila do Dia</span>
                <span className="font-bold text-foreground">{kpis.upcomingAppts.length} agendado(s)</span>
              </div>

              {kpis.upcomingAppts.length > 0 ? (
                <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1 flex-1">
                  {kpis.upcomingAppts.map((appt: any) => (
                    <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/80 transition-colors">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{appt.client_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{appt.service_name}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(appt.scheduled_at), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-foreground">Agenda livre</p>
                  <p className="text-xs text-muted-foreground">Nenhum atendimento pendente para hoje.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <Button variant="outline" className="w-full mt-4 text-xs font-semibold" onClick={() => navigate("/dashboard/agenda")}>
            Abrir Agenda Completa
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;