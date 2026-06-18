import { useClinic } from "@/hooks/useClinic";
import { Rocket, Sparkles } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";

const TrialBanner = () => {
  const { clinic, refetch } = useClinic() as any;
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const extendTrialMutation = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) return;
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 30);
      const { error } = await supabase
        .from("barbershops")
        .update({ trial_ends_at: newDate.toISOString() })
        .eq("id", clinic.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-clinic"] });
      refetch();
    }
  });

  // Support multiple field names for backward compatibility
  const trialEnd = clinic?.trial_ends_at ||
    clinic?.trial_end_date ||
    clinic?.plan_ends_at ||
    clinic?.expires_at ||
    null;

  // Show trial banner if plan_status is not active/expired AND trial end date exists
  const planStatus = clinic?.plan_status;
  const isTrial = planStatus === "trialing" ||
    (planStatus === "none" && trialEnd) ||
    (planStatus === "expired" && trialEnd);

  // Also show for any clinic with a trial_ends_at in the future
  // Handles backfilled data where plan fields may be null
  const hasFutureTrial = trialEnd && new Date(trialEnd) > new Date();

  if (!trialEnd) return null;

  const endDate = parseISO(trialEnd);
  const today = new Date();
  const daysRemaining = differenceInDays(endDate, today);

  // Hide if trial ended more than 0 days ago (unless Admin)
  if (daysRemaining <= 0 && !isTrial && !isAdmin) return null;
  // Hide if trial ended today or in the past and it's been over 7 days (unless Admin)
  if (daysRemaining < -7 && !isAdmin) return null;

  // Only show for 0-30 day window (entire trial period)
  if (daysRemaining > 30 && planStatus !== "trialing") return null;

  let message;
  let urgency;
  if (daysRemaining > 14) {
    message = `Seu teste grátis do Plano PRO termina em ${daysRemaining} dias. Explore todos os recursos disponíveis.`;
    urgency = "normal";
  } else if (daysRemaining > 7) {
    message = `Seu teste grátis do Plano PRO termina em ${daysRemaining} dias. Configure seu negócio e aproveite todos os recursos.`;
    urgency = "normal";
  } else if (daysRemaining > 3) {
    message = `Seu teste grátis do Plano PRO termina em ${daysRemaining} dias.`;
    urgency = "warning";
  } else if (daysRemaining > 1) {
    message = `Seu teste grátis do Plano PRO termina em ${daysRemaining} dias. Configurar seu negócio e aproveite.`;
    urgency = "warning";
  } else if (daysRemaining === 1) {
    message = "Seu teste grátis termina amanhã! Não perca os recursos PRO.";
    urgency = "urgent";
  } else if (daysRemaining === 0) {
    message = "Seu teste gratuito vence hoje! Faça upgrade para não perder acesso.";
    urgency = "critical";
  } else {
    message = isAdmin 
      ? `Atenção (Modo Suporte): O trial deste cliente acabou há ${Math.abs(daysRemaining)} dias. O sistema está bloqueado para ele.`
      : "Seu período de teste gratuito terminou. Faça um upgrade para continuar aproveitando.";
    urgency = "expired";
  }

  const borderColor = urgency === "critical" || urgency === "expired"
    ? "border-system-red/30"
    : "border-black/5 dark:border-white/10";

  const textColor = urgency === "critical" || urgency === "expired"
    ? "text-system-red dark:text-system-red"
    : "text-zinc-600 dark:text-zinc-400";

  return (
    <div className={`bg-white/80 dark:bg-black/50 backdrop-blur-md text-zinc-900 dark:text-white rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm border ${borderColor} animate-in fade-in duration-300`}>
      <div className="flex items-center gap-4">
        <Sparkles className={`h-8 w-8 ${urgency === "critical" || urgency === "expired" ? "text-system-red" : "text-system-blue"} ${urgency === "critical" || urgency === "expired" ? "animate-pulse" : ""}`} />
        <div>
          <h3 className="font-bold text-lg">Trial do Plano PRO</h3>
          <p className={`text-sm ${textColor}`}>{message}</p>
          {hasFutureTrial && daysRemaining <= 30 && daysRemaining > 7 && (
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-zinc-500">
              Expira em {daysRemaining} dia{daysRemaining !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {isAdmin && daysRemaining <= 0 && (
          <Button
            onClick={() => extendTrialMutation.mutate()}
            disabled={extendTrialMutation.isPending}
            variant="outline"
            className="rounded-xl font-bold h-11 px-6 transition-all flex-shrink-0"
          >
            {extendTrialMutation.isPending ? "Processando..." : "Estender Trial (+30d)"}
          </Button>
        )}
        <Button
          onClick={() => navigate('/subscribe/pro')}
          className="bg-system-blue text-white hover:bg-system-blue/90 font-bold h-11 px-6 rounded-xl transition-all flex-shrink-0 shadow-sm"
        >
          <Rocket className="h-4 w-4 mr-2" /> {isAdmin ? "Ver Planos" : "Fazer Upgrade Agora"}
        </Button>
      </div>
    </div>
  );
};

export default TrialBanner;
