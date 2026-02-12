import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, DollarSign, CalendarDays, Loader2, LogOut,
  Eye, Ban, ArrowUpDown, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
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

interface Profile {
  user_id: string;
  name: string;
}

const planPrices: Record<string, number> = {
  essential: 97,
  growth: 197,
  pro: 397,
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

const SuperAdmin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const [shops, setShops] = useState<BarbershopRow[]>([]);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailShop, setDetailShop] = useState<BarbershopRow | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) return;

    Promise.all([
      supabase.from("barbershops").select("*").order("created_at", { ascending: false }),
      supabase.from("saas_plans").select("*"),
      supabase.from("appointments").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, name"),
    ]).then(([shopsRes, plansRes, apptsRes, profilesRes]) => {
      setShops((shopsRes.data as BarbershopRow[]) || []);
      setPlans((plansRes.data as SaasPlan[]) || []);
      setAppointments((apptsRes.data as Appointment[]) || []);
      setProfiles((profilesRes.data as Profile[]) || []);
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
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1a" }}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-3">Acesso Negado</h2>
          <p className="text-sm text-slate-400 mb-6">Você não tem permissão para acessar este painel.</p>
          <Button onClick={() => navigate("/")} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
            Voltar ao Início
          </Button>
        </div>
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.status === "active");
  const mrr = activePlans.reduce((sum, p) => sum + Number(p.price), 0);
  const last24h = subHours(new Date(), 24).toISOString();
  const recentAppointments = appointments.filter((a) => a.created_at >= last24h);

  const getPlanForShop = (shopId: string) => plans.find((p) => p.barbershop_id === shopId);
  const getOwnerEmail = (ownerId: string) => {
    const profile = profiles.find((p) => p.user_id === ownerId);
    return profile?.name || ownerId.slice(0, 8) + "...";
  };

  const handleSuspend = async (shopId: string) => {
    const plan = getPlanForShop(shopId);
    if (!plan) return;
    const newStatus = plan.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("saas_plans").update({ status: newStatus }).eq("id", plan.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, status: newStatus } : p));
      toast({ title: newStatus === "active" ? "Acesso reativado" : "Acesso suspenso" });
    }
  };

  const handleChangePlan = async (shopId: string, newPlan: string) => {
    const plan = getPlanForShop(shopId);
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
      toast({ title: `Plano alterado para ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}` });
    }
  };

  const shopAppointments = (shopId: string) => appointments.filter((a) => a.barbershop_id === shopId);
  const shopRevenue = (shopId: string) =>
    shopAppointments(shopId)
      .filter((a) => a.status !== "cancelled")
      .reduce((s, a) => s + Number(a.price), 0);

  const stats = [
    { label: "Total Barbearias", value: shops.length, icon: Building2, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    { label: "Assinantes Ativos", value: activePlans.length, icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "MRR", value: `R$ ${mrr.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
    { label: "Agendamentos (24h)", value: recentAppointments.length, icon: CalendarDays, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0a0f1a 0%, #0d1321 100%)" }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400 mb-1">Command Center</p>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
              Super Admin
            </h1>
            <p className="text-sm text-slate-500">
              {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {stats.map((stat) => (
                <div key={stat.label} className={`rounded-lg border p-5 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color} mb-3`} />
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Tenant Table */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white mb-1">Gestão de Barbearias</h2>
              <p className="text-xs text-slate-500">Gerencie todos os tenants da plataforma</p>
            </div>

            {shops.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-10">Nenhuma barbearia cadastrada.</p>
            ) : (
              <div className="rounded-lg border border-slate-700/50 overflow-hidden" style={{ background: "rgba(15, 23, 42, 0.6)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50" style={{ background: "rgba(15, 23, 42, 0.8)" }}>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">Barbearia</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400 hidden sm:table-cell">Dono</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">Plano</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400 hidden md:table-cell">Expiração</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shops.map((shop) => {
                        const plan = getPlanForShop(shop.id);
                        return (
                          <tr key={shop.id} className="border-t border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-white">{shop.name}</p>
                              <p className="text-xs text-slate-500">/{shop.slug}</p>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-slate-400">
                              {getOwnerEmail(shop.owner_id)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-cyan-400 font-medium capitalize">
                                {plan?.plan_name || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                              {plan?.expires_at
                                ? format(new Date(plan.expires_at), "dd/MM/yyyy")
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {plan ? statusBadge(plan.status) : <Badge variant="outline">—</Badge>}
                            </td>
                            <td className="px-4 py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-400 hover:text-white hover:bg-slate-700"
                                  >
                                    Ações <ChevronDown className="ml-1 h-3.5 w-3.5" />
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
                                    onClick={() => handleSuspend(shop.id)}
                                    className="hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    {plan?.status === "active" ? "Suspender" : "Reativar"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangePlan(shop.id, "essential")}
                                    className="hover:bg-slate-800 cursor-pointer"
                                  >
                                    <ArrowUpDown className="mr-2 h-4 w-4" /> Essential (R$97)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangePlan(shop.id, "growth")}
                                    className="hover:bg-slate-800 cursor-pointer"
                                  >
                                    <ArrowUpDown className="mr-2 h-4 w-4" /> Growth (R$197)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangePlan(shop.id, "pro")}
                                    className="hover:bg-slate-800 cursor-pointer"
                                  >
                                    <ArrowUpDown className="mr-2 h-4 w-4" /> Pro (R$397)
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
              <div>
                <p className="text-xs text-slate-400 mb-1">Slug</p>
                <p className="text-sm text-slate-200">/agendamentos/{detailShop.slug}</p>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
