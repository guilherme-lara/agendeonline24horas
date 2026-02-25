import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, Loader2, TrendingUp, Clock, Users, AlertTriangle, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";
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
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState("essential");
  const [systemAnnouncement, setSystemAnnouncement] = useState("");
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; plan: string; feature: string }>({ open: false, plan: "", feature: "" });
  const isImpersonating = !!localStorage.getItem("impersonate_barbershop_id");

  // Welcome toast (first login only)
  useEffect(() => {
    if (shopLoading || !barbershop) return;
    const key = `agendeonline_welcome_${barbershop.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      setTimeout(() => {
        toast({ title: "Bem-vindo ao AgendeOnline24horas! 🎉", description: `Seu plano atual é: ${planName.charAt(0).toUpperCase() + planName.slice(1)}` });
      }, 500);
    }
  }, [shopLoading, barbershop]);

  useEffect(() => {
    if (shopLoading) return;
    if (!user || !barbershop) return;
    if (!(barbershop as any).setup_completed) { navigate("/onboarding"); return; }

    const fetchData = async () => {
      const [apptRes, planRes, annRes] = await Promise.all([
        supabase.from("appointments").select("id, client_name, price, scheduled_at, status").eq("barbershop_id", barbershop.id).order("scheduled_at", { ascending: false }),
        supabase.from("saas_plans").select("plan_name").eq("barbershop_id", barbershop.id).eq("status", "active").maybeSingle(),
        supabase.from("system_settings").select("value").eq("key", "announcement").maybeSingle(),
      ]);
      setAppointments((apptRes.data as Appointment[]) || []);
      if (planRes.data) setPlanName(planRes.data.plan_name);
      if (annRes.data) setSystemAnnouncement((annRes.data as any).value || "");
      setLoading(false);
    };
    fetchData();
  }, [barbershop, shopLoading, user, navigate]);

  if (shopLoading || loading) return <DashboardSkeleton />;
  if (!barbershop) return null;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const now = new Date();
  const activeAppointments = appointments.filter((a) => a.status !== "cancelled");
  const todayAppointments = activeAppointments.filter((a) => a.scheduled_at.startsWith(todayStr));

  const monthRevenue = activeAppointments
    .filter((a) => {
      const d = new Date(a.scheduled_at);
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
    { label: "Receita Hoje", value: `R$ ${todayRevenue.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-green-400" },
    { label: "Receita do Mês", value: `R$ ${monthRevenue.toFixed(2).replace(".", ",")}`, icon: TrendingUp, color: "text-primary" },
    { label: "Clientes Hoje", value: todayAppointments.length, icon: Users, color: "text-primary" },
    { label: "Total Agendamentos", value: activeAppointments.length, icon: Clock, color: "text-primary" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })}
        requiredPlan={upgradeModal.plan}
        featureName={upgradeModal.feature}
      />

      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-cyan-400" />
            <p className="text-sm"><span className="font-semibold">Modo Suporte:</span> Visualizando como {barbershop.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { clearImpersonation(); navigate("/super-admin"); }} className="h-7 px-2">
            <X className="h-3.5 w-3.5 mr-1" /> Sair
          </Button>
        </div>
      )}

      {/* System Announcement */}
      {systemAnnouncement && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-sm text-primary">{systemAnnouncement}</p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-3">
          {(barbershop as any).logo_url && (
            <img src={(barbershop as any).logo_url} alt="Logo" className="h-10 w-10 rounded-full object-cover border border-border" />
          )}
          <div>
            <h1 className="font-display text-2xl font-bold">{barbershop.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · Plano {planName.charAt(0).toUpperCase() + planName.slice(1)}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm backdrop-blur-sm">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <p className="font-display text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly Chart */}
      <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm backdrop-blur-sm">
        <h2 className="font-display text-lg font-bold mb-4">Faturamento Semanal (Concluídos)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
            <Bar dataKey="Esta semana" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Semana anterior" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
