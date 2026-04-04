import { useBarbershop } from "@/hooks/useBarbershop";
import { Rocket } from "lucide-react";
import { format, parseISO } from "date-fns";
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

  const formattedEndDate = format(parseISO(trialEndDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
      <div className="flex items-center gap-4">
        <Rocket className="h-8 w-8" />
        <div>
          <h3 className="font-black text-lg">Você está no Plano PRO!</h3>
          <p className="text-sm opacity-90">Seu período de teste gratuito termina em <strong>{formattedEndDate}</strong>.</p>
        </div>
      </div>
      <Button 
        onClick={() => navigate('/subscribe')}
        className="bg-white text-blue-600 hover:bg-gray-100 font-bold h-11 px-6 rounded-xl transition-transform active:scale-95 flex-shrink-0"
      >
        Ver Planos
      </Button>
    </div>
  );
};

export default TrialBanner;
