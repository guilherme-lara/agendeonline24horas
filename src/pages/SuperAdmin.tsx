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
  return (
    <Badge className={`${configs[status] || configs.inactive} border font-medium px-2 py-0.5`}>
      {label[status] || status}
    </Badge>
  );
};

const SuperAdmin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { toast } = useToast();

  const [shops, setShops] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [detailShop, setDetailShop] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Estados para edição de plano no modal
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [shopsRes, plansRes, apptsRes, emailsRes] = await Promise.all([
        supabase.from("barbershops").select("*").order("created_at", { ascending: false }),
        supabase.from("saas_plans").select("*"),
        supabase.from("appointments").select("*").order("created_at", { ascending: false }),
        supabase.rpc("admin_get_user_emails"),
      ]);

      setShops(shopsRes.data || []);
      setPlans(plansRes.data || []);
      setAppointments(apptsRes.data || []);
      const emailMap: Record<string, string> = {};
      if (emailsRes.data) emailsRes.data.forEach((e: any) => { emailMap[e.user_id] = e.email; });
      setEmails(emailMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && isAdmin) fetchData();
  }, [user, authLoading, isAdmin, fetchData]);

  // Função para abrir modal e carregar valores atuais
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

      toast({ title: "Plano Atualizado", description: `A barbearia ${detailShop.name} agora é ${editPlan.toUpperCase()}.` });
      fetchData();
      setDetailShop(null);
    } catch (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImpersonate = (shop: any) => {
    localStorage.setItem("impersonate_barbershop_id", shop.id);
    navigate("/dashboard");
  };

  const filteredShops = shops.filter(shop => {
    const plan = plans.find(p => p.barbershop_id === shop.id);
    const matchSearch = shop.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlan = planFilter === "all" || plan?.plan_name === planFilter;
    const matchStatus = statusFilter === "all" || plan?.status === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  if (authLoading || loading) return <div className="min-h-screen bg-[#060b18] flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>;

  return (
    <div className="min-h-screen bg-[#060b18] text-slate-200 p-10">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-cyan-400 h-8 w-8" />
            <h1 className="text-3xl font-black text-white">Nexus Master Admin</h1>
          </div>
          <Button variant="ghost" onClick={signOut} className="text-slate-400 hover:text-red-400">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </header>

        {/* Tabela de Gestão */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input 
                placeholder="Buscar barbearia..." 
                className="pl-10 bg-slate-950 border-slate-800"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <table className="w-full">
            <thead className="bg-slate-950/50 text-[10px] uppercase font-bold text-slate-500 tracking-widest">
              <tr>
                <th className="px-6 py-4 text-left">Barbearia</th>
                <th className="px-6 py-4 text-left">Plano Atual</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredShops.map(shop => {
                const plan = plans.find(p => p.barbershop_id === shop.id);
                return (
                  <tr key={shop.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{shop.name}</div>
                      <div className="text-xs text-slate-500">{emails[shop.owner_id]}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={planColors[plan?.plan_name || "essential"]}>
                        {plan?.plan_name?.toUpperCase() || "ESSENTIAL"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={plan?.status || "inactive"} /></td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenDetails(shop)}>
                        <UserCog className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO DE PLANO (O CORAÇÃO DA ALTERAÇÃO MANUAL) */}
      <Dialog open={!!detailShop} onOpenChange={() => setDetailShop(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="text-cyan-400" /> Gestão de Assinatura
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">Cliente Selecionado</p>
              <h3 className="text-lg font-black text-cyan-400">{detailShop?.name}</h3>
              <p className="text-xs text-slate-400">{emails[detailShop?.owner_id]}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Alterar Plano</label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="essential">Essential (R$ 97)</SelectItem>
                    <SelectItem value="growth">Growth (R$ 197)</SelectItem>
                    <SelectItem value="pro">Pro (R$ 397)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Status da Conta</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="active">Ativo (Liberado)</SelectItem>
                    <SelectItem value="suspended">Suspenso (Bloqueado)</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button 
                onClick={handleUpdatePlan} 
                disabled={isUpdating}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
              >
                {isUpdating ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Alterações Manuais
              </Button>
              <Button 
                variant="outline" 
                className="border-slate-800 text-slate-400 hover:text-white"
                onClick={() => handleImpersonate(detailShop)}
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Acessar como Dono
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
