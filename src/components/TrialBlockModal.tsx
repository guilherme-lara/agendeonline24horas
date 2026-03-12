import { useNavigate } from "react-router-dom";
import { Shield, ArrowRight, Check, Package, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const plans = [
  { name: "Bronze", price: "R$ 49,90", features: ["Agenda online 24h", "1 profissional", "Dashboard básico"], icon: Package },
  { name: "Prata", price: "R$ 79,90", features: ["Checkout Pix", "Até 5 profissionais", "Lembretes"], icon: Sparkles, popular: true },
  { name: "Ouro", price: "R$ 99,90", features: ["Estoque completo", "Profissionais ilimitados", "Suporte VIP"], icon: Star },
];

interface TrialBlockModalProps {
  open: boolean;
}

const TrialBlockModal = ({ open }: TrialBlockModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl rounded-3xl [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl gold-gradient flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <DialogTitle className="text-2xl font-black font-display">Seu período de teste expirou</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Escolha um plano para continuar usando a plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 text-center transition-all ${
                plan.popular
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-border"
              }`}
            >
              <plan.icon className={`mx-auto h-8 w-8 mb-3 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <p className="text-2xl font-black text-foreground mt-2">{plan.price}<span className="text-xs text-muted-foreground">/mês</span></p>
              <ul className="mt-4 space-y-2 text-left">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => {
                  // TODO: Replace with InfinitePay checkout handle when available
                  navigate("/");
                }}
                className={`w-full mt-4 rounded-xl font-bold ${
                  plan.popular
                    ? "gold-gradient text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                }`}
              >
                Assinar
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4 font-bold uppercase tracking-widest">
          Dúvidas? Entre em contato pelo WhatsApp
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default TrialBlockModal;
