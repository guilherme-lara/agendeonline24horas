import TeamTab from "@/components/TeamTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Users, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Profissionais = () => {
  const { barbershop, loading: barberLoading, isError: barberError, refetch: refetchBarber } = useBarbershop() as any;
  const queryEnabled = !!barbershop?.id;

  const { data: planName = "essential", isLoading: loadingPlan, isError: errorPlan, refetch: refetchPlan } = useQuery({
    queryKey: ["saas-plan", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return "essential";
      const { data, error } = await supabase.from("saas_plans").select("plan_name").eq("barbershop_id", barbershop.id).eq("status", "active").maybeSingle();
      if (error) throw error;
      return data?.plan_name || "essential";
    },
    enabled: !!barbershop?.id,
  });

  const handleRetry = () => { refetchBarber(); refetchPlan(); };

  if ((barberLoading || loadingPlan) && queryEnabled && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Sincronizando equipe...</p>
      </div>
    );
  }

  if ((barberError || errorPlan) && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronização</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos verificar as permissões de equipe para o seu plano.</p>
        <Button onClick={handleRetry} className="gold-gradient text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8">
        <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-2xl border border-primary/20">
                <Users className="h-7 w-7 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-foreground tracking-tight font-display">Equipe & Profissionais</h1>
                <p className="text-muted-foreground text-sm font-medium">Gerencie os profissionais e as permissões de acesso ao sistema.</p>
            </div>
        </div>
        <div className="bg-card border border-border px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Plano Atual</p>
                <p className="text-xs font-black text-foreground uppercase tracking-widest">{planName}</p>
            </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 shadow-card">
        <TeamTab barbershopId={barbershop.id} planName={planName} />
      </div>

      <p className="text-center text-[10px] text-muted-foreground/50 uppercase font-bold mt-8 tracking-widest">
        Dica: Profissionais com acesso ao sistema podem baixar o app para ver a própria agenda.
      </p>
    </div>
  );
};

export default Profissionais;