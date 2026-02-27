import {
  DollarSign, Loader2, TrendingUp, Clock, Users, AlertTriangle, X, Building2, Bell // <-- Adicione Building2 e Bell aqui
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, Loader2, TrendingUp, Clock, Users, AlertTriangle, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "@/hooks/use-toast";
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
  const { barbershop, loading: shopLoading, user, clearImpersonation } = useBarbershop();
  const { toast } = useToast();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(false);
  const [systemAnnouncement, setSystemAnnouncement] = useState("");
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; plan: string; feature: string }>({ open: false, plan: "", feature: "" });
  
  const isImpersonating = !!localStorage.getItem("impersonate_barbershop_id");

  // O plano agora vem direto do hook useBarbershop para ser INSTANTÂNEO após o Super Admin alterar
  const currentPlan = useMemo(() => {
    return (barbershop as any)?.plan_name || "essential";
  }, [barbershop]);

  const fetchDashboardData = useCallback(async () => {
    if (!user || !barbershop?.id) return;
    
    // Não resetamos o loading se já tivermos dados (evita o "pisca-pisca" das abas)
    if (appointments.length === 0) setLoadingData(true);
    setError(false);

    try {
      const [apptRes, annRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, client_name, price, scheduled_at, status")
          .eq("barbershop_id", barbershop.id)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("system_settings")
          .select("value")
          .eq("key", "announcement")
          .maybeSingle(),
      ]);

      if (apptRes.error) throw apptRes.error;
      
      setAppointments((apptRes.data as Appointment[]) || []);
      if (annRes.data) setSystemAnnouncement((annRes.data as any).value || "");

    } catch (err) {
      console.error("Erro Dashboard:", err);
      setError(true);
    } finally {
      setLoadingData(false);
    }
  }, [barbershop?.id, user, appointments.length]);

  useEffect(() => {
    if (shopLoading) return;
    if (!user || !barbershop) return;
    if (!(barbershop as any).setup_completed) { navigate("/onboarding"); return; }

    fetchDashboardData();
  }, [barbershop, shopLoading, user, navigate, fetchDashboardData]);

  // Lógica de boas-vindas
  useEffect(() => {
    if (shopLoading || !barbershop) return;
    const key = `welcome_${barbershop.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      toast({ 
        title: `Olá, ${barbershop.name}! ✂️`, 
        description: `Você está no plano ${currentPlan.toUpperCase()}.` 
      });
    }
  }, [shopLoading, barbershop, currentPlan, toast]);

  // --- RENDERS DE PROTEÇÃO ---
  // Só mostramos o Skeleton se for a PRIMEIRA carga absoluta.
  if (shopLoading || (loadingData && appointments.length === 0 && !error)) {
    return <DashboardSkeleton />;
  }

  if (error && appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center p-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-white">Conexão instável</h2>
        <p className="text-sm text-slate-400 mb-8 text-balance">Não conseguimos sincronizar seus agendamentos agora.</p>
        <Button onClick={fetchDashboardData} className="bg-cyan-600 hover:bg-cyan-500 font-bold px-10">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  // --- CÁLCULOS DE KPI (Memoizados para performance) ---
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const activeAppointments = appointments.filter((a) => a.status !== "cancelled");
  const todayAppointments = activeAppointments.filter((a) => a.scheduled_at.startsWith(todayStr));

  const monthRevenue = activeAppointments
    .filter((a) => {
      const d = parseISO(a.scheduled_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && a.status === "completed";
    })
    .reduce((sum, a) => sum + Number(a.price || 0), 0);

  const todayRevenue = todayAppointments
    .filter((a) => a.status === "completed")
    .reduce((sum, a) => sum + Number(a.price || 0), 0);

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const thisDay = subDays(new Date(), 6 - i);
    const lastDay = subDays(thisDay, 7);
    const thisDayStr = format(thisDay, "yyyy-MM-dd");
    const lastDayStr = format(lastDay, "yyyy-MM-dd");
    return {
      day: format(thisDay, "EEE", { locale: ptBR }),
      "Esta semana": activeAppointments.filter((a) => a.scheduled_at.startsWith(thisDayStr) && a.status === "completed").reduce((s, a) => s + Number(a.price || 0), 0),
      "Semana anterior": activeAppointments.filter((a) => a.scheduled_at.startsWith(lastDayStr) && a.status === "completed").reduce((s, a) => s + Number(a.price || 0), 0),
    };
  });

  const stats = [
    { label: "Receita Hoje", value: `R$ ${todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-emerald-400" },
    { label: "Receita do Mês", value: `R$ ${monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-cyan-400" },
    { label: "Clientes Hoje", value: todayAppointments.length, icon: Users, color: "text-cyan-400" },
    { label: "Total Agendamentos", value: activeAppointments.length, icon: Clock, color: "text-cyan-400" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })}
        requiredPlan={upgradeModal.plan}
        featureName={upgradeModal.feature}
      />

      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-white"><span className="font-bold">MODO ADMIN:</span> Gerenciando {barbershop.name}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { clearImpersonation(); navigate("/super-admin"); }} className="border-amber-500/50 hover:bg-amber-500/20 h-8 text-xs text-amber-500">
            Sair do Modo Suporte
          </Button>
        </div>
      )}

      {/* System Announcement */}
      {systemAnnouncement && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-3 mb-6 flex items-center gap-3">
          <Bell className="h-4 w-4 text-cyan-400 animate-pulse" />
          <p className="text-sm text-cyan-100 italic">{systemAnnouncement}</p>
        </div>
      )}

      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shadow-xl">
            {(barbershop as any).logo_url ? (
              <img src={(barbershop as any).logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-slate-600" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">{barbershop.name}</h1>
            <p className="text-slate-500 text-sm font-medium">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} &bull; 
              <span className="ml-1 text-cyan-500 uppercase text-[10px] font-bold tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                Plano {currentPlan}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition-all hover:border-slate-700 hover:bg-slate-900/60 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div className="h-1 w-8 bg-slate-800 rounded-full group-hover:bg-cyan-500/30 transition-colors" />
            </div>
            <p className="text-2xl font-black text-white mb-1 tracking-tight">{stat.value}</p>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly Chart */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" /> Performance de Vendas
          </h2>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
              <div className="h-2 w-2 rounded-full bg-cyan-500" /> Esta semana
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
              <div className="h-2 w-2 rounded-full bg-slate-700" /> Semana passada
            </div>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)" }} 
              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
            />
            <Bar dataKey="Esta semana" fill="#06b6d4" radius={[6, 6, 0, 0]} barSize={32} />
            <Bar dataKey="Semana anterior" fill="#334155" radius={[6, 6, 0, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
