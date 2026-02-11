import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Users, CalendarDays, Loader2, LogOut, Plus, ExternalLink, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  barber_name: string;
  price: number;
  scheduled_at: string;
  status: string;
  payment_status: string;
}

const statusColors: Record<string, string> = {
  pending: "text-yellow-400",
  confirmed: "text-primary",
  completed: "text-green-400",
  cancelled: "text-destructive",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { barbershop, loading: shopLoading, user } = useBarbershop();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (shopLoading) return;
    if (!user) { navigate("/login"); return; }
    if (!barbershop) { navigate("/onboarding"); return; }

    supabase
      .from("appointments")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("scheduled_at", { ascending: false })
      .then(({ data }) => {
        setAppointments((data as Appointment[]) || []);
        setLoading(false);
      });
  }, [barbershop, shopLoading, user, navigate]);

  if (shopLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!barbershop) return null;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayAppointments = appointments.filter((a) => a.scheduled_at.startsWith(todayStr));
  const activeAppointments = appointments.filter((a) => a.status !== "cancelled");
  const monthRevenue = activeAppointments
    .filter((a) => {
      const d = new Date(a.scheduled_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, a) => sum + Number(a.price), 0);

  // Chart data: last 7 days
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayAppts = activeAppointments.filter((a) => a.scheduled_at.startsWith(dateStr));
    return {
      day: format(date, "dd/MM"),
      cortes: dayAppts.length,
      receita: dayAppts.reduce((s, a) => s + Number(a.price), 0),
    };
  });

  const filteredAppointments = filter === "all" ? appointments : appointments.filter((a) => a.status === filter);

  const stats = [
    { label: "Hoje", value: todayAppointments.length, icon: CalendarDays, color: "text-primary" },
    { label: "Receita do Mês", value: `R$ ${monthRevenue.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-green-400" },
    { label: "Total Agendamentos", value: activeAppointments.length, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="container max-w-5xl py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="font-display text-2xl font-bold">{barbershop.name}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/book/${barbershop.slug}`, "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Meu Link
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <p className="font-display text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-6 mb-8">
        <h2 className="font-display text-lg font-bold mb-4">Últimos 7 dias</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 20%)" />
            <XAxis dataKey="day" tick={{ fill: "hsl(220 10% 55%)", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(220 10% 55%)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220 18% 11%)",
                border: "1px solid hsl(220 12% 20%)",
                borderRadius: "8px",
                color: "hsl(40 10% 95%)",
              }}
            />
            <Bar dataKey="receita" fill="hsl(40 92% 52%)" radius={[4, 4, 0, 0]} name="Receita (R$)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Appointments */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold">Agendamentos</h2>
      </div>

      <div className="flex gap-1 mb-4 p-1 rounded-lg bg-secondary overflow-x-auto">
        {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              filter === s
                ? "gold-gradient text-primary-foreground shadow-gold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "Todos" : statusLabels[s] || s}
          </button>
        ))}
      </div>

      {filteredAppointments.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-10">Nenhum agendamento encontrado.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Serviço</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data/Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.client_name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{a.service_name}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{a.service_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(a.scheduled_at), "dd/MM HH:mm")}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      R$ {Number(a.price).toFixed(2).replace(".", ",")}
                    </td>
                    <td className={`px-4 py-3 font-medium ${statusColors[a.status] || ""}`}>
                      {statusLabels[a.status] || a.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
