import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, DollarSign, CalendarDays, Loader2, LogOut,
  Eye, Ban, ChevronDown, Search, Filter, Bell, Activity,
  UserCog, ArrowUpDown, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BarbershopRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

interface SaasPlan {
  id: string;
  barbershop_id: string;
  plan_name: string;
  status: string;
  price: number;
  expires_at: string | null;
  started_at: string;
}

interface Appointment {
  id: string;
  barbershop_id: string;
  client_name: string;
  service_name: string;
  price: number;
  scheduled_at: string;
  status: string;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  details: string;
  created_at: string;
}

const planPrices: Record<string, number> = {
  essential: 97,
  growth: 197,
  pro: 397,
};

const planColors: Record<string, string> = {
  essential: "text-slate-300",
  growth: "text-cyan-400",
  pro: "text-amber-400",
};

const statusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">Ativo</Badge>;
    case "overdue":
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30">Atrasado</Badge>;
    case "inactive":
    case "suspended":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">Inativo</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const SkeletonTable = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex gap-4 items-center">
        <Skeleton className="h-5 flex-1 bg-slate-800" />
        <Skeleton className="h-5 w-24 bg-slate-800" />
        <Skeleton className="h-5 w-20 bg-slate-800" />
        <Skeleton className="h-5 w-16 bg-slate-800" />
      </div>
    ))}
  </div>
);

