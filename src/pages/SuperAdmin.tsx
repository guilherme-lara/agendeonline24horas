import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, DollarSign, CalendarDays, Loader2, LogOut,
  Eye, Ban, ChevronDown, Search, Filter, Bell, Activity,
  UserCog, ArrowUpDown, AlertTriangle, ShieldCheck, TrendingUp,
  ExternalLink, CreditCard, Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

// --- Helpers de Estilo ---
const planPrices: Record<string, number> = { essential: 97, growth: 197, pro: 397 };
const planColors: Record<string, string> = { 
  essential: "text-slate-400 border-slate-800", 
  growth: "text-cyan-400 border-cyan-900/50", 
  pro: "text-amber-400 border-amber-900/50" 
};

const StatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    overdue: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    suspended: "bg-red-500/10 text-red-400 border-red-500/20",
    inactive: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  const label: Record<string, string> = { active: "Ativo", overdue: "Atrasado", suspended: "Suspenso", inactive: "Inativo" };
  return <Badge className={`${configs[status] || configs.inactive} border font-medium px-2 py-0.5`}>{label[status] || status}</Badge>;
};

const SuperAdmin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { toast } = useToast();

  // --- Estados do Dashboard Original ---
  const [shops, setShops] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [upgradeRequests, setUpgradeRequests] = useState<any[]>([]);
  
  // --- Estados de Filtro e UI ---
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailShop, setDetailShop] = useState<any | null>(null);

  // --- Estados da Nova Gestão de Planos ---
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [shopsRes, plansRes, apptsRes, emailsRes, announcementRes, logsRes, upgradeRes] = await Promise.all([
        supabase.from("barbershops").select("*").order("created_at", { ascending: false }),
        supabase.from("saas_plans").select("*"),
        supabase.from("appointments").select("*").order("created_at", { ascending: false }),
        supabase.rpc("admin_get_user_emails"),
        supabase.from("system_settings").select("*").eq("key", "announcement").maybeSingle(),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("upgrade_requests").select("*").order("created_at", { ascending: false }),
      ]);

      setShops(shopsRes.data || []);
      setPlans(plansRes.data || []);
      setAppointments(apptsRes.data || []);
      setLogs(logsRes.data || []);
      setUpgradeRequests(upgradeRes.data || []);

      const emailMap: Record<string, string> = {};
      if (emailsRes.data) emailsRes.data.forEach((e: any) => { emailMap[e.user_id] = e.email; });
      setEmails(emailMap);
      if (announcementRes.data) setAnnouncement(announcementRes.data.value || "");
    } catch (err) {
      console.error("Erro Nexus Admin:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && isAdmin) fetchData();
  }, [user, authLoading, isAdmin, fetchData]);

  // --- Ações Master ---
  const handleOpenDetails = (shop: any) => {
    const plan = plans.find(p => p.barbershop_id === shop.id);
    setDetailShop(shop);
    setEditPlan(plan?.plan_name || "essential");
    setEditStatus(plan?.status || "active");
  };

  const handleUpdatePlan = async () => {
    if (!detailShop) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("saas_plans")
        .update({ 
          plan_name: editPlan, 
          status: editStatus,
          price: planPrices[editPlan] || 0 
        })
        .eq("barbershop_id", detailShop.id);

      if (error) throw error;
      toast({ title: "Sistema Atualizado", description: `${detailShop.name} agora é ${editPlan.toUpperCase()}` });
      fetchData();
      setDetailShop(null);
    } catch (err) {
      toast({ title: "Erro na atualização", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImpersonate = (shop: any) => {
    localStorage.setItem("impersonate_barbershop_id", shop.id);
    toast({ title: "Modo Suporte", description: `Simulando acesso: ${shop.name}` });
    navigate("/dashboard");
  };

  // --- Cálculos KPI ---
  const activePlans = plans.filter(p => p.status === "active");
  const mrr = activePlans.reduce((sum, p) => sum + Number(p.price || 0), 0);
  const filteredShops = shops.filter(shop => {
    const plan = plans.find(p => p.barbershop_id === shop.id);
    const matchSearch = shop.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlan = planFilter === "all" || plan?.plan_name === planFilter;
    const matchStatus = statusFilter === "all" || plan?.status === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  if (authLoading || loading) return <div className="min-h-screen bg-[#060b18] flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-cyan-500" /></div>;

  return (
    <div className="min-h-screen bg-[#060b18] text-slate-200 selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto px-6 py-10">
        
        {/* HEADER ORIGINAL */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white font-display">Nexus Command Center</h1>
            </div>
            <p className="text-slate-500 text-sm flex items-center gap-2">
              <Activity className="h-3 w-3 text-emerald-500" /> Sistema operando &bull; {format(new Date(), "HH:mm", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={signOut} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
              <LogOut className="h-4 w-4 mr-2" /> Encerrar Sessão
            </Button>
          </div>
        </header>

        {/* KPI GRID ORIGINAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Barbershops", value: shops.length, icon: Building2, color: "text-cyan-400", trend: "+12%" },
            { label: "Active Subs", value: activePlans.length, icon: Users, color: "text-emerald-400", trend: "+5%" },
            { label: "Est. MRR", value: `R$ ${mrr.toLocaleString()}`, icon: DollarSign, color: "text-violet-400", trend: "Steady" },
            { label: "Bookings (24h)", value: appointments.filter(a => a.created_at >= subHours(new Date(), 24).toISOString()).length, icon: CalendarDays, color: "text-amber-400", trend: "+18%" }
          ].map((kpi, i) => (
            <div key={i} className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group backdrop-blur-md">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><kpi.icon className="h-12 w-12" /></div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{kpi.label}</p>
              <h2 className="text-3xl font-black text-white mb-2">{kpi.value}</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 ${kpi.color}`}>
                <TrendingUp className="h-3 w-3 inline mr-1" /> {kpi.trend}
              </span>
            </div>
          ))}
        </div>

        {/* BROADCAST E REQUESTS ORIGINAIS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 bg-slate-900/40 border border-cyan-900/20 p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-tighter">Global System Broadcast</h3>
            </div>
            <Textarea value={announcement} onChange={(e) => setAnnouncement(e.target.value)} className="bg-slate-950 border-slate-800 text-sm mb-4 min-h-[80px]" />
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">Atualizar Broadcast</Button>
          </div>

          <div className="bg-slate-900/40 border border-amber-900/20 p-6 rounded-2xl overflow-y-auto max-h-[220px]">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-tighter mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Pending Upgrades</h3>
            {upgradeRequests.length === 0 ? <p className="text-xs text-slate-600 italic">Nenhuma solicitação pendente.</p> : (
              <div className="space-y-3">
                {upgradeRequests.map(req => (
                  <div key={req.id} className="text-xs p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center text-slate-300">
                    <span>{req.barbershop_id.slice(0,8)}...</span>
                    <Button size="xs" variant="link" className="text-cyan-400 h-auto p-0">Tratar</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TABELA DE REGISTROS ORIGINAL (COM BOTÃO DE GESTÃO) */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl">
          <div className="p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-900/60">
            <h3 className="font-bold text-lg text-white">Registry Management</h3>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input placeholder="Buscar..." className="pl-10 h-9 w-64 bg-slate-950 border-slate-800 text-xs text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/50 text-[10px] uppercase font-bold text-slate-500 tracking-widest border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left">Entity</th>
                  <th className="px-6 py-4 text-left">Ownership</th>
                  <th className="px-6 py-4 text-left">Tier</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {filteredShops.map(shop => {
                  const plan = plans.find(p => p.barbershop_id === shop.id);
                  return (
                    <tr key={shop.id} className="hover:bg-cyan-500/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-200">{shop.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">/{shop.slug}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{emails[shop.owner_id] || "N/A"}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`${planColors[plan?.plan_name || "essential"]} text-[10px] border-current bg-transparent`}>
                          {plan?.plan_name?.toUpperCase() || "ESSENTIAL"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={plan?.status || "inactive"} /></td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-800"><ChevronDown className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-300">
                            <DropdownMenuItem onClick={() => handleOpenDetails(shop)} className="cursor-pointer hover:bg-slate-800">
                              <UserCog className="h-4 w-4 mr-2" /> Gestão de Plano
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleImpersonate(shop)} className="cursor-pointer text-cyan-400">
                              <Eye className="h-4 w-4 mr-2" /> Login como Dono
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
      </div>

      {/* NOVO MODAL DE GESTÃO MANUAL INTEGRADO NO DESIGN */}
      <Dialog open={!!detailShop} onOpenChange={() => setDetailShop(null)}>
        <DialogContent className="bg-[#0b1224] border-slate-800 text-white max-w-md shadow-2xl">
          <DialogHeader className="border-b border-slate-800/50 pb-4 mb-4">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <CreditCard className="text-cyan-400 h-5 w-5" /> Configurar Assinatura
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <p className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-widest">Barbearia</p>
              <h3 className="text-lg font-black text-white">{detailShop?.name}</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nível de Acesso (Tier)</label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b1224] border-slate-800 text-white">
                    <SelectItem value="essential">Essential (R$ 97/mês)</SelectItem>
                    <SelectItem value="growth">Growth (R$ 197/mês)</SelectItem>
                    <SelectItem value="pro">Pro (R$ 397/mês)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status do Sistema</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b1224] border-slate-800 text-white">
                    <SelectItem value="active">🟢 Ativo (Acesso Total)</SelectItem>
                    <SelectItem value="suspended">🔴 Suspenso (Bloqueado)</SelectItem>
                    <SelectItem value="overdue">🟡 Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-slate-800/50">
              <Button onClick={handleUpdatePlan} disabled={isUpdating} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-11">
                {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Alterações
              </Button>
              <p className="text-[9px] text-center text-slate-600 uppercase">Isso alterará as permissões e cobrança imediatamente</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
