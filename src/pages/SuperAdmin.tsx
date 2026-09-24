import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, DollarSign, CalendarDays, Loader2, LogOut,
  Eye, Search, Bell, Activity, UserCog, ChevronDown,
  ShieldCheck, TrendingUp, CreditCard, Save, RefreshCw
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

const planPrices: Record<string, number> = { essential: 97, growth: 197, pro: 397 };
const planLabels: Record<string, string> = { essential: "Essential", growth: "Growth", pro: "Pro" };

const SuperAdmin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [detailShop, setDetailShop] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ plan: "essential", status: "active" });
  const [broadcastText, setBroadcastText] = useState("");

  const { data: shops = [], isLoading: loadingShops } = useQuery({
    queryKey: ["admin-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("barbershops").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
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

  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("saas_plans")
        .update({ plan_name: editForm.plan, status: editForm.status, price: planPrices[editForm.plan] || 0 })
        .eq("barbershop_id", detailShop.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast({ title: "Plano atualizado!" });
      setDetailShop(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" })
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("system_settings").upsert({ key: "announcement", value: broadcastText }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Aviso enviado!", description: "Todos os usuários verão o aviso." })
  });

  const renewTrialMutation = useMutation({
    mutationFn: async (shopId: string) => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 30);
      const { error } = await supabase
        .from("barbershops")
        .update({ trial_ends_at: newDate.toISOString() })
        .eq("id", shopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shops"] });
      toast({ title: "Trial estendido por 30 dias!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" })
  });

  const dashboardStats = useMemo(() => {
    const active = plans.filter(p => p.status === "active");
    const mrrValue = active.reduce((sum, p) => sum + Number(p.price || 0), 0);
    return [
      { label: "Estabelecimentos", value: shops.length, icon: Building2, color: "text-blue-500" },
      { label: "Ativos", value: active.length, icon: Users, color: "text-emerald-500" },
      { label: "MRR", value: `R$ ${mrrValue.toLocaleString()}`, icon: DollarSign, color: "text-violet-500" },
      { label: "Bookings 24h", value: metrics?.last24hBookings || 0, icon: CalendarDays, color: "text-amber-500" },
    ];
  }, [shops, plans, metrics]);

  const filteredShops = useMemo(() => {
    return shops.filter(shop => shop.name.toLowerCase().includes(searchQuery.toLowerCase()) || shop.slug.includes(searchQuery));
  }, [shops, searchQuery]);

  if ((authLoading || loadingShops) && !shops.length) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Activity className="h-3 w-3 text-emerald-500" /> Sistema operacional
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 font-medium">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {dashboardStats.map((kpi, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-elev-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <h2 className="text-2xl font-bold font-mono">{kpi.value}</h2>
            </div>
          ))}
        </div>

        {/* BROADCAST */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-10 shadow-elev-1">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" /> Aviso Global
          </h3>
          <Textarea 
            value={broadcastText} 
            onChange={(e) => setBroadcastText(e.target.value)} 
            placeholder="Digite o aviso que aparecerá no Dashboard de todos os estabelecimentos..."
            className="bg-background border-border min-h-[80px] rounded-xl resize-none text-sm p-4" 
          />
          <Button 
            onClick={() => broadcastMutation.mutate()} 
            disabled={broadcastMutation.isPending}
            className="mt-4"
          >
            {broadcastMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Enviar Aviso
          </Button>
        </div>

        {/* TABLE */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-elev-1">
          <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold">Estabelecimentos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{shops.length} registros</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                className="pl-11 rounded-full" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left">Estabelecimento</th>
                  <th className="px-6 py-4 text-left">Proprietário</th>
                  <th className="px-6 py-4 text-left">Plano</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredShops.map(shop => {
                  const plan = plans.find(p => p.barbershop_id === shop.id);
                  const planName = plan?.plan_name || "essential";
                  const isActive = plan?.status === "active";
                  
                  const now = new Date();
                  const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at) : null;
                  const isTrialActive = trialEnd && trialEnd > now && !isActive;
                  const isTrialExpired = trialEnd && trialEnd <= now && !isActive;
                  const trialDaysLeft = isTrialActive ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

                  return (
                    <tr key={shop.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm">{shop.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">/{shop.slug}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{metrics?.emailMap[shop.owner_id] || "—"}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`text-[10px] font-bold border uppercase tracking-wider ${
                          planName === "pro" ? "border-amber-500/50 text-amber-500 bg-amber-500/10" :
                          planName === "growth" ? "border-blue-500/50 text-blue-500 bg-blue-500/10" :
                          "border-muted-foreground/50 text-muted-foreground bg-secondary"
                        }`}>
                          {planLabels[planName] || "Essential"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Ativo
                          </span>
                        ) : isTrialActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500">
                            <span className="h-2 w-2 rounded-full bg-amber-500" /> Trial ({trialDaysLeft}d)
                          </span>
                        ) : isTrialExpired ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500">
                            <span className="h-2 w-2 rounded-full bg-red-500" /> Trial Expirado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border shadow-elev-3 rounded-xl w-48">
                            <DropdownMenuItem
                              onClick={() => renewTrialMutation.mutate(shop.id)}
                              className="cursor-pointer text-sm gap-2 text-amber-500 focus:text-amber-500 focus:bg-amber-500/10"
                            >
                              <CalendarDays className="h-4 w-4" /> Estender Trial (+30d)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { setDetailShop(shop); setEditForm({ plan: plan?.plan_name || "essential", status: plan?.status || "active" }); }}
                              className="cursor-pointer text-sm gap-2"
                            >
                              <UserCog className="h-4 w-4 text-muted-foreground" /> Editar Plano
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { localStorage.setItem("impersonate_barbershop_id", shop.id); navigate("/dashboard"); }}
                              className="cursor-pointer text-sm gap-2 text-primary focus:text-primary focus:bg-primary/10"
                            >
                              <Eye className="h-4 w-4" /> Modo Suporte
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filteredShops.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <Dialog open={!!detailShop} onOpenChange={() => setDetailShop(null)}>
        <DialogContent className="bg-card border-border sm:max-w-md rounded-2xl shadow-elev-3 p-6">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="text-primary h-5 w-5" /> Gerenciar Plano
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="bg-secondary p-4 rounded-xl border border-border">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1">Estabelecimento</p>
              <h3 className="text-base font-bold">{detailShop?.name}</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Plano</label>
                <Select value={editForm.plan} onValueChange={(v) => setEditForm({...editForm, plan: v})}>
                  <SelectTrigger className="bg-background border-border h-12 rounded-xl text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-xl">
                    <SelectItem value="essential">Essential — R$ 97/mês</SelectItem>
                    <SelectItem value="growth">Growth — R$ 197/mês</SelectItem>
                    <SelectItem value="pro">Pro — R$ 397/mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                  <SelectTrigger className="bg-background border-border h-12 rounded-xl text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-xl">
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border mt-4">
              <Button variant="ghost" onClick={() => setDetailShop(null)} className="flex-1 rounded-xl">
                Cancelar
              </Button>
              <Button 
                onClick={() => updatePlanMutation.mutate()} 
                disabled={updatePlanMutation.isPending} 
                className="flex-1 rounded-xl"
              >
                {updatePlanMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;

