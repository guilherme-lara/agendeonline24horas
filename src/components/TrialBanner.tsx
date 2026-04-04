import { useBarbershop } from "@/hooks/useBarbershop";
import { Rocket, Sparkles } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

const TrialBanner = () => {
  const { barbershop } = useBarbershop() as any;
  const navigate = useNavigate();

  const isTrial = barbershop?.subscription_status === 'trialing';
  const trialEndDate = barbershop?.trial_end_date;

  if (!isTrial || !trialEndDate) {
    return null;
  }

  const endDate = parseISO(trialEndDate);
  const today = new Date();
  const daysRemaining = differenceInDays(endDate, today);

  let message;
  if (daysRemaining > 1) {
    message = `Seu teste grátis do Plano PRO termina em ${daysRemaining} dias.`;
  } else if (daysRemaining === 1) {
    message = "Seu teste grátis termina amanhã! Não perca os recursos PRO.";
  } else {
    message = "Seu período de teste gratuito terminou. Faça um upgrade para continuar aproveitando.";
  }

  return (
    <div className="gold-gradient-dark text-primary-foreground rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Sparkles className="h-8 w-8 text-yellow-300" />
        <div>
          <h3 className="font-black text-lg text-white">Bem-vindo ao seu teste do Plano PRO!</h3>
          <p className="text-sm text-yellow-200/90">{message}</p>
        </div>
      </div>
      <Button 
        onClick={() => navigate('/subscribe/pro')} // Ponto 3: Rota corrigida
        className="bg-white text-blue-600 hover:bg-gray-100 font-bold h-11 px-6 rounded-xl transition-transform active:scale-95 flex-shrink-0 shadow-lg"
      >
        <Rocket className="h-4 w-4 mr-2" /> Fazer Upgrade Agora
      </Button>
    </div>
  );
};

export default TrialBanner;
