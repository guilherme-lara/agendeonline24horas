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

  const dashboardStats = useMemo(() => {
    const active = plans.filter(p => p.status === "active");
    const mrrValue = active.reduce((sum, p) => sum + Number(p.price || 0), 0);
    return [
      { label: "Estabelecimentos", value: shops.length, icon: Building2, color: "text-blue-600" },
      { label: "Ativos", value: active.length, icon: Users, color: "text-emerald-600" },
      { label: "MRR", value: `R$ ${mrrValue.toLocaleString()}`, icon: DollarSign, color: "text-violet-600" },
      { label: "Bookings 24h", value: metrics?.last24hBookings || 0, icon: CalendarDays, color: "text-amber-600" },
    ];
  }, [shops, plans, metrics]);

  const filteredShops = useMemo(() => {
    return shops.filter(shop => shop.name.toLowerCase().includes(searchQuery.toLowerCase()) || shop.slug.includes(searchQuery));
  }, [shops, searchQuery]);

  if ((authLoading || loadingShops) && !shops.length) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-xl">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                <Activity className="h-3 w-3 text-emerald-500" /> Sistema operacional
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut} className="text-gray-500 hover:text-red-600 hover:bg-red-50 font-medium">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {dashboardStats.map((kpi, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{kpi.value}</h2>
            </div>
          ))}
        </div>

        {/* BROADCAST */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-10 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" /> Aviso Global
          </h3>
          <Textarea 
            value={broadcastText} 
            onChange={(e) => setBroadcastText(e.target.value)} 
            placeholder="Digite o aviso que aparecerá no Dashboard de todos os estabelecimentos..."
            className="bg-gray-50 border-gray-200 min-h-[80px] rounded-lg resize-none" 
          />
          <Button 
            onClick={() => broadcastMutation.mutate()} 
            disabled={broadcastMutation.isPending}
            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium h-9 px-6 rounded-lg text-sm"
          >
            {broadcastMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
            Enviar Aviso
          </Button>
        </div>

        {/* TABLE */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Estabelecimentos</h3>
              <p className="text-xs text-gray-500 mt-0.5">{shops.length} registros</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Buscar..." 
                className="pl-9 h-9 bg-gray-50 border-gray-200 text-sm rounded-lg" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">Estabelecimento</th>
                  <th className="px-6 py-3 text-left">Proprietário</th>
                  <th className="px-6 py-3 text-left">Plano</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredShops.map(shop => {
                  const plan = plans.find(p => p.barbershop_id === shop.id);
                  const planName = plan?.plan_name || "essential";
                  const isActive = plan?.status === "active";
                  return (
                    <tr key={shop.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 text-sm">{shop.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">/{shop.slug}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{metrics?.emailMap[shop.owner_id] || "—"}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`text-xs font-medium border ${
                          planName === "pro" ? "border-amber-200 text-amber-700 bg-amber-50" :
                          planName === "growth" ? "border-blue-200 text-blue-700 bg-blue-50" :
                          "border-gray-200 text-gray-600 bg-gray-50"
                        }`}>
                          {planLabels[planName] || "Essential"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive ? "text-emerald-600" : "text-red-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                          {isActive ? "Ativo" : plan?.status || "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border-gray-200 shadow-lg rounded-lg w-48">
                            <DropdownMenuItem
                              onClick={() => { setDetailShop(shop); setEditForm({ plan: plan?.plan_name || "essential", status: plan?.status || "active" }); }}
                              className="cursor-pointer text-sm gap-2"
                            >
                              <UserCog className="h-3.5 w-3.5 text-gray-500" /> Editar Plano
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { localStorage.setItem("impersonate_barbershop_id", shop.id); navigate("/dashboard"); }}
                              className="cursor-pointer text-sm gap-2 text-blue-600"
                            >
                              <Eye className="h-3.5 w-3.5" /> Modo Suporte
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filteredShops.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">Nenhum resultado encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <Dialog open={!!detailShop} onOpenChange={() => setDetailShop(null)}>
        <DialogContent className="bg-white border-gray-200 max-w-md rounded-xl shadow-xl">
          <DialogHeader className="pb-4 border-b border-gray-100">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="text-blue-600 h-5 w-5" /> Gerenciar Plano
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Estabelecimento</p>
              <h3 className="text-base font-semibold text-gray-900">{detailShop?.name}</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Plano</label>
                <Select value={editForm.plan} onValueChange={(v) => setEditForm({...editForm, plan: v})}>
                  <SelectTrigger className="bg-white border-gray-200 h-10 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 rounded-lg">
                    <SelectItem value="essential">Essential — R$ 97/mês</SelectItem>
                    <SelectItem value="growth">Growth — R$ 197/mês</SelectItem>
                    <SelectItem value="pro">Pro — R$ 397/mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Status</label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                  <SelectTrigger className="bg-white border-gray-200 h-10 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 rounded-lg">
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setDetailShop(null)} className="flex-1 border-gray-200 text-gray-700 rounded-lg h-10">
                Cancelar
              </Button>
              <Button 
                onClick={() => updatePlanMutation.mutate()} 
                disabled={updatePlanMutation.isPending} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg h-10"
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
