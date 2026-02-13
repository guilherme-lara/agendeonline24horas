import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, CalendarDays, Loader2, ExternalLink, TrendingUp,
  Search, Clock, Users, LayoutGrid, List, Crown, MessageSquare,
  QrCode, BarChart3, Package, Wallet, CalendarPlus, AlertTriangle, X,
  Check, XCircle, Play, Maximize, Minimize, Phone, CreditCard, Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, subDays, compareAsc, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "@/hooks/use-toast";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import CalendarView from "@/components/CalendarView";
import UpgradeModal from "@/components/UpgradeModal";
import TeamTab from "@/components/TeamTab";
import LogoUpload from "@/components/LogoUpload";
import InventoryTab from "@/components/InventoryTab";
import FinancialTab from "@/components/FinancialTab";
import QuickBooking from "@/components/QuickBooking";
import PaymentSettingsTab from "@/components/PaymentSettingsTab";
import CompletionModal from "@/components/CompletionModal";
import PixPaymentModal from "@/components/PixPaymentModal";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
  payment_method: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmado", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed: { label: "Concluído", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelado", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const paymentBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Aguardando", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  pending_local: { label: "Pagar no Local", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  awaiting: { label: "Pix Enviado", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  paid: { label: "Pago", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

type DashTab = "overview" | "team" | "financial" | "inventory" | "payments" | "settings";

