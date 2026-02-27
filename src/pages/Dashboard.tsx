import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, 
  Loader2, 
  TrendingUp, 
  Clock, 
  Users, 
  AlertTriangle, 
  Building2, 
  Bell,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { format, subDays, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge"; // <-- ADICIONE ESTA LINHA
import DashboardSkeleton from "@/components/DashboardSkeleton";
import UpgradeModal from "@/components/UpgradeModal";

interface Appointment {
  id: string;
  client_name: string;
  price: number;
  scheduled_at: string;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { barbershop, loading: shopLoading, user, clearImpersonation } = useBarbershop() as any;
  const { toast } = useToast();
  
  const [upgradeModal, setUpgradeModal] = useState({ open: false, plan: "", feature: "" });
  const isImpersonating = !!localStorage.getItem("impersonate_barbershop_id");

  // --- BUSCA DE AGENDAMENTOS (TANSTACK QUERY) ---
  const { data: appointments = [], isLoading: loadingAppts, isError: errorAppts } = useQuery({
    queryKey: ["dashboard-appointments", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, price, scheduled_at, status")
        .eq("barbershop_id", barbershop.id)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!barbershop?.id,
    refetchOnWindowFocus: true, // Auto-update ao voltar para a aba
  });

  // --- BUSCA DE ANÚNCIOS DO SISTEMA ---
  const { data: announcement = "" } = useQuery({
    queryKey: ["system-announcement"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "announcement")
        .maybeSingle();
      return (data as any)?.value || "";
    },
    staleTime: 1000 * 60 * 10, // Anúncio pode ser cacheado por 10 min
  });

  // --- LÓGICA DE REDIRECIONAMENTO (ONBOARDING) ---
  useEffect(() => {
    if (!shopLoading && barbershop && !barbershop.setup_completed) {
      navigate("/onboarding");
    }
  }, [barbershop, shopLoading, navigate]);

  // --- CÁLCULOS KPI (MEMOIZADOS PARA PERFORMANCE) ---
  const kpis = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const now = new Date();
    
    const active = appointments.filter((a) => a.status !== "cancelled");
    const todayAppts = active.filter((a) => a.scheduled_at.startsWith(todayStr));
    
    const todayRev = todayAppts
      .filter((a) => a.status === "completed")
      .reduce((sum, a) => sum + Number(a.price || 0), 0);

    const monthRev = active
      .filter((a) => {
        const d = parseISO(a.scheduled_at);
        return d >= startOfMonth(now) && d <= endOfMonth(now) && a.status === "completed";
      })
      .reduce((sum, a) => sum + Number(a.price || 0), 0);

    return {
      todayRevenue: todayRev,
      monthRevenue: monthRev,
      todayCount: todayAppts.length,
      totalActive: active.length,
      chartData: Array.from({ length: 7 }).map((_, i) => {
        const thisDay = subDays(new Date(), 6 - i);
        const dayStr = format(thisDay, "yyyy-MM-dd");
        return {
          day: format(thisDay, "EEE", { locale: ptBR }),
          "Receita": active
            .filter((a) => a.scheduled_at.startsWith(dayStr) && a.status === "completed")
            .reduce((s, a) => s + Number(a.price || 0), 0),
        };
      })
    };
  }, [appointments]);

  const stats = [
    { label: "Receita Hoje", value: `R$ ${kpis.todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Faturamento Mês", value: `R$ ${kpis.monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Clientes Hoje", value: kpis.todayCount, icon: Users, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Agendamentos Ativos", value: kpis.totalActive, icon: Clock, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ];

  // --- RENDERS DE PROTEÇÃO ---
  if (shopLoading || (loadingAppts && appointments.length === 0)) return <DashboardSkeleton />;

  if (errorAppts) return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Erro de conexão</h2>
      <p className="text-sm text-slate-400 mb-8 px-6">Não conseguimos atualizar seu painel agora.</p>
      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] })} className="gold-gradient px-8 font-bold">
        <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
      </Button>
    </div>
  );

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })}
        requiredPlan={upgradeModal.plan}
        featureName={upgradeModal.feature}
      />

      {/* MODO SUPORTE / IMPERSONATION */}
      {isImpersonating && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 mb-8 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-bold uppercase tracking-tight">Modo Visualização Admin: <span className="text-white ml-2">{barbershop.name}</span></p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { clearImpersonation(); navigate("/super-admin"); }} className="border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-white h-9 rounded-xl font-bold">
            Encerrar Suporte
          </Button>
        </div>
      )}

      {/* AVISOS DO SISTEMA */}
      {announcement && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/40 p-4 mb-8 flex items-center gap-4 shadow-lg shadow-cyan-900/10">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Bell className="h-5 w-5 text-cyan-400 animate-bounce" />
          </div>
          <p className="text-sm text-cyan-100 font-medium italic">{announcement}</p>
        </div>
      )}

      {/* HEADER DO DASHBOARD */}
      <div className="mb-10 flex items-center gap-6">
        <div className="h-20 w-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shadow-2xl relative group">
          {barbershop.logo_url ? (
            <img src={barbershop.logo_url} alt="Logo" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
          ) : (
            <Building2 className="h-10 w-10 text-slate-700" />
          )}
        </div>
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none mb-2">{barbershop.name}</h1>
          <div className="flex items-center gap-3">
             <p className="text-slate-500 text-sm font-bold uppercase tracking-tighter">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
             </p>
             <span className="h-1 w-1 rounded-full bg-slate-800" />
             <Badge className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20 text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
                Plano {barbershop.plan_name || 'Essential'}
             </Badge>
          </div>
        </div>
      </div>

      {/* GRID DE STATS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="group rounded-3xl border border-slate-800 bg-slate-900/40 p-6 hover:border-slate-700 transition-all shadow-xl backdrop-blur-sm">
            <div className={`h-12 w-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <p className="text-3xl font-black text-white mb-1 tracking-tighter">{stat.value}</p>
            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* GRÁFICO DE PERFORMANCE */}
      <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
            <TrendingUp className="h-32 w-32 text-cyan-500" />
        </div>
        
        <h2 className="text-xl font-bold text-white mb-10 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
          Faturamento da Semana
        </h2>

        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpis.chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.4} />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }} 
                dy={15} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }} 
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ 
                  backgroundColor: "#0b1224", 
                  border: "1px solid #1e293b", 
                  borderRadius: "20px",
                  boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)"
                }}
                itemStyle={{ color: "#06b6d4", fontWeight: 800 }}
              />
              <Bar 
                dataKey="Receita" 
                fill="#06b6d4" 
                radius={[8, 8, 8, 8]} 
                barSize={40} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
