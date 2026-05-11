import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSoundFeedback } from "@/hooks/useSoundFeedback";
import {
  DollarSign, Loader2, TrendingUp, Clock, Users,
  AlertTriangle, Building2, Bell, RefreshCw, Scissors, Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  format, subDays, startOfMonth, endOfMonth, 
  isSameDay, startOfDay 
} from "date-fns";
import { toBRT } from "@/lib/timezone";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, Legend 
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import UpgradeModal from "@/components/UpgradeModal";
import ExpirationBanner from "@/components/ExpirationBanner";

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clinic, loading: shopLoading, clearImpersonation, professionalId } = useClinic() as any;
  const { isProfessional } = useAuth();
  const { toast } = useToast();
  
  const [upgradeModal, setUpgradeModal] = useState({ open: false, plan: "", feature: "" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isImpersonating = !!localStorage.getItem("impersonate_barbershop_id");
  const { playCaching } = useSoundFeedback();

  // Auto-hide "Atualizado Agora" badge after 5 seconds
  useEffect(() => {
    if (!lastUpdated) return;
    const timer = setTimeout(() => setLastUpdated(null), 5000);
    return () => clearTimeout(timer);
  }, [lastUpdated]);

  // Fuso horário centralizado em src/lib/timezone.ts

  // --- 2. SISTEMA REALTIME (WEB SOCKETS) ---
  useEffect(() => {
    if (!clinic?.id) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments', 
        filter: `barbershop_id=eq.${clinic.id}` 
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
        if (payload.eventType === "INSERT" || (payload.eventType === "UPDATE" && payload.new?.status === "confirmed")) {
          playCaching();
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders', 
        filter: `barbershop_id=eq.${clinic.id}` 
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        if (payload.eventType === "INSERT") {
          playCaching();
          setLastUpdated(new Date());
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinic?.id, queryClient]);

  // --- 3. QUERIES (BUSCA DE DADOS) ---
  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ["dashboard-appointments", clinic?.id, professionalId],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("id, client_name, scheduled_at, status")
        .eq("barbershop_id", clinic.id);
        
      if (isProfessional && professionalId) {
        query = query.eq("barber_id", professionalId);
      }
      
      const { data, error } = await query.order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clinic?.id,
    staleTime: 0, 
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["dashboard-orders", clinic?.id, professionalId],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("barbershop_id", clinic.id)
        .eq("status", "closed");

      if (isProfessional && professionalId) {
        query = query.eq("barber_id", professionalId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clinic?.id,
    staleTime: 0,
  });

  // --- 4. LÓGICA DE NEGÓCIO (CÁLCULO DE KPIs) ---
  const kpis = useMemo(() => {
    // Usa horário de Brasília como referência para "hoje" e "mês"
    const nowBrt = toBRT(new Date().toISOString());
    const today = startOfDay(nowBrt);
    const startMonth = startOfMonth(nowBrt);
    const endMonth = endOfMonth(nowBrt);

    let todayRevServices = 0;
    let todayRevProducts = 0;
    let monthRevTotal = 0;

    // Processamento de Ordens/Financeiro
    orders.forEach((order: any) => {
      const orderDate = toBRT(order.created_at);
      const orderDay = startOfDay(orderDate);

      // Faturamento Mensal
      if (orderDate >= startMonth && orderDate <= endMonth) {
        monthRevTotal += Number(order.total);
      }

      // Faturamento Diário (Comparando apenas a data, ignorando a hora)
      if (isSameDay(orderDay, today)) {
        (order.items || []).forEach((item: any) => {
          const itemTotal = Number(item.price) * Number(item.qty);
          if (item.type === "product") todayRevProducts += itemTotal;
          else todayRevServices += itemTotal;
        });
      }
    });

    const todayRevTotal = todayRevServices + todayRevProducts;

    // Dados do Gráfico (Últimos 7 dias)
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const dayTarget = subDays(today, 6 - i);
      let dayServs = 0;
      let dayProds = 0;

      orders.forEach((order: any) => {
        if (isSameDay(toBRT(order.created_at), dayTarget)) {
          (order.items || []).forEach((item: any) => {
            const val = Number(item.price) * Number(item.qty);
            item.type === "product" ? dayProds += val : dayServs += val;
          });
        }
      });

      return { 
        day: format(dayTarget, "EEE", { locale: ptBR }).toUpperCase(), 
        "Serviços": dayServs, 
        "Produtos": dayProds 
      };
    });

    // Top Produtos e Outros
    const closedTodayCount = orders.filter(o => isSameDay(toBRT(o.created_at), today)).length;
    const ticketMedio = closedTodayCount > 0 ? todayRevTotal / closedTodayCount : 0;

    const lastTransactions = orders.slice(0, 8).map(o => ({
      id: o.id,
      name: (o.items as any[])?.[0]?.name || "Venda",
      total: Number(o.total),
      time: format(toBRT(o.created_at), "HH:mm"),
      method: o.payment_method
    }));

    return { 
      todayRevTotal, todayRevServices, todayRevProducts, 
      monthRevTotal, chartData, ticketMedio, lastTransactions,
      todayApptsCount: appointments.filter(a => isSameDay(toBRT(a.scheduled_at), today) && a.status !== 'cancelled').length
    };
  }, [appointments, orders]);

  // --- RENDERING ---
  if (shopLoading || (loadingAppts && !appointments.length)) return <DashboardSkeleton />;
  if (!clinic) return null;

  const kpiCards = [
    { icon: DollarSign, label: "Caixa Hoje", value: kpis.todayRevTotal, gradient: "from-indigo-500 to-violet-600", glow: "shadow-indigo-500/30" },
    { icon: Scissors, label: "Serviços", value: kpis.todayRevServices, gradient: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
    { icon: TrendingUp, label: "Mês Atual", value: kpis.monthRevTotal, gradient: "from-amber-500 to-orange-600", glow: "shadow-amber-500/30" },
    { icon: Clock, label: "Ticket Médio", value: kpis.ticketMedio, gradient: "from-rose-500 to-pink-600", glow: "shadow-rose-500/30" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })}
        requiredPlan={upgradeModal.plan}
        featureName={upgradeModal.feature}
      />
      <ExpirationBanner />

      {/* HEADER */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center overflow-hidden elev-2">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">
              <span className="text-gradient-primary">{clinic.name}</span>
            </h1>
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mt-1.5">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="pill-success animate-in fade-in slide-in-from-right-2 duration-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Atualizado agora
            </span>
          )}
          <span className="pill-info">
            <Crown className="h-3 w-3" />
            Plano {clinic.plan_name || "Premium"}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {kpiCards.map((kpi, i) => (
          <div
            key={i}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-6 elev-1 lift hover:border-primary/40"
          >
            {/* gradient orb */}
            <div className={cn("absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40", kpi.gradient)} />
            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg", kpi.gradient, kpi.glow)}>
                  <kpi.icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {kpi.label}
                </span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground tracking-tight font-display">
                R$ {kpi.value.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART */}
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border/60 p-7 elev-1">
          <div className="flex items-center justify-between mb-7">
            <div>
              <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
                Desempenho Semanal
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Últimos 7 dias · Serviços + Produtos</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-primary" /> Serviços</span>
              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Produtos</span>
            </div>
          </div>
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="day" axisLine={false} tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    boxShadow: "var(--shadow-elev-3)",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Bar dataKey="Serviços" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 8, 8]} />
                <Bar dataKey="Produtos" stackId="a" fill="hsl(160 84% 39%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LIVE FEED */}
        <div className="rounded-2xl bg-card border border-border/60 p-7 elev-1">
          <h2 className="text-lg font-bold mb-6 font-display flex items-center gap-2 text-foreground">
            <RefreshCw className="h-4 w-4 text-primary" /> Atividade Live
          </h2>
          <div className="space-y-4">
            {kpis.lastTransactions.length > 0 ? (
              kpis.lastTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 -mx-2 rounded-xl hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center font-bold text-[10px] text-primary uppercase shrink-0">
                      {tx.method?.slice(0, 3) || "PIX"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{tx.name}</p>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{tx.time}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    +R$ {tx.total.toFixed(2)}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border">
                <Bell className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs font-semibold text-muted-foreground">Aguardando vendas...</p>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => navigate("/dashboard/caixa")}
            >
              Ver Extrato Completo →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
