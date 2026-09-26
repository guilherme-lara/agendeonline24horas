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
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import UpgradeModal from "@/components/UpgradeModal";
import ExpirationBanner from "@/components/ExpirationBanner";

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clinic, loading: shopLoading, professionalId } = useClinic() as any;
  const { isProfessional } = useAuth();
  const { toast } = useToast();
  
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
        event: '*', schema: 'public', table: 'orders', filter: `barbershop_id=eq.${clinic.id}` 
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
        if (payload.eventType === "INSERT") {
          playCaching();
          setLastUpdated(new Date());
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinic?.id, queryClient]);

  // --- QUERIES ---
  const monthStartIso = useMemo(() => {
    const now = toBRT(new Date().toISOString());
    return `${format(startOfMonth(now), "yyyy-MM-dd")}T00:00:00-03:00`;
  }, []);

  const { data: appointments = [], isLoading: loadingAppts, isError: errorAppts } = useQuery({
    queryKey: ["dashboard-appointments", clinic?.id, professionalId],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("id, client_name, scheduled_at, status")
        .eq("barbershop_id", clinic.id)
        .gte("scheduled_at", monthStartIso);

      if (isProfessional && professionalId) {
        query = query.eq("barber_id", professionalId);
      }

      const { data, error } = await query.order("scheduled_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!clinic?.id,
    staleTime: 30 * 1000,
  });

  const { data: orders = [], isLoading: loadingOrders, isError: errorOrders } = useQuery({
    queryKey: ["dashboard-orders", clinic?.id, professionalId],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("barbershop_id", clinic.id)
        .eq("status", "closed")
        .gte("created_at", monthStartIso);

      if (isProfessional && professionalId) {
        query = query.eq("barber_id", professionalId);
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
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

    orders.forEach((order: any) => {
      const orderDate = toBRT(order.created_at);
      if (orderDate >= startMonth && orderDate <= endMonth) monthRevTotal += Number(order.total);
      if (isSameDay(startOfDay(orderDate), today)) todayRevTotal += Number(order.total);
    });

    // Gráfico de 7 dias
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const dayTarget = subDays(today, 6 - i);
      let dayRev = 0;
      orders.forEach((o: any) => {
        if (isSameDay(toBRT(o.created_at), dayTarget)) dayRev += Number(o.total);
      });
      return { day: format(dayTarget, "EEE", { locale: ptBR }).toUpperCase(), "Faturamento": dayRev };
    });

    const closedTodayCount = orders.filter(o => isSameDay(toBRT(o.created_at), today)).length;
    const ticketMedio = closedTodayCount > 0 ? todayRevTotal / closedTodayCount : 0;

    // Métricas Operacionais (Agendamentos)
    const todayAppointments = appointments.filter(a => isSameDay(toBRT(a.scheduled_at), today) && a.status !== 'cancelled');
    
    // Próximos Atendimentos (A partir de agora)
    const upcomingAppts = todayAppointments
      .filter(a => isAfter(new Date(a.scheduled_at), new Date()) && (a.status === 'scheduled' || a.status === 'confirmed'))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 5);

    return { 
      todayRevTotal, monthRevTotal, chartData, ticketMedio, 
      todayApptsCount: todayAppointments.length,
      upcomingAppts
    };
  }, [appointments, orders]);

  // --- RENDERING ---
  if (shopLoading || (loadingAppts && !appointments.length)) return <DashboardSkeleton />;
  if (!clinic) return null;

  if (errorAppts || errorOrders) {
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
          <div className="h-14 w-14 rounded-xl bg-card border border-border flex items-center justify-center overflow-hidden shadow-sm">
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
          <div key={i} className="rounded-xl bg-card border border-border p-5 shadow-sm transition-all hover:border-primary/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", kpi.bg, kpi.color)}>
                <kpi.icon className="h-4 w-4" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {kpi.isCurrency ? `R$ ${Number(kpi.value).toFixed(2)}` : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* PAINEL OPERACIONAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO (2/3 da tela) */}
        <div className="lg:col-span-2 rounded-xl bg-card border border-border p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-base font-bold text-foreground">Receita Semanal</h2>
            <p className="text-xs text-muted-foreground">Últimos 7 dias de faturamento</p>
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

        {/* PRÓXIMOS ATENDIMENTOS (1/3 da tela) */}
        <div className="rounded-xl bg-card border border-border p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-foreground">Próximos Atendimentos</h2>
              <p className="text-xs text-muted-foreground">Quem chega em seguida hoje</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => navigate("/dashboard/agenda")}>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 space-y-4">
            {kpis.upcomingAppts.length > 0 ? (
              kpis.upcomingAppts.map((appt: any) => (
                <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/80 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{appt.client_name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      {format(new Date(appt.scheduled_at), "HH:mm")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">Agenda livre</p>
                <p className="text-xs text-muted-foreground">Nenhum atendimento pendente para hoje.</p>
              </div>
            )}
          </div>
          <Button variant="outline" className="w-full mt-4 text-xs font-semibold" onClick={() => navigate("/dashboard/agenda")}>
            Abrir Agenda Completa
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;