const SuperAdmin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const [shops, setShops] = useState<BarbershopRow[]>([]);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailShop, setDetailShop] = useState<BarbershopRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [announcement, setAnnouncement] = useState("");
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const addLog = async (action: string, details: string) => {
    const { data } = await supabase.from("activity_logs").insert({
      action, details, actor_id: user?.id,
    }).select().single();
    if (data) setLogs((prev) => [data as ActivityLog, ...prev]);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) return;

    Promise.all([
      supabase.from("barbershops").select("*").order("created_at", { ascending: false }),
      supabase.from("saas_plans").select("*"),
      supabase.from("appointments").select("*").order("created_at", { ascending: false }),
      supabase.rpc("admin_get_user_emails"),
      supabase.from("system_settings").select("*").eq("key", "announcement").maybeSingle(),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]).then(([shopsRes, plansRes, apptsRes, emailsRes, announcementRes, logsRes]) => {
      setShops((shopsRes.data as BarbershopRow[]) || []);
      setPlans((plansRes.data as SaasPlan[]) || []);
      setAppointments((apptsRes.data as Appointment[]) || []);
      setLogs((logsRes.data as ActivityLog[]) || []);

      // Map emails
      const emailMap: Record<string, string> = {};
      if (emailsRes.data) {
        (emailsRes.data as { user_id: string; email: string }[]).forEach((e) => {
          emailMap[e.user_id] = e.email;
        });
      }
      setEmails(emailMap);

      if (announcementRes.data) {
        setAnnouncement((announcementRes.data as any).value || "");
      }

      setLoading(false);
    });
  }, [user, authLoading, isAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1a" }}>
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    navigate("/auth");
    return null;
  }

  const activePlans = plans.filter((p) => p.status === "active");
  const mrr = activePlans.reduce((sum, p) => sum + Number(p.price), 0);
  const last24h = subHours(new Date(), 24).toISOString();
  const recentAppointments = appointments.filter((a) => a.created_at && a.created_at >= last24h);

  const getPlanForShop = (shopId: string) => plans.find((p) => p.barbershop_id === shopId);
  const getOwnerEmail = (ownerId: string) => emails[ownerId] || "—";

  const handleSuspend = async (shop: BarbershopRow) => {
    const plan = getPlanForShop(shop.id);
    if (!plan) return;
    const newStatus = plan.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("saas_plans").update({ status: newStatus }).eq("id", plan.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, status: newStatus } : p));
      toast({ title: newStatus === "active" ? "Acesso reativado" : "Acesso suspenso" });
      addLog(
        newStatus === "active" ? "Reativação" : "Suspensão",
        `${shop.name} (${shop.slug}) ${newStatus === "active" ? "reativada" : "suspensa"}`
      );
    }
  };

  const handleChangePlan = async (shop: BarbershopRow, newPlan: string) => {
    const plan = getPlanForShop(shop.id);
    if (!plan) return;
    const { error } = await supabase
      .from("saas_plans")
      .update({ plan_name: newPlan, price: planPrices[newPlan] || 97 })
      .eq("id", plan.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setPlans((prev) =>
        prev.map((p) => p.id === plan.id ? { ...p, plan_name: newPlan, price: planPrices[newPlan] || 97 } : p)
      );
      const label = newPlan.charAt(0).toUpperCase() + newPlan.slice(1);
      toast({ title: `Plano alterado para ${label}` });
      addLog("Alteração de Plano", `${shop.name} → ${label} (R$ ${planPrices[newPlan]})`);
    }
  };

  const handleImpersonate = (shop: BarbershopRow) => {
    localStorage.setItem("impersonate_barbershop_id", shop.id);
    toast({ title: "Modo Suporte", description: `Visualizando como ${shop.name}` });
    addLog("Impersonação", `Acessando dashboard de ${shop.name}`);
    navigate("/dashboard");
  };

  const saveAnnouncement = async () => {
    setAnnouncementSaving(true);
    const { data: existing } = await supabase
      .from("system_settings")
      .select("id")
      .eq("key", "announcement")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("system_settings")
        .update({ value: announcement, updated_at: new Date().toISOString() })
        .eq("key", "announcement");
    } else {
      await supabase
        .from("system_settings")
        .insert({ key: "announcement", value: announcement });
    }
    toast({ title: "Aviso salvo", description: "O aviso será exibido em todos os dashboards." });
    addLog("Aviso Global", announcement ? `Aviso definido: "${announcement.slice(0, 50)}..."` : "Aviso removido");
    setAnnouncementSaving(false);
  };

  const shopAppointments = (shopId: string) => appointments.filter((a) => a.barbershop_id === shopId);
  const shopRevenue = (shopId: string) =>
    shopAppointments(shopId)
      .filter((a) => a.status !== "cancelled")
      .reduce((s, a) => s + Number(a.price), 0);

  // Filtered shops
  const filteredShops = shops.filter((shop) => {
    const plan = getPlanForShop(shop.id);
    const matchSearch = !searchQuery ||
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getOwnerEmail(shop.owner_id).toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlan = planFilter === "all" || plan?.plan_name === planFilter;
    const matchStatus = statusFilter === "all" || plan?.status === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  const stats = [
    { label: "Total Barbearias", value: shops.length, icon: Building2, color: "text-cyan-400", bg: "bg-cyan-950/50 border-cyan-500/20" },
    { label: "Assinantes Ativos", value: activePlans.length, icon: Users, color: "text-emerald-400", bg: "bg-emerald-950/50 border-emerald-500/20" },
    { label: "MRR", value: `R$ ${mrr.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-violet-400", bg: "bg-violet-950/50 border-violet-500/20" },
    { label: "Agendamentos (24h)", value: recentAppointments.length, icon: CalendarDays, color: "text-amber-400", bg: "bg-amber-950/50 border-amber-500/20" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #060b18 0%, #0a1628 100%)" }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-medium">Command Center</p>
            </div>
            <h1 className="text-2xl font-bold text-white">Painel Master</h1>
            <p className="text-sm text-slate-500">
              {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogs(true)}
              className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
            >
              <Activity className="h-4 w-4 mr-1" /> Logs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg bg-slate-800/50" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {stats.map((stat) => (
                <div key={stat.label} className={`rounded-xl border p-5 backdrop-blur-sm ${stat.bg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* System Announcement */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-5 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-cyan-400">Aviso Global do Sistema</h3>
              </div>
              <Textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Digite um aviso que será exibido no dashboard de todas as barbearias..."
                className="bg-slate-900/50 border-slate-700 text-slate-200 placeholder:text-slate-600 mb-3 resize-none"
                rows={2}
              />
              <Button
                size="sm"
                onClick={saveAnnouncement}
                disabled={announcementSaving}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {announcementSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Salvar Aviso
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Gestão de Barbearias</h2>
                <p className="text-xs text-slate-500">{filteredShops.length} de {shops.length} barbearias</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, slug ou e-mail..."
                  className="bg-slate-900/50 border-slate-700 text-slate-200 placeholder:text-slate-600 pl-10"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-36 bg-slate-900/50 border-slate-700 text-slate-200">
                  <Filter className="h-3.5 w-3.5 mr-1 text-slate-500" />
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                  <SelectItem value="all">Todos Planos</SelectItem>
                  <SelectItem value="essential">Essential</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 bg-slate-900/50 border-slate-700 text-slate-200">
                  <Filter className="h-3.5 w-3.5 mr-1 text-slate-500" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tenant Table */}
            {shops.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-10">Nenhuma barbearia cadastrada.</p>
            ) : (
              <div className="rounded-xl border border-slate-700/50 overflow-hidden" style={{ background: "rgba(10, 18, 35, 0.7)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50" style={{ background: "rgba(6, 11, 24, 0.8)" }}>
                        <th className="text-left px-4 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Barbearia</th>
                        <th className="text-left px-4 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider hidden sm:table-cell">E-mail do Dono</th>
                        <th className="text-left px-4 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Plano</th>
                        <th className="text-left px-4 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider hidden md:table-cell">Criação</th>
                        <th className="text-left px-4 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShops.map((shop) => {
                        const plan = getPlanForShop(shop.id);
                        return (
                          <tr key={shop.id} className="border-t border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3.5">
                              <p className="font-medium text-white">{shop.name}</p>
                              <p className="text-xs text-slate-500">/{shop.slug}</p>
                            </td>
                            <td className="px-4 py-3.5 hidden sm:table-cell text-slate-400 text-xs">
                              {getOwnerEmail(shop.owner_id)}
                            </td>
                            <td className="px-4 py-3.5">
                              <Select
                                value={plan?.plan_name || "essential"}
                                onValueChange={(val) => handleChangePlan(shop, val)}
                              >
                                <SelectTrigger className={`w-28 h-8 text-xs border-slate-700 bg-transparent ${planColors[plan?.plan_name || "essential"]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                                  <SelectItem value="essential">Essential</SelectItem>
                                  <SelectItem value="growth">Growth</SelectItem>
                                  <SelectItem value="pro">Pro</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3.5 hidden md:table-cell text-slate-500 text-xs">
                              {format(new Date(shop.created_at), "dd/MM/yyyy")}
                            </td>
                            <td className="px-4 py-3.5">
                              {plan ? statusBadge(plan.status) : <Badge variant="outline">—</Badge>}
                            </td>
                            <td className="px-4 py-3.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-400 hover:text-white hover:bg-slate-700 h-8 px-2"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-slate-900 border-slate-700 text-slate-200"
                                >
                                  <DropdownMenuItem
                                    onClick={() => setDetailShop(shop)}
                                    className="hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleImpersonate(shop)}
                                    className="hover:bg-slate-800 cursor-pointer text-cyan-400"
                                  >
                                    <UserCog className="mr-2 h-4 w-4" /> Login como Dono
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-700" />
                                  <DropdownMenuItem
                                    onClick={() => handleSuspend(shop)}
                                    className="hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    {plan?.status === "active" ? "Suspender" : "Reativar"}
                                  </DropdownMenuItem>
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
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailShop} onOpenChange={() => setDetailShop(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{detailShop?.name}</DialogTitle>
          </DialogHeader>
          {detailShop && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs text-slate-400">Agendamentos</p>
                  <p className="text-xl font-bold text-cyan-400">{shopAppointments(detailShop.id).length}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs text-slate-400">Faturamento Total</p>
                  <p className="text-xl font-bold text-emerald-400">
                    R$ {shopRevenue(detailShop.id).toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">E-mail do Dono</p>
                  <p className="text-sm text-slate-200">{getOwnerEmail(detailShop.owner_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Slug</p>
                  <p className="text-sm text-slate-200">/agendamentos/{detailShop.slug}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Criada em</p>
                <p className="text-sm text-slate-200">
                  {format(new Date(detailShop.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              {shopAppointments(detailShop.id).length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Últimos Agendamentos</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {shopAppointments(detailShop.id).slice(0, 5).map((a) => (
                      <div key={a.id} className="flex justify-between text-xs px-2 py-1.5 rounded bg-slate-800">
                        <span className="text-slate-300">{a.client_name} — {a.service_name}</span>
                        <span className="text-slate-500">R$ {Number(a.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button
                onClick={() => { handleImpersonate(detailShop); setDetailShop(null); }}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                <UserCog className="h-4 w-4 mr-2" /> Acessar Dashboard como Dono
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity Logs Dialog */}
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" /> Logs de Atividade
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto mt-2">
            {logs.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Nenhuma atividade registrada.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{log.action}</p>
                    <p className="text-xs text-slate-400 truncate">{log.details}</p>
                  </div>
                  <p className="text-[10px] text-slate-600 whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM HH:mm")}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
