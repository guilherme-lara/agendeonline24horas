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

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-700">
      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })}
        requiredPlan={upgradeModal.plan}
        featureName={upgradeModal.feature}
      />
      <ExpirationBanner />
      {/* HEADER */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-xl bg-white border border-zinc-200 flex items-center justify-center overflow-hidden shadow-sm">
            {clinic.logo_url ? (
              <img
                src={clinic.logo_url}
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-8 w-8 text-zinc-400" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight font-display">
              {clinic.name}
            </h1>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mt-1">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <Badge className="bg-zinc-100 text-zinc-900 border-zinc-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Plano {clinic.plan_name || "Premium"}
        </Badge>
      </div>

      {/* KPIs GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          {
            icon: DollarSign,
            color: "zinc",
            label: "Caixa Hoje",
            value: kpis.todayRevTotal,
          },
          {
            icon: Scissors,
            color: "zinc",
            label: "Serviços",
            value: kpis.todayRevServices,
          },
          {
            icon: TrendingUp,
            color: "zinc",
            label: "Mês Atual",
            value: kpis.monthRevTotal,
          },
          {
            icon: Clock,
            color: "zinc",
            label: "Ticket Médio",
            value: kpis.ticketMedio,
          },
        ].map((kpi, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm hover:border-zinc-300 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="h-10 w-10 bg-zinc-50 rounded-lg flex items-center justify-center">
                <kpi.icon className="h-5 w-5 text-zinc-900" />
              </div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {kpi.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 tracking-tight">
              R$ {kpi.value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* GRÁFICO PRINCIPAL */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-200/60 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold flex items-center gap-3 font-display text-zinc-900">
                <div className="h-2 w-2 rounded-full bg-zinc-900" />
                Desempenho Semanal
              </h2>
              {lastUpdated && (
                <Badge className="bg-zinc-100 text-zinc-600 border-zinc-200 text-[9px] font-bold uppercase tracking-wider">
                  ⚡ Atualizado
                </Badge>
              )}
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                  tickFormatter={(v) => `R$${v}`}
                />
                <Tooltip
                  cursor={{ fill: "hsla(var(--foreground), 0.05)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderRadius: "20px",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar
                  dataKey="Serviços"
                  stackId="a"
                  fill="hsl(var(--primary))"
                  radius={[0, 0, 10, 10]}
                />
                <Bar
                  dataKey="Produtos"
                  stackId="a"
                  fill="hsl(var(--accent))"
                  radius={[10, 10, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TRANSAÇÕES RECENTES */}
        <div className="rounded-xl border border-zinc-200/60 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold mb-8 font-display flex items-center gap-2 text-zinc-900">
            <RefreshCw className="h-4 w-4 text-zinc-400" /> Atividade Live
          </h2>
          <div className="space-y-6">
            {kpis.lastTransactions.length > 0 ? (
              kpis.lastTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-zinc-50 flex items-center justify-center font-bold text-[10px] text-zinc-400 uppercase border border-zinc-100">
                      {tx.method?.slice(0, 2) || "PIX"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 truncate w-32">
                        {tx.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-semibold">
                        {tx.time}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-emerald-500">
                    R$ {tx.total.toFixed(2)}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Aguardando vendas...
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              onClick={() => navigate("/dashboard/caixa")}
            >
              Ver Extrato Completo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
