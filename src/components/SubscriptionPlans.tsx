import { useNavigate } from "react-router-dom";
import { Check, Crown, Star, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    id: "silver",
    name: "Silver",
    price: 79.9,
    icon: Star,
    features: ["3 cortes por mês", "Agendamento prioritário", "Desconto em produtos"],
    popular: false,
  },
  {
    id: "gold",
    name: "Gold",
    price: 99.9,
    icon: Crown,
    features: ["1 corte por semana", "Agendamento prioritário", "Desconto em produtos", "Cerveja cortesia"],
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: 149.9,
    icon: Gem,
    features: [
      "1 corte por semana",
      "Barba inclusa",
      "Agendamento VIP",
      "Desconto em produtos",
      "Cerveja cortesia",
      "Sobrancelha inclusa",
    ],
    popular: false,
  },
];

const SubscriptionPlans = () => {
  const navigate = useNavigate();

  return (
    <section className="container py-20">
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Planos Exclusivos</p>
        <h2 className="font-display text-3xl font-bold sm:text-4xl mb-3">
          Assine e <span className="text-gold-gradient">Economize</span>
        </h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Escolha o plano ideal para manter seu visual sempre impecável
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {plans.map((plan, i) => (
          <div
            key={plan.id}
            className={`relative rounded-xl border p-6 transition-all animate-fade-in ${
              plan.popular
                ? "border-primary bg-card shadow-gold scale-[1.02]"
                : "border-border bg-card hover:border-primary/40"
            }`}
            style={{ animationDelay: `${i * 150}ms` }}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 gold-gradient text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                Mais Popular
              </span>
            )}

            <div className="text-center mb-6">
              <plan.icon className={`mx-auto h-8 w-8 mb-3 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              <div className="mt-2">
                <span className="font-display text-3xl font-bold text-primary">
                  R$ {plan.price.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => navigate(`/subscribe/${plan.id}`)}
              className={`w-full font-semibold ${
                plan.popular
                  ? "gold-gradient text-primary-foreground hover:opacity-90 shadow-gold"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Assinar {plan.name}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
};

export { plans };
export default SubscriptionPlans;
