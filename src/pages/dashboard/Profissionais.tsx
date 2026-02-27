import TeamTab from "@/components/TeamTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Users, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Profissionais = () => {
  // Pegamos a barbearia do hook blindado
  const { barbershop, loading: barberLoading, isError: barberError, refetch: refetchBarber } = useBarbershop() as any;

  // --- BUSCA DO PLANO (TANSTACK QUERY) ---
  const { data: planName = "essential", isLoading: loadingPlan, isError: errorPlan, refetch: refetchPlan } = useQuery({
    queryKey: ["saas-plan", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return "essential";

      const { data, error } = await supabase
        .from("saas_plans")
        .select("plan_name")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      return data?.plan_name || "essential";
    },
    enabled: !!barbershop?.id,
    refetchOnWindowFocus: true, // Sincronia ativa ao voltar para a aba
  });

  // Função para tentar carregar tudo novamente
  const handleRetry = () => {
    refetchBarber();
    refetchPlan();
  };

  // --- RENDERS DE PROTEÇÃO ---
  if ((barberLoading || loadingPlan) && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse uppercase tracking-widest font-bold">
          Sincronizando equipe...
        </p>
      </div>
    );
  }

  if ((barberError || errorPlan) && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Erro de sincronização</h2>
        <p className="text-sm text-slate-400 mb-8">
          Não conseguimos verificar as permissões de equipe para o seu plano.
        </p>
        <Button onClick={handleRetry} className="gold-gradient px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <div className="flex items-center gap-4">
            <div className="bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/20">
                <Users className="h-7 w-7 text-cyan-400" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Equipe & Profissionais</h1>
                <p className="text-slate-500 text-sm font-medium">Gerencie os barbeiros e as permissões de acesso ao sistema.</p>
            </div>
        </div>

        {/* Badge de Plano (Dinâmico e Reativo) */}
        <div className="bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Plano Atual</p>
                <p className="text-xs font-black text-white uppercase tracking-widest">{planName}</p>
            </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
        {/* O TeamTab herda a lógica de permissões baseada no planName atualizado em real-time */}
        <TeamTab barbershopId={barbershop.id} planName={planName} />
      </div>

      <p className="text-center text-[10px] text-slate-600 uppercase font-bold mt-8 tracking-widest">
        Dica: Profissionais com acesso ao sistema podem baixar o app para ver a própria agenda.
      </p>
    </div>
  );
};

export default Profissionais;