const Dashboard = () => {
  const navigate = useNavigate();
  const { barbershop, loading: shopLoading, user, clearImpersonation } = useBarbershop();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [barberFilter, setBarberFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [planName, setPlanName] = useState("essential");
  const [activeTab, setActiveTab] = useState<DashTab>("overview");
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; plan: string; feature: string }>({
    open: false, plan: "", feature: "",
  });
  const [systemAnnouncement, setSystemAnnouncement] = useState("");
  const [kioskMode, setKioskMode] = useState(false);
  const [completionModal, setCompletionModal] = useState<{ open: boolean; appointmentId: string }>({ open: false, appointmentId: "" });
  const [pixModal, setPixModal] = useState<{ open: boolean; data: { paymentUrl: string; pixCode: string } | null; price: number; serviceName: string }>({ open: false, data: null, price: 0, serviceName: "" });
  const isImpersonating = !!localStorage.getItem("impersonate_barbershop_id");

  useEffect(() => {
    if (shopLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!barbershop) { navigate("/onboarding"); return; }
    if (!(barbershop as any).setup_completed) { navigate("/onboarding"); return; }

    const fetchData = async () => {
      const [apptRes, planRes, svcRes, annRes] = await Promise.all([
        supabase.from("appointments").select("*").eq("barbershop_id", barbershop.id).order("scheduled_at", { ascending: false }),
        supabase.from("saas_plans").select("plan_name").eq("barbershop_id", barbershop.id).eq("status", "active").maybeSingle(),
        supabase.from("services").select("id, name, price, duration").eq("barbershop_id", barbershop.id).eq("active", true).order("sort_order"),
        supabase.from("system_settings").select("value").eq("key", "announcement").maybeSingle(),
      ]);
      setAppointments((apptRes.data as Appointment[]) || []);
      setServices((svcRes.data as Service[]) || []);
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

  const nextClients = todayAppointments
    .filter((a) => new Date(a.scheduled_at) >= now)
    .sort((a, b) => compareAsc(new Date(a.scheduled_at), new Date(b.scheduled_at)))
    .slice(0, 5);

  const monthRevenue = activeAppointments
    .filter((a) => {
      const d = new Date(a.scheduled_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && a.status === "completed";
    })
    .reduce((sum, a) => sum + Number(a.price), 0);

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const thisDay = subDays(new Date(), 6 - i);
    const lastDay = subDays(thisDay, 7);
    const thisDayStr = format(thisDay, "yyyy-MM-dd");
    const lastDayStr = format(lastDay, "yyyy-MM-dd");
    return {
      day: format(thisDay, "EEE", { locale: ptBR }),
      "Esta semana": activeAppointments.filter((a) => a.scheduled_at.startsWith(thisDayStr) && a.status === "completed").reduce((s, a) => s + Number(a.price), 0),
      "Semana anterior": activeAppointments.filter((a) => a.scheduled_at.startsWith(lastDayStr) && a.status === "completed").reduce((s, a) => s + Number(a.price), 0),
    };
  });

  // Return prediction
  const clientVisits = new Map<string, Date[]>();
  activeAppointments.forEach((a) => {
    const dates = clientVisits.get(a.client_name) || [];
    dates.push(new Date(a.scheduled_at));
    clientVisits.set(a.client_name, dates);
  });

  const overdueClients: { name: string; daysSince: number; avgFreq: number }[] = [];
  clientVisits.forEach((dates, name) => {
    if (dates.length < 2) return;
    dates.sort((a, b) => a.getTime() - b.getTime());
    const gaps = dates.slice(1).map((d, i) => differenceInDays(d, dates[i]));
    const avgFreq = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
    const daysSince = differenceInDays(now, dates[dates.length - 1]);
    if (daysSince > avgFreq * 1.2 && avgFreq > 0) {
      overdueClients.push({ name, daysSince, avgFreq });
    }
  });
  overdueClients.sort((a, b) => b.daysSince - a.daysSince);

  const filteredAppointments = appointments
    .filter((a) => filter === "all" || a.status === filter)
    .filter((a) => !dateFilter || a.scheduled_at.startsWith(dateFilter))
    .filter((a) => !barberFilter || (a.barber_name || "").toLowerCase().includes(barberFilter.toLowerCase()))
    .filter((a) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return a.client_name.toLowerCase().includes(q) || (a.client_phone && a.client_phone.includes(q)) || a.service_name.toLowerCase().includes(q);
    });

  const stats = [
    { label: "Próximos Hoje", value: nextClients.length, icon: Clock, color: "text-primary" },
    { label: "Receita do Mês", value: `R$ ${monthRevenue.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-green-400" },
    { label: "Clientes Hoje", value: todayAppointments.length, icon: Users, color: "text-primary" },
    { label: "Total Geral", value: activeAppointments.length, icon: TrendingUp, color: "text-primary" },
  ];

  const openUpgrade = (plan: string, feature: string) => setUpgradeModal({ open: true, plan, feature });
  const refreshAppts = async () => {
    const { data } = await supabase.from("appointments").select("*").eq("barbershop_id", barbershop.id).order("scheduled_at", { ascending: false });
    setAppointments((data as Appointment[]) || []);
  };

  const handleStatusChange = async (apptId: string, newStatus: string) => {
    if (newStatus === "completed") {
      // Open completion modal for stock deduction
      setCompletionModal({ open: true, appointmentId: apptId });
      return;
    }
    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", apptId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status: ${statusLabels[newStatus]}` });
      refreshAppts();
    }
  };

  const handleMarkAsPaid = async (apptId: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", apptId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Marcado como Pago!", description: "Pagamento confirmado manualmente." });
      refreshAppts();
    }
  };

  const handleGeneratePix = async (appt: Appointment) => {
    toast({ title: "Gerando Pix...", description: "Aguarde a geração do QR Code." });
    try {
      const pixRes = await supabase.functions.invoke("create-pix-charge", {
        body: {
          appointment_id: appt.id,
          barbershop_id: barbershop.id,
        },
      });
      if (pixRes.data?.success && pixRes.data?.payment_url) {
        setPixModal({
          open: true,
          data: {
            paymentUrl: pixRes.data.payment_url,
            pixCode: pixRes.data.pix_code || "",
          },
          price: Number(appt.price),
          serviceName: appt.service_name,
        });
      } else {
        toast({ title: "Erro", description: pixRes.data?.error || "Não foi possível gerar o Pix. Verifique a chave AbacatePay.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao gerar Pix", variant: "destructive" });
    }
  };

  const openWhatsApp = (phone: string, clientName: string) => {
    const msg = encodeURIComponent(`Olá ${clientName}! 😊 Obrigado por agendar na ${barbershop.name}. Até breve!`);
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  const handleReschedule = (clientName: string, days: number) => {
    const futureDate = addDays(new Date(), days);
    const slug = barbershop.slug;
    toast({
      title: "Reagendamento sugerido",
      description: `Sugerido para ${format(futureDate, "dd/MM/yyyy")}. Envie o link ao cliente.`,
    });
    navigator.clipboard.writeText(`${window.location.origin}/agendamentos/${slug}`);
  };

  const tabs: { id: DashTab; label: string; icon: any; minPlan?: string }[] = [
    { id: "overview", label: "Visão Geral", icon: LayoutGrid },
    { id: "team", label: "Equipe", icon: Users },
    { id: "financial", label: "Financeiro", icon: Wallet, minPlan: "growth" },
    { id: "payments", label: "Pagamentos", icon: QrCode, minPlan: "growth" },
    { id: "inventory", label: "Estoque", icon: Package, minPlan: "pro" },
    { id: "settings", label: "Config", icon: CalendarDays },
  ];

  const planOrder = ["essential", "growth", "pro"];
  const canAccess = (minPlan?: string) => {
    if (!minPlan) return true;
    return planOrder.indexOf(planName) >= planOrder.indexOf(minPlan);
  };

  const handleTabClick = (tab: typeof tabs[0]) => {
    if (!canAccess(tab.minPlan)) {
      openUpgrade(tab.minPlan === "growth" ? "Growth" : "Pro", tab.label);
      return;
    }
    setActiveTab(tab.id);
  };

  return (
    <div className={`${kioskMode ? "fixed inset-0 z-50 bg-background overflow-auto" : "container max-w-5xl py-8"} animate-fade-in`}>
      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, plan: "", feature: "" })}
        requiredPlan={upgradeModal.plan}
        featureName={upgradeModal.feature}
      />

      <CompletionModal
        open={completionModal.open}
        onClose={() => setCompletionModal({ open: false, appointmentId: "" })}
        barbershopId={barbershop.id}
        appointmentId={completionModal.appointmentId}
        onCompleted={refreshAppts}
      />

      {/* Pix Modal for Dashboard */}
      {pixModal.data && (
        <PixPaymentModal
          open={pixModal.open}
          onClose={() => setPixModal({ open: false, data: null, price: 0, serviceName: "" })}
          paymentUrl={pixModal.data.paymentUrl}
          pixCode={pixModal.data.pixCode}
          price={pixModal.price}
          serviceName={pixModal.serviceName}
        />
      )}

      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-cyan-400" />
            <p className="text-sm text-cyan-300">
              <span className="font-semibold">Modo Suporte:</span> Visualizando como {barbershop.name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { clearImpersonation(); navigate("/super-admin"); }}
            className="text-cyan-400 hover:text-white hover:bg-cyan-500/20 h-7 px-2"
          >
            <X className="h-3.5 w-3.5 mr-1" /> Sair
          </Button>
        </div>
      )}

      {/* System Announcement */}
      {systemAnnouncement && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-sm text-primary">{systemAnnouncement}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          {(barbershop as any).logo_url && (
            <img src={(barbershop as any).logo_url} alt="Logo" className="h-10 w-10 rounded-full object-cover border border-border" />
          )}
          <div>
            <h1 className="font-display text-2xl font-bold">{barbershop.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKioskMode(!kioskMode)}
            title={kioskMode ? "Sair do Modo Quiosque" : "Modo Quiosque"}
          >
            {kioskMode ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </Button>
          <QuickBooking barbershopId={barbershop.id} services={services} onBooked={refreshAppts} />
          <Button variant="outline" size="sm" onClick={() => window.open(`/agendamentos/${barbershop.slug}`, "_blank")}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Link
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary mt-6 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? "gold-gradient text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.minPlan && !canAccess(tab.minPlan) && <Crown className="h-3 w-3 ml-0.5" />}
          </button>
        ))}
      </div>

      {/* === OVERVIEW TAB === */}
      {activeTab === "overview" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <p className="font-display text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Next Clients */}
          {nextClients.length > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 mb-8">
              <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Próximos Clientes
              </h2>
              <div className="space-y-2">
                {nextClients.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md bg-card border border-border px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{a.client_name}</p>
                      <p className="text-xs text-muted-foreground">{a.service_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{format(new Date(a.scheduled_at), "HH:mm")}</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(a.price).toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Return Prediction */}
          {overdueClients.length > 0 && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-5 mb-8">
              <h2 className="font-display text-base font-bold mb-3 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-yellow-400" /> Clientes Atrasados para Retorno
              </h2>
              <div className="space-y-2">
                {overdueClients.slice(0, 5).map((c) => (
                  <div key={c.name} className="flex items-center justify-between rounded-md bg-card border border-border px-4 py-2">
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.daysSince} dias sem visita (média: {c.avgFreq}d)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly Chart */}
          <div className="rounded-lg border border-border bg-card p-6 mb-8">
            <h2 className="font-display text-lg font-bold mb-4">Faturamento Semanal (Concluídos)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 20%)" />
                <XAxis dataKey="day" tick={{ fill: "hsl(220 10% 55%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(220 10% 55%)", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 11%)", border: "1px solid hsl(220 12% 20%)", borderRadius: "8px", color: "hsl(40 10% 95%)" }} />
                <Bar dataKey="Esta semana" fill="hsl(40 92% 52%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Semana anterior" fill="hsl(220 15% 30%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* View Toggle */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Agendamentos</h2>
            <div className="flex gap-1 p-1 rounded-lg bg-secondary">
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "gold-gradient text-primary-foreground" : "text-muted-foreground"}`}>
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("calendar")} className={`p-1.5 rounded-md transition-all ${viewMode === "calendar" ? "gold-gradient text-primary-foreground" : "text-muted-foreground"}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          {viewMode === "calendar" ? (
            <CalendarView appointments={appointments} />
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, telefone, serviço..." className="bg-card border-border pl-10" />
                </div>
                <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-card border-border w-auto" />
                <Input value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)} placeholder="Barbeiro" className="bg-card border-border w-32" />
              </div>

              <div className="flex gap-1 mb-4 p-1 rounded-lg bg-secondary overflow-x-auto">
                {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                      filter === s ? "gold-gradient text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"
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
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Barbeiro</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data/Hora</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Valor</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Pagamento</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAppointments.map((a) => {
                          const badge = statusBadgeConfig[a.status] || statusBadgeConfig.pending;
                          const payBadge = paymentBadgeConfig[a.payment_status] || paymentBadgeConfig.pending;
                          return (
                            <tr key={a.id} className="border-t border-border">
                              <td className="px-4 py-3">
                                <p className="font-medium">{a.client_name}</p>
                                <p className="text-xs text-muted-foreground">{a.client_phone}</p>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{a.service_name}</td>
                              <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{a.barber_name || "—"}</td>
                              <td className="px-4 py-3 text-muted-foreground">{format(new Date(a.scheduled_at), "dd/MM HH:mm")}</td>
                              <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">R$ {Number(a.price).toFixed(2).replace(".", ",")}</td>
                              <td className="px-4 py-3">
                                <Badge className={`${badge.className} text-xs`}>{badge.label}</Badge>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <Badge className={`${payBadge.className} text-xs`}>{payBadge.label}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                      Ações
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-card border-border">
                                    {a.status === "pending" && (
                                      <DropdownMenuItem onClick={() => handleStatusChange(a.id, "confirmed")}>
                                        <Check className="h-3.5 w-3.5 mr-2 text-blue-400" /> Confirmar
                                      </DropdownMenuItem>
                                    )}
                                    {(a.status === "pending" || a.status === "confirmed") && (
                                      <DropdownMenuItem onClick={() => handleStatusChange(a.id, "completed")}>
                                        <Play className="h-3.5 w-3.5 mr-2 text-green-400" /> Concluir
                                      </DropdownMenuItem>
                                    )}
                                    {a.status !== "cancelled" && a.status !== "completed" && (
                                      <DropdownMenuItem onClick={() => handleStatusChange(a.id, "cancelled")} className="text-destructive">
                                        <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    {/* Payment actions */}
                                    {a.payment_status !== "paid" && a.status !== "cancelled" && (
                                      <DropdownMenuItem onClick={() => handleMarkAsPaid(a.id)}>
                                        <Banknote className="h-3.5 w-3.5 mr-2 text-green-400" /> Marcar como Pago
                                      </DropdownMenuItem>
                                    )}
                                    {a.payment_status !== "paid" && a.status !== "cancelled" && (
                                      <DropdownMenuItem onClick={() => handleGeneratePix(a)}>
                                        <QrCode className="h-3.5 w-3.5 mr-2 text-primary" /> Gerar Pix Agora
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    {a.client_phone && (
                                      <DropdownMenuItem onClick={() => openWhatsApp(a.client_phone, a.client_name)}>
                                        <Phone className="h-3.5 w-3.5 mr-2 text-green-500" /> WhatsApp
                                      </DropdownMenuItem>
                                    )}
                                    {a.status === "completed" && (
                                      <>
                                        <DropdownMenuItem onClick={() => handleReschedule(a.client_name, 15)}>
                                          <CalendarPlus className="h-3.5 w-3.5 mr-2 text-primary" /> Agendar em 15 dias
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleReschedule(a.client_name, 30)}>
                                          <CalendarPlus className="h-3.5 w-3.5 mr-2 text-primary" /> Agendar em 30 dias
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* === TEAM TAB === */}
      {activeTab === "team" && (
        <TeamTab barbershopId={barbershop.id} planName={planName} />
      )}

      {/* === FINANCIAL TAB === */}
      {activeTab === "financial" && canAccess("growth") && (
        <FinancialTab barbershopId={barbershop.id} />
      )}

      {/* === PAYMENTS TAB === */}
      {activeTab === "payments" && canAccess("growth") && (
        <PaymentSettingsTab barbershopId={barbershop.id} />
      )}

      {/* === INVENTORY TAB === */}
      {activeTab === "inventory" && canAccess("pro") && (
        <InventoryTab barbershopId={barbershop.id} />
      )}

      {/* === SETTINGS TAB === */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <LogoUpload
            barbershopId={barbershop.id}
            currentUrl={(barbershop as any).logo_url || ""}
            onUploaded={() => {}}
          />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
