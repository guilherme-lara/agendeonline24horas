import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, Loader2, TrendingUp, Clock, Users,
  AlertTriangle, Building2, Bell, RefreshCw, Scissors, Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
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

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { barbershop, loading: shopLoading, clearImpersonation } = useBarbershop() as any;
  const { toast } = useToast();
  
  const [upgradeModal, setUpgradeModal] = useState({ open: false, plan: "", feature: "" });
  const isImpersonating = !!localStorage.getItem("impersonate_barbershop_id");

  // Fuso horário centralizado em src/lib/timezone.ts

  // --- 2. SISTEMA REALTIME (WEB SOCKETS) ---
  useEffect(() => {
    if (!barbershop?.id) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments', 
        filter: `barbershop_id=eq.${barbershop.id}` 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders', 
        filter: `barbershop_id=eq.${barbershop.id}` 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [barbershop?.id, queryClient]);

  // --- 3. QUERIES (BUSCA DE DADOS) ---
  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ["dashboard-appointments", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, scheduled_at, status")
        .eq("barbershop_id", barbershop.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
    staleTime: 0, 
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["dashboard-orders", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "closed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
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
  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-700">
      <UpgradeModal open={upgradeModal.open} onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })} requiredPlan={upgradeModal.plan} featureName={upgradeModal.feature} />

      {/* HEADER */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-3xl bg-card border border-border flex items-center justify-center overflow-hidden shadow-card ring-1 ring-primary/10">
            {barbershop.logo_url ? <img src={barbershop.logo_url} className="h-full w-full object-cover" /> : <Building2 className="h-10 w-10 text-muted-foreground" />}
          </div>
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tight font-display">{barbershop.name}</h1>
            <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest mt-1">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
          Plano {barbershop.plan_name || 'Premium'}
        </Badge>
      </div>

      {/* KPIs GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { icon: DollarSign, color: "emerald", label: "Caixa Hoje", value: kpis.todayRevTotal },
          { icon: Scissors, color: "blue", label: "Serviços", value: kpis.todayRevServices },
          { icon: TrendingUp, color: "primary", label: "Mês Atual", value: kpis.monthRevTotal },
          { icon: Clock, color: "violet", label: "Ticket Médio", value: kpis.ticketMedio },
        ].map((kpi, i) => (
          <div key={i} className="rounded-3xl border border-border bg-card p-6 shadow-card hover:border-primary/40 transition-all group">
            <div className="flex items-center gap-4 mb-4">
              <div className={`h-12 w-12 bg-${kpi.color === 'primary' ? 'primary' : kpi.color + '-500'}/10 rounded-2xl flex items-center justify-center`}>
                <kpi.icon className={`h-6 w-6 text-${kpi.color === 'primary' ? 'primary' : kpi.color + '-500'}`} />
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{kpi.label}</span>
            </div>
            <p className="text-3xl font-black text-foreground tracking-tighter">R$ {kpi.value.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* GRÁFICO PRINCIPAL */}
        <div className="lg:col-span-2 rounded-[2.5rem] border border-border bg-card p-8 shadow-card">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black flex items-center gap-3 font-display">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              Desempenho Semanal
            </h2>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 900 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 900 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  cursor={{ fill: 'hsla(var(--foreground), 0.05)' }}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "20px", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="Serviços" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 10, 10]} />
                <Bar dataKey="Produtos" stackId="a" fill="hsl(var(--accent))" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TRANSAÇÕES RECENTES */}
        <div className="rounded-[2.5rem] border border-border bg-card p-8 shadow-card">
          <h2 className="text-xl font-black mb-8 font-display flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" /> Atividade Live
          </h2>
          <div className="space-y-6">
            {kpis.lastTransactions.length > 0 ? kpis.lastTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center font-black text-xs text-muted-foreground uppercase">
                    {tx.method?.slice(0, 2) || 'PIX'}
                  </div>
                  <div>
                    <p className="text-xs font-black text-foreground truncate w-32">{tx.name}</p>
                    <p className="text-[10px] text-muted-foreground font-bold">{tx.time}</p>
                  </div>
                </div>
                <p className="text-sm font-black text-emerald-500">R$ {tx.total.toFixed(2)}</p>
              </div>
            )) : (
              <div className="text-center py-10">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Aguardando vendas...</p>
              </div>
            )}
            <Button variant="ghost" className="w-full rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5" onClick={() => navigate('/dashboard/caixa')}>
              Ver Extrato Completo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
