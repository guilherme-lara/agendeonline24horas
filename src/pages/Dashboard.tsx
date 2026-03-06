import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, Loader2, TrendingUp, Clock, Users,
  AlertTriangle, Building2, Bell, RefreshCw, Scissors, Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { format, subDays, parseISO, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
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

  // --- SISTEMA 100% LIVE (WebSockets) ---
  useEffect(() => {
    if (!barbershop?.id) return;

    const channel = supabase
      .channel('live-dashboard')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'appointments', 
          filter: `barbershop_id=eq.${barbershop.id}` 
        },
        () => {
          // Atualiza as queries do dashboard e da agenda sem piscar a tela
          queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders', 
          filter: `barbershop_id=eq.${barbershop.id}` 
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbershop?.id, queryClient]);

  const { data: appointments = [], isLoading: loadingAppts, isError: errorAppts } = useQuery({
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
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["dashboard-orders", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, total, items, payment_method, status")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "closed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
  });

  const { data: announcement = "" } = useQuery({
    queryKey: ["system-announcement"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "announcement").maybeSingle();
      return (data as any)?.value || "";
    },
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (shopLoading) return;
    const isImpersonating = !!localStorage.getItem("impersonate_barbershop_id");
    if (barbershop && barbershop.id) {
      if (barbershop.setup_completed === false && !isImpersonating) {
        navigate("/onboarding");
      }
    }
  }, [barbershop, shopLoading, navigate]);

  const kpis = useMemo(() => {
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const endOfCurrentMonth = endOfMonth(today);
    const activeAppts = appointments.filter((a: any) => a.status !== "cancelled");
    const todayAppts = activeAppts.filter((a: any) => isSameDay(parseISO(a.scheduled_at), today));

    let todayRevServices = 0;
    let todayRevProducts = 0;
    let monthRevTotal = 0;

    orders.forEach((order: any) => {
      const orderDate = parseISO(order.created_at);
      if (orderDate >= startOfCurrentMonth && orderDate <= endOfCurrentMonth) {
        monthRevTotal += Number(order.total);
      }
      if (isSameDay(orderDate, today)) {
        (order.items || []).forEach((item: any) => {
          const itemTotal = Number(item.price) * Number(item.qty);
          if (item.type === "product") todayRevProducts += itemTotal;
          else todayRevServices += itemTotal;
        });
      }
    });

    const todayRevTotal = todayRevServices + todayRevProducts;

    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const thisDay = subDays(today, 6 - i);
      let dayServs = 0;
      let dayProds = 0;
      orders.forEach((order: any) => {
        if (isSameDay(parseISO(order.created_at), thisDay)) {
          (order.items || []).forEach((item: any) => {
            const itemTotal = Number(item.price) * Number(item.qty);
            if (item.type === "product") dayProds += itemTotal;
            else dayServs += itemTotal;
          });
        }
      });
      return { day: format(thisDay, "EEE", { locale: ptBR }).toUpperCase(), "Serviços": dayServs, "Produtos": dayProds };
    });

    const productSales: Record<string, number> = {};
    orders.filter((o: any) => parseISO(o.created_at) >= startOfCurrentMonth).forEach((order: any) => {
      (order.items || []).forEach((item: any) => {
        if (item.type === "product") {
          productSales[item.name] = (productSales[item.name] || 0) + Number(item.qty);
        }
      });
    });
    
    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, qty]) => ({ name, qty }));

    return { todayRevTotal, todayRevServices, todayRevProducts, monthRevTotal, todayCount: todayAppts.length, totalActive: activeAppts.length, chartData, topProducts };
  }, [appointments, orders]);

  if ((shopLoading && !barbershop) || (loadingAppts && !appointments.length && loadingOrders && !orders.length)) return <DashboardSkeleton />;

  if (errorAppts) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-bold text-foreground mb-2">Erro de conexão</h2>
      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] })} className="gold-gradient text-primary-foreground mt-4">
        <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
      </Button>
    </div>
  );

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <UpgradeModal open={upgradeModal.open} onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })} requiredPlan={upgradeModal.plan} featureName={upgradeModal.feature} />

      {isImpersonating && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 mb-8 flex justify-between items-center">
          <div className="flex items-center gap-3 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-bold uppercase tracking-tight">Suporte Admin: <span className="text-foreground">{barbershop.name}</span></p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { clearImpersonation(); navigate("/super-admin"); }} className="border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-white">Sair</Button>
        </div>
      )}

      {announcement && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mb-8 flex items-center gap-4">
          <Bell className="h-5 w-5 text-primary animate-bounce" />
          <p className="text-sm text-foreground font-medium italic">{announcement}</p>
        </div>
      )}

      <div className="mb-10 flex items-center gap-6">
        <div className="h-20 w-20 rounded-3xl bg-card border border-border flex items-center justify-center overflow-hidden shadow-card relative group">
          {barbershop.logo_url ? <img src={barbershop.logo_url} className="h-full w-full object-cover" /> : <Building2 className="h-10 w-10 text-muted-foreground" />}
        </div>
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight leading-none mb-2 font-display">{barbershop.name}</h1>
          <div className="flex items-center gap-3">
             <p className="text-muted-foreground text-sm font-bold uppercase tracking-tighter">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
             <span className="h-1 w-1 rounded-full bg-border" />
             <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-widest px-2">Plano {barbershop.plan_name || 'Essential'}</Badge>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { icon: DollarSign, color: "emerald", label: "Caixa", value: kpis.todayRevTotal, sub: "Receita Total Hoje" },
          { icon: Scissors, color: "blue", label: "Agenda", value: kpis.todayRevServices, sub: "Cortes / Serviços" },
          { icon: Package, color: "amber", label: "Estoque", value: kpis.todayRevProducts, sub: "Produtos Vendidos" },
          { icon: TrendingUp, color: "primary", label: "Acumulado", value: kpis.monthRevTotal, sub: "Faturamento do Mês" },
        ].map((kpi, i) => (
          <div key={i} className="group rounded-3xl border border-border bg-card p-6 hover:border-primary/30 transition-all shadow-card">
            <div className="flex justify-between items-start mb-4">
              <div className={`h-12 w-12 bg-${kpi.color === 'primary' ? 'primary' : kpi.color + '-500'}/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <kpi.icon className={`h-6 w-6 text-${kpi.color === 'primary' ? 'primary' : kpi.color + '-500'}`} />
              </div>
              <Badge className={`bg-${kpi.color === 'primary' ? 'primary' : kpi.color + '-500'}/10 text-${kpi.color === 'primary' ? 'primary' : kpi.color + '-500'} border-none font-black text-[9px] uppercase tracking-widest`}>{kpi.label}</Badge>
            </div>
            <p className="text-4xl font-black text-foreground mb-1 tracking-tighter">R$ {kpi.value.toFixed(2)}</p>
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO */}
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-8 shadow-card">
          <h2 className="text-xl font-black text-foreground mb-8 flex items-center gap-3 font-display">
            <div className="h-2 w-2 rounded-full bg-primary shadow-gold" />
            Evolução de Caixa (7 Dias)
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 800 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 800 }} tickFormatter={(val) => `R$${val}`} />
                <Tooltip 
                  cursor={{ fill: 'hsla(var(--foreground), 0.02)' }}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "16px" }}
                  itemStyle={{ fontWeight: 900 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800 }} />
                <Bar dataKey="Serviços" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 8, 8]} barSize={30} />
                <Bar dataKey="Produtos" stackId="a" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card flex items-center justify-between">
            <div>
               <p className="text-3xl font-black text-foreground tracking-tighter">{kpis.todayCount}</p>
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Clientes Hoje</p>
            </div>
            <Users className="h-10 w-10 text-primary/20" />
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
            <h3 className="text-sm font-black text-foreground mb-6 tracking-tight flex items-center gap-2 font-display">
              <Package className="h-4 w-4 text-amber-500" /> Top Produtos do Mês
            </h3>
            {kpis.topProducts.length > 0 ? (
              <div className="space-y-4">
                {kpis.topProducts.map((p, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <p className="text-xs font-bold text-foreground/80 truncate pr-4">{p.name}</p>
                    <Badge className="bg-amber-500/10 text-amber-500 border-none font-black text-[10px] shrink-0">
                      {p.qty} unid.
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest text-center py-4">Nenhuma venda registrada</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
