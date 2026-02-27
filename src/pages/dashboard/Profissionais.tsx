import TeamTab from "@/components/TeamTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Profissionais = () => {
  const { barbershop, loading: barberLoading } = useBarbershop();
  const [planName, setPlanName] = useState("essential");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // <-- FUNÇÃO BLINDADA COM TRY/CATCH/FINALLY -->
  const loadPlanData = useCallback(async () => {
    if (!barbershop) return;
    setLoading(true);
    setError(false);

    try {
      const { data, error: fetchError } = await supabase
        .from("saas_plans")
        .select("plan_name")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "active")
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (data) setPlanName(data.plan_name);
      
    } catch (err) {
      console.error("Erro ao carregar plano SaaS:", err);
      setError(true);
    } finally {
      setLoading(false); // A MÁGICA: Desliga o loading em qualquer situação
    }
  }, [barbershop]);

  useEffect(() => {
    loadPlanData();
  }, [loadPlanData]);

  // <-- TELAS DE PROTEÇÃO -->
  if (loading || (barberLoading && !error)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // TELA DE ERRO (Adeus F5!)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Erro ao carregar profissionais</h2>
        <p className="text-sm text-muted-foreground mb-6">Não conseguimos verificar as permissões do seu plano.</p>
        <Button onClick={loadPlanData} className="gold-gradient text-primary-foreground font-semibold px-8">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <TeamTab barbershopId={barbershop.id} planName={planName} />
    </div>
  );
};

export default Profissionais;
