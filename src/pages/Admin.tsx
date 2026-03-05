import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { 
  DollarSign, Users, Crown, Loader2, LogOut, AlertTriangle, RefreshCw, BarChart3, Search 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";

interface Subscriber {
  id: string;
  name: string;
  phone: string;
  plan: string;
  plan_price: number;
  status: string;
  start_date: string;
  created_at: string;
}

const planLabel: Record<string, string> = {
  silver: "Silver",
  gold: "Gold",
  premium: "Premium",
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  inactive: { label: "Pendente", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  cancelled: { label: "Cancelado", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // --- BUSCA DE ASSINANTES (TANSTACK QUERY) ---
  const { data: subscribers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase
        .from("subscribers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Subscriber[];
    },
    enabled: !!user && isAdmin,
  });

  // --- CÁLCULOS DE KPI ---
  const stats = useMemo(() => {
    const active = subscribers.filter((s) => s.status === "active");
    const revenue = active.reduce((sum, s) => sum + Number(s.plan_price || 0), 0);

    return [
      { label: "Assinantes Ativos", value: active.length, icon: Users, color: "text-cyan-400", bg: "bg-cyan-500/10" },
      { label: "MRR (Receita)", value: `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
      { label: "Base Total", value: subscribers.length, icon: Crown, color: "text-amber-400", bg: "bg-amber-500/10" },
    ];
  }, [subscribers]);

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.phone.includes(searchTerm)
    );
  }, [subscribers, searchTerm]);

  // --- PROTEÇÃO DE ACESSO ---
  if (authLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      <p className="text-xs text-slate-500 animate-pulse font-bold uppercase tracking-widest">Validando credenciais...</p>
    </div>
  );

  if (!user || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="bg-red-500/10 p-4 rounded-full mb-6">
            <AlertTriangle className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Acesso Negado</h2>
        <p className="text-slate-400 text-sm mb-8 max-w-xs">Este terminal é restrito a administradores do sistema.</p>
        <Button onClick={() => navigate("/")} variant="outline" className="border-slate-800 text-slate-400 hover:text-white">Voltar ao Início</Button>
      </div>
    );
  }

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Falha na Sincronia</h2>
      <p className="text-sm text-slate-400 mb-8 px-6">Não conseguimos conectar à base de assinantes.</p>
      <Button onClick={() => refetch()} className="gold-gradient px-8 font-bold">
        <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
      </Button>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      {/* HEADER PREMIUM */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <div className="h-8 w-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20">
                <Crown className="h-5 w-5 text-amber-500" />
             </div>
             <h1 className="text-3xl font-black text-white tracking-tight">SaaS Central Admin</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} &bull; Controle Global de Assinaturas
          </p>
        </div>
        <Button variant="ghost" onClick={signOut} className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 font-bold transition-all">
          <LogOut className="h-4 w-4 mr-2" /> Encerrar Sessão
        </Button>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl hover:border-slate-700 transition-all">
            <div className={`h-10 w-10 ${stat.bg} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <p className="text-3xl font-black text-white tracking-tighter">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* SEARCH AND TABLE */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-400" /> Gestão de Assinantes
            </h2>
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input 
                    placeholder="Nome ou telefone..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-950 border-slate-800 pl-10 h-10 text-xs text-white" 
                />
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950/50 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-left">Assinante</th>
                <th className="px-6 py-4 text-left hidden sm:table-cell">Contato</th>
                <th className="px-6 py-4 text-left">Plano</th>
                <th className="px-6 py-4 text-left hidden sm:table-cell">Ticket</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredSubscribers.map((s) => {
                const st = statusConfig[s.status] || statusConfig.inactive;
                return (
                  <tr key={s.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4">
                        <p className="font-bold text-slate-200">{s.name}</p>
                        <p className="text-[10px] text-slate-600">Desde {format(parseISO(s.created_at), "dd/MM/yyyy")}</p>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell font-mono text-slate-400">{s.phone}</td>
                    <td className="px-6 py-4">
                      <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px] font-black uppercase">
                        {planLabel[s.plan] || s.plan}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell font-black text-slate-200">
                      R$ {Number(s.plan_price).toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-6 py-4">
                        <Badge className={`${st.cls} border font-black text-[9px] uppercase px-2 py-0.5`}>
                            {st.label}
                        </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-slate-500 hover:text-white">Gerenciar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSubscribers.length === 0 && (
            <div className="py-20 text-center">
                <Users className="h-10 w-10 text-slate-800 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Nenhum assinante encontrado para esta busca.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
