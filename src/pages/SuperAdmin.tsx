import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, DollarSign, CalendarDays, Loader2, LogOut,
  Eye, Search, Bell, Activity, UserCog, ChevronDown,
  AlertTriangle, ShieldCheck, TrendingUp, CreditCard, Save, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- Constantes de Gestão ---
const planPrices: Record<string, number> = { essential: 97, growth: 197, pro: 397 };
const planColors: Record<string, string> = { 
  essential: "text-slate-400 border-slate-800 bg-slate-800/10", 
  growth: "text-cyan-400 border-cyan-900/50 bg-cyan-500/5", 
  pro: "text-amber-400 border-amber-900/50 bg-amber-500/5" 
};

const SuperAdmin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { toast } = useToast();

  // Estados de UI
  const [searchQuery, setSearchQuery] = useState("");
  const [detailShop, setDetailShop] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ plan: "essential", status: "active" });
  const [broadcastText, setBroadcastText] = useState("");

  // --- QUERIES MESTRES (O MOTOR DE SINCRONIA) ---
  const { data: shops = [], isLoading: loadingShops } = useQuery({
    queryKey: ["admin-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("barbershops").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
    refetchOnWindowFocus: true, // Atualiza ao voltar para a aba
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("saas_plans").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const { data: metrics } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const [appts, emails] = await Promise.all([
        supabase.from("appointments").select("created_at").gte("created_at", subHours(new Date(), 24).toISOString()),
        supabase.rpc("admin_get_user_emails")
      ]);
      
      const emailMap: Record<string, string> = {};
      if (emails.data) emails.data.forEach((e: any) => { emailMap[e.user_id] = e.email; });

      return { last24hBookings: appts.data?.length || 0, emailMap };
    },
    enabled: !!user && isAdmin,
  });

  const { data: systemSettings } = useQuery({
    queryKey: ["admin-broadcast"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("*").eq("key", "announcement").maybeSingle();
      if (data) setBroadcastText(data.value || "");
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // --- MUTAÇÕES (AÇÕES BLINDADAS) ---
  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("saas_plans")
        .update({ 
          plan_name: editForm.plan, 
          status: editForm.status,
          price: planPrices[editForm.plan] || 0 
        })
        .eq("barbershop_id", detailShop.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast({ title: "Sistema Atualizado!", description: "As permissões foram alteradas em tempo real." });
      setDetailShop(null);
    },
    onError: (err: any) => toast({ title: "Erro na atualização", description: err.message, variant: "destructive" })
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("system_settings").upsert({ key: "announcement", value: broadcastText }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Broadcast Enviado!", description: "Todos os usuários verão o aviso agora." })
  });

  // --- CÁLCULOS KPI (MEMOIZADOS) ---
  const dashboardStats = useMemo(() => {
    const active = plans.filter(p => p.status === "active");
    const mrrValue = active.reduce((sum, p) => sum + Number(p.price || 0), 0);
    
    return [
      { label: "Barbearias", value: shops.length, icon: Building2, color: "text-cyan-400", bg: "bg-cyan-500/10" },
      { label: "Assinantes Ativos", value: active.length, icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
      { label: "MRR Estimado", value: `R$ ${mrrValue.toLocaleString()}`, icon: DollarSign, color: "text-violet-400", bg: "bg-violet-500/10" },
      { label: "Bookings (24h)", value: metrics?.last24hBookings || 0, icon: CalendarDays, color: "text-amber-400", bg: "bg-amber-500/10" },
    ];
  }, [shops, plans, metrics]);

  const filteredShops = useMemo(() => {
    return shops.filter(shop => shop.name.toLowerCase().includes(searchQuery.toLowerCase()) || shop.slug.includes(searchQuery));
  }, [shops, searchQuery]);

  // --- RENDERS DE PROTEÇÃO ---
  // REGRA 2: Bloqueio APENAS na primeira carga sem dados no cache
  if ((authLoading || loadingShops) && !shops.length) return (
    <div className="min-h-screen bg-[#060b18] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Estabelecendo Conexão Nexus...</p>
    </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#060b18] text-slate-200 selection:bg-cyan-500/30 pb-20">
      <div className="max-w-7xl mx-auto px-6 py-10">
        
        {/* HEADER MASTER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-slate-800 pb-8">
          <div className="flex items-center gap-4">
            <div className="bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
              <ShieldCheck className="h-7 w-7 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight font-display">Nexus <span className="text-cyan-500">Command</span></h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mt-1">
                <Activity className="h-3 w-3 text-emerald-500 animate-pulse" /> Global System Monitor &bull; 2026
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut} className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 font-bold transition-all h-12 rounded-xl">
            <LogOut className="h-4 w-4 mr-2" /> Encerrar Sessão Root
          </Button>
        </header>

        {/* KPI GRID NEON */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {dashboardStats.map((kpi, i) => (
            <div key={i} className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group backdrop-blur-xl transition-all hover:border-slate-700 shadow-2xl">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><kpi.icon className="h-16 w-16" /></div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black mb-1">{kpi.label}</p>
              <h2 className="text-4xl font-black text-white tracking-tighter">{kpi.value}</h2>
              <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${kpi.bg} ${kpi.color}`}>
                <TrendingUp className="h-3 w-3" /> System Health Optimal
              </div>
            </div>
          ))}
        </div>

        {/* CONTROLE DE BROADCAST */}
        <div className="bg-slate-900/40 border border-cyan-500/20 p-8 rounded-[2.5rem] mb-12 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Bell className="h-20 w-20 text-cyan-500" /></div>
          <h3 className="text-sm font-black text-cyan-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
            <Bell className="h-4 w-4" /> Global System Broadcast
          </h3>
          <Textarea 
            value={broadcastText} 
            onChange={(e) => setBroadcastText(e.target.value)} 
            placeholder="Digite o aviso que aparecerá no Dashboard de todos os barbeiros..."
            className="bg-slate-950 border-slate-800 text-slate-200 min-h-[100px] rounded-2xl p-4 focus:ring-cyan-500/50" 
          />
          <Button 
            onClick={() => broadcastMutation.mutate()} 
            disabled={broadcastMutation.isPending}
            className="mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black h-12 px-8 rounded-xl shadow-lg shadow-cyan-900/20"
          >
            {broadcastMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Propagar Mensagem no Sistema
          </Button>
        </div>

        {/* TABELA DE REGISTROS (INDUSTRIAL) */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="p-8 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/60">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight leading-none">Registry Management</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Base de Dados Centralizada</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <Input 
                placeholder="Buscar barbearia ou slug..." 
                className="pl-11 h-12 bg-slate-950 border-slate-800 text-sm text-white rounded-2xl" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/50 text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] border-b border-slate-800">
                <tr>
                  <th className="px-8 py-5 text-left">Entity & Slug</th>
                  <th className="px-8 py-5 text-left">Ownership</th>
                  <th className="px-8 py-5 text-left">Service Tier</th>
                  <th className="px-8 py-5 text-left">Status</th>
                  <th className="px-8 py-5 text-right">Master Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredShops.map(shop => {
                  const plan = plans.find(p => p.barbershop_id === shop.id);
                  return (
                    <tr key={shop.id} className="hover:bg-cyan-500/[0.03] transition-colors group">
                      <td className="px-8 py-5">
                        <div className="font-black text-slate-100 text-sm">{shop.name}</div>
                        <div className="text-[10px] text-cyan-500/60 font-mono mt-0.5 tracking-tighter">/{shop.slug}</div>
                      </td>
                      <td className="px-8 py-5 text-xs font-medium text-slate-400 font-mono">{metrics?.emailMap[shop.owner_id] || "root@system"}</td>
                      <td className="px-8 py-5">
                        <Badge variant="outline" className={`${planColors[plan?.plan_name || "essential"]} border-none font-black text-[10px] tracking-widest uppercase`}>
                          {plan?.plan_name || "ESSENTIAL"}
                        </Badge>
                      </td>
                      <td className="px-8 py-5">
                        <Badge className={`border-none font-black text-[9px] uppercase tracking-widest px-2.5 py-1 ${
                          plan?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {plan?.status || 'INACTIVE'}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-all"><ChevronDown className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#0b1224] border-slate-800 text-slate-300 w-48 rounded-2xl shadow-2xl p-2">
                            <DropdownMenuItem onClick={() => { setDetailShop(shop); setEditForm({ plan: plan?.plan_name || "essential", status: plan?.status || "active" }); }} className="cursor-pointer rounded-xl hover:bg-slate-800 h-10 gap-3 font-bold text-xs">
                              <UserCog className="h-4 w-4 text-cyan-400" /> Ajustar Assinatura
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { localStorage.setItem("impersonate_barbershop_id", shop.id); navigate("/dashboard"); }} className="cursor-pointer rounded-xl hover:bg-cyan-500/10 h-10 gap-3 font-bold text-xs text-cyan-400">
                              <Eye className="h-4 w-4" /> Modo Suporte (Dono)
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

      {/* MODAL DE GESTÃO DE PLANO (INDUSTRIAL) */}
      <Dialog open={!!detailShop} onOpenChange={() => setDetailShop(null)}>
        <DialogContent className="bg-[#0b1224] border-slate-800 text-white max-w-md rounded-[2rem] shadow-2xl">
          <DialogHeader className="border-b border-slate-800/50 pb-6 mb-6">
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <CreditCard className="text-cyan-400 h-6 w-6" /> Configurar Tier
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-8">
            <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Building2 className="h-12 w-12" /></div>
              <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-[0.2em]">Instância Selecionada</p>
              <h3 className="text-xl font-black text-white tracking-tight">{detailShop?.name}</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nível de Acesso do SaaS</label>
                <Select value={editForm.plan} onValueChange={(v) => setEditForm({...editForm, plan: v})}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 h-14 rounded-xl text-sm font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b1224] border-slate-800 text-white rounded-xl">
                    <SelectItem value="essential" className="focus:bg-slate-800">Essential (Standard)</SelectItem>
                    <SelectItem value="growth" className="focus:bg-slate-800">Growth (Advanced)</SelectItem>
                    <SelectItem value="pro" className="focus:bg-slate-800">Pro (Industrial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Status de Faturamento</label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 h-14 rounded-xl text-sm font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b1224] border-slate-800 text-white rounded-xl">
                    <SelectItem value="active" className="focus:bg-emerald-900/20 text-emerald-400">🟢 Ativo - Total Access</SelectItem>
                    <SelectItem value="suspended" className="focus:bg-red-900/20 text-red-400">🔴 Suspenso - System Block</SelectItem>
                    <SelectItem value="overdue" className="focus:bg-yellow-900/20 text-yellow-400">🟡 Atrasado - Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-6 border-t border-slate-800/50">
              <Button 
                onClick={() => updatePlanMutation.mutate()} 
                disabled={updatePlanMutation.isPending} 
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black h-16 rounded-2xl shadow-xl shadow-cyan-900/20 transition-all active:scale-95"
              >
                {updatePlanMutation.isPending ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                Persistir Alterações Root
              </Button>
              <p className="text-[10px] text-center text-slate-600 font-bold uppercase tracking-tighter">Alterações propagadas globalmente em tempo real</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
