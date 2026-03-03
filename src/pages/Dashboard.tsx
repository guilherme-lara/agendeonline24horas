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

  // --- BUSCA 1: AGENDAMENTOS (PARA CONTAGEM DE CLIENTES) ---
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
    refetchOnWindowFocus: true,
  });

  // --- BUSCA 2: COMANDAS PDV (PARA RECEITA REAL E PRODUTOS) ---
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
    refetchOnWindowFocus: true,
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
      // MÁGICA: Só redireciona se for estritamente false E não for o Super Admin
      if (barbershop.setup_completed === false && !isImpersonating) {
        navigate("/onboarding");
      }
    }
  }, [barbershop, shopLoading, navigate]);

  // --- MOTOR DE CÁLCULO DE KPIs ---
  const kpis = useMemo(() => {
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const endOfCurrentMonth = endOfMonth(today);

    // 1. Contagem de Clientes (Baseado nos agendamentos)
    const activeAppts = appointments.filter((a: any) => a.status !== "cancelled");
    const todayAppts = activeAppts.filter((a: any) => isSameDay(parseISO(a.scheduled_at), today));

    // 2. Receita (Baseado nas comandas fechadas)
    let todayRevServices = 0;
    let todayRevProducts = 0;
    let monthRevTotal = 0;

    orders.forEach((order: any) => {
      const orderDate = parseISO(order.created_at);
      
      // Receita Mensal
      if (orderDate >= startOfCurrentMonth && orderDate <= endOfCurrentMonth) {
        monthRevTotal += Number(order.total);
      }

      // Receita de Hoje (Separando o que é produto e o que é serviço)
      if (isSameDay(orderDate, today)) {
        (order.items || []).forEach((item: any) => {
          const itemTotal = Number(item.price) * Number(item.qty);
          if (item.type === "product") todayRevProducts += itemTotal;
          else todayRevServices += itemTotal;
        });
      }
    });

    const todayRevTotal = todayRevServices + todayRevProducts;

    // 3. Dados do Gráfico de Barras Duplas (7 Dias)
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

      return {
        day: format(thisDay, "EEE", { locale: ptBR }).toUpperCase(),
        "Serviços": dayServs,
        "Produtos": dayProds,
      };
    });

    // 4. Ranking de Produtos Mais Vendidos no Mês
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

    return {
      todayRevTotal,
      todayRevServices,
      todayRevProducts,
      monthRevTotal,
      todayCount: todayAppts.length,
      totalActive: activeAppts.length,
      chartData,
      topProducts
    };
  }, [appointments, orders]);

  // REGRA 2: Skeleton APENAS se é a primeira carga real E não temos dados no cache
  if ((shopLoading && !barbershop) || (loadingAppts && !appointments.length && loadingOrders && !orders.length)) return <DashboardSkeleton />;

  if (errorAppts) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Erro de conexão</h2>
      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] })} className="gold-gradient mt-4">
        <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
      </Button>
    </div>
  );

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <UpgradeModal open={upgradeModal.open} onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })} requiredPlan={upgradeModal.plan} featureName={upgradeModal.feature} />

      {isImpersonating && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 mb-8 flex justify-between items-center backdrop-blur-sm">
          <div className="flex items-center gap-3 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-bold uppercase tracking-tight">Suporte Admin: <span className="text-white">{barbershop.name}</span></p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { clearImpersonation(); navigate("/super-admin"); }} className="border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-white">Sair</Button>
        </div>
      )}

      {announcement && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/40 p-4 mb-8 flex items-center gap-4">
          <Bell className="h-5 w-5 text-cyan-400 animate-bounce" />
          <p className="text-sm text-cyan-100 font-medium italic">{announcement}</p>
        </div>
      )}

      <div className="mb-10 flex items-center gap-6">
        <div className="h-20 w-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shadow-2xl relative group">
          {barbershop.logo_url ? <img src={barbershop.logo_url} className="h-full w-full object-cover" /> : <Building2 className="h-10 w-10 text-slate-700" />}
        </div>
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none mb-2">{barbershop.name}</h1>
          <div className="flex items-center gap-3">
             <p className="text-slate-500 text-sm font-bold uppercase tracking-tighter">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
             <span className="h-1 w-1 rounded-full bg-slate-800" />
             <Badge className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20 text-[10px] font-black uppercase tracking-widest px-2">Plano {barbershop.plan_name || 'Essential'}</Badge>
          </div>
        </div>
      </div>

      {/* --- GRID DE KPIs FINANCEIROS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="group rounded-[2rem] border border-slate-800 bg-slate-900/40 p-6 hover:border-cyan-500/40 transition-all shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="h-12 w-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign className="h-6 w-6 text-emerald-400" />
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black text-[9px] uppercase tracking-widest">Caixa</Badge>
          </div>
          <p className="text-4xl font-black text-white mb-1 tracking-tighter">R$ {kpis.todayRevTotal.toFixed(2)}</p>
          <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Receita Total Hoje</p>
        </div>

        <div className="group rounded-[2rem] border border-slate-800 bg-slate-900/40 p-6 hover:border-cyan-500/40 transition-all shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="h-12 w-12 bg-blue-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Scissors className="h-6 w-6 text-blue-400" />
            </div>
            <Badge className="bg-blue-500/10 text-blue-400 border-none font-black text-[9px] uppercase tracking-widest">Agenda</Badge>
          </div>
          <p className="text-4xl font-black text-white mb-1 tracking-tighter">R$ {kpis.todayRevServices.toFixed(2)}</p>
          <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Cortes / Serviços</p>
        </div>

        <div className="group rounded-[2rem] border border-slate-800 bg-slate-900/40 p-6 hover:border-cyan-500/40 transition-all shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="h-12 w-12 bg-amber-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="h-6 w-6 text-amber-400" />
            </div>
            <Badge className="bg-amber-500/10 text-amber-400 border-none font-black text-[9px] uppercase tracking-widest">Estoque</Badge>
          </div>
          <p className="text-4xl font-black text-white mb-1 tracking-tighter">R$ {kpis.todayRevProducts.toFixed(2)}</p>
          <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Produtos Vendidos</p>
        </div>

        <div className="group rounded-[2rem] border border-slate-800 bg-slate-900/40 p-6 hover:border-cyan-500/40 transition-all shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="h-12 w-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="h-6 w-6 text-cyan-400" />
            </div>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-none font-black text-[9px] uppercase tracking-widest">Acumulado</Badge>
          </div>
          <p className="text-4xl font-black text-white mb-1 tracking-tighter">R$ {kpis.monthRevTotal.toFixed(2)}</p>
          <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Faturamento do Mês</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO DUPLO (SERVIÇOS X PRODUTOS) */}
        <div className="lg:col-span-2 rounded-[2.5rem] border border-slate-800 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-md">
          <h2 className="text-xl font-black text-white mb-8 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            Evolução de Caixa (Últimos 7 Dias)
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.4} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 800 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 800 }} tickFormatter={(val) => `R$${val}`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: "#0b1224", border: "1px solid #1e293b", borderRadius: "16px" }}
                  itemStyle={{ fontWeight: 900 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 800, color: '#64748b' }} />
                <Bar dataKey="Serviços" stackId="a" fill="#06b6d4" radius={[0, 0, 8, 8]} barSize={30} />
                <Bar dataKey="Produtos" stackId="a" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RANKING DE VENDAS E ESTATÍSTICAS */}
        <div className="space-y-6">
          <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-md flex items-center justify-between">
            <div>
               <p className="text-3xl font-black text-white tracking-tighter">{kpis.todayCount}</p>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Clientes Hoje</p>
            </div>
            <Users className="h-10 w-10 text-cyan-500/20" />
          </div>

          <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-md">
            <h3 className="text-sm font-black text-white mb-6 tracking-tight flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" /> Top Produtos do Mês
            </h3>
            {kpis.topProducts.length > 0 ? (
              <div className="space-y-4">
                {kpis.topProducts.map((p, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
                    <p className="text-xs font-bold text-slate-300 truncate pr-4">{p.name}</p>
                    <Badge className="bg-amber-500/10 text-amber-400 border-none font-black text-[10px] shrink-0">
                      {p.qty} unid.
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center py-4">Nenhuma venda registrada</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
