import { Shield, Check, Package, Sparkles, Star, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openPlanCheckout } from "@/lib/infinitepay-checkout";

const plans = [
  { key: "bronze", name: "Bronze", price: "R$ 49,90", icon: Package },
  { key: "prata", name: "Prata", price: "R$ 79,90", icon: Sparkles, popular: true },
  { key: "ouro", name: "Ouro", price: "R$ 99,90", icon: Star },
];

interface LicenseOverlayProps {
  barbershopId?: string;
}

const LicenseOverlay = ({ barbershopId }: LicenseOverlayProps) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <Lock className="h-10 w-10 text-destructive" />
        </div>

        <div>
          <h1 className="text-2xl font-black font-display text-foreground">Acesso Suspenso</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
            Sua licença expirou. Realize o pagamento para liberar o acesso imediatamente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {plans.map((plan) => (
            <button
              key={plan.key}
              onClick={() => openPlanCheckout(plan.key, barbershopId)}
              className={`rounded-2xl border p-5 text-center transition-all hover:scale-[1.02] ${
                plan.popular
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <plan.icon className={`mx-auto h-6 w-6 mb-2 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-bold text-sm">{plan.name}</h3>
              <p className="text-lg font-black text-foreground mt-1">{plan.price}<span className="text-[10px] text-muted-foreground">/mês</span></p>
              <div className={`mt-3 rounded-xl py-2 text-xs font-bold ${
                plan.popular
                  ? "gold-gradient text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}>
                <ExternalLink className="h-3 w-3 inline mr-1" />
                Assinar
              </div>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Pagamento seguro via InfinitePay · Acesso liberado em minutos
        </p>
      </div>
    </div>
  );
};

export default LicenseOverlay;
