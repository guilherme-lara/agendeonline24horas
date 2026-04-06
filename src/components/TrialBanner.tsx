import { useBarbershop } from "@/hooks/useBarbershop";
import { Rocket, Sparkles } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

const TrialBanner = () => {
  const { barbershop } = useBarbershop() as any;
  const navigate = useNavigate();

  // Support multiple field names for backward compatibility
  const trialEnd = barbershop?.trial_ends_at ||
    barbershop?.trial_end_date ||
    barbershop?.plan_ends_at ||
    barbershop?.expires_at ||
    null;

  // Show trial banner if plan_status is not active/expired AND trial end date exists
  const planStatus = barbershop?.plan_status;
  const isTrial = planStatus === "trialing" ||
    (planStatus === "none" && trialEnd) ||
    (planStatus === "expired" && trialEnd);

  // Also show for any barbershop with a trial_ends_at in the future
  // Handles backfilled data where plan fields may be null
  const hasFutureTrial = trialEnd && new Date(trialEnd) > new Date();

  if (!trialEnd) return null;

  const endDate = parseISO(trialEnd);
  const today = new Date();
  const daysRemaining = differenceInDays(endDate, today);

  // Hide if trial ended more than 0 days ago
  if (daysRemaining <= 0 && !isTrial) return null;
  // Hide if trial ended today or in the past and it's been over 7 days
  if (daysRemaining < -7) return null;

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
    message = "Seu período de teste gratuito terminou. Faça um upgrade para continuar aproveitando.";
    urgency = "expired";
  }

  const borderColor = urgency === "critical" || urgency === "expired"
    ? "border-red-500/30"
    : urgency === "urgent"
      ? "border-orange-500/30"
      : urgency === "warning"
        ? "border-amber-500/30"
        : "border-yellow-500/20";

  const textColor = urgency === "critical" || urgency === "expired"
    ? "text-red-200"
    : "text-yellow-200/90";

  return (
    <div className={`gold-gradient-dark text-primary-foreground rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border ${borderColor} animate-in fade-in duration-300`}>
      <div className="flex items-center gap-4">
        <Sparkles className={`h-8 w-8 ${urgency === "critical" || urgency === "expired" ? "text-red-300" : "text-yellow-300"} ${urgency === "critical" || urgency === "expired" ? "animate-pulse" : ""}`} />
        <div>
          <h3 className="font-black text-lg text-white">Bem-vindo ao seu teste do Plano PRO!</h3>
          <p className={`text-sm ${textColor}`}>{message}</p>
          {hasFutureTrial && daysRemaining <= 30 && daysRemaining > 7 && (
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-yellow-100/60">
              Expira em {daysRemaining} dia{daysRemaining !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
      <Button
        onClick={() => navigate('/subscribe/pro')}
        className="bg-white text-blue-600 hover:bg-gray-100 font-bold h-11 px-6 rounded-xl transition-transform active:scale-95 flex-shrink-0 shadow-lg"
      >
        <Rocket className="h-4 w-4 mr-2" /> Fazer Upgrade Agora
      </Button>
    </div>
  );
};

export default TrialBanner;
