import { useNavigate } from "react-router-dom";
import {
  CalendarDays, BarChart3, CreditCard, Bell, Users, Shield,
  Sparkles, Package, Brain, Check, ArrowRight, Scissors, Star, Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: CalendarDays, title: "Agendamento Online", desc: "Seus clientes agendam 24h direto pelo link exclusivo da sua barbearia." },
  { icon: BarChart3, title: "Dashboard Inteligente", desc: "Acompanhe faturamento, cortes e métricas em tempo real." },
  { icon: CreditCard, title: "Pagamentos Integrados", desc: "Receba via Pix e Cartão diretamente na plataforma." },
  { icon: Bell, title: "Notificações", desc: "Lembre seus clientes via Telegram e E-mail automaticamente." },
  { icon: Users, title: "Gestão de Equipe", desc: "Gerencie barbeiros, horários e comissões em um só lugar." },
  { icon: Shield, title: "Dados Seguros", desc: "Infraestrutura profissional com isolamento total por barbearia." },
];

const plans = [
  {
    name: "Essential",
    price: "97",
    period: "/mês",
    desc: "Para quem está começando",
    features: ["Agendamento manual", "Dashboard básico (ganhos dia/mês)", "1 barbeiro", "Link personalizado"],
    cta: "Começar Agora",
    popular: false,
  },
  {
    name: "Growth",
    price: "197",
    period: "/mês",
    desc: "Para barbearias em crescimento",
    features: [
      "Tudo do Essential",
      "Pagamento via Pix/Cartão",
      "Notificações Telegram/E-mail",
      "Dashboard avançado",
      "Até 5 barbeiros",
      "Relatórios semanais",
    ],
    cta: "Escolher Growth",
    popular: true,
  },
  {
    name: "Pro",
    price: "397",
    period: "/mês",
    desc: "Para redes e barbearias premium",
    features: [
      "Tudo do Growth",
      "Gestão de Estoque",
      "CRM e Fidelidade",
      "Relatórios com IA",
      "Barbeiros ilimitados",
      "Suporte prioritário",
    ],
    cta: "Quero o Pro",
    popular: false,
  },
];

const planIcons = [Package, Sparkles, Brain];

const testimonials = [
  { name: "Guilherme S.", shop: "Barbearia do Gui", text: "Triplicamos os agendamentos no primeiro mês. A plataforma é incrível.", rating: 5 },
  { name: "Rafael M.", shop: "Studio Rafael", text: "O dashboard me dá controle total sobre o faturamento. Recomendo demais!", rating: 5 },
  { name: "Lucas P.", shop: "LP Barber", text: "Meus clientes adoram o link de agendamento. Profissional e elegante.", rating: 5 },
];

const SaaSLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(40_92%_52%/0.08),transparent_60%)]" />
        <div className="container relative z-10 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-8 animate-fade-in">
            <Sparkles className="h-3.5 w-3.5" /> Plataforma #1 para Barbearias
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6 animate-slide-up">
            Sua barbearia no{" "}
            <span className="text-gold-gradient">próximo nível</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "100ms" }}>
            Agendamento online, dashboard inteligente e gestão completa.
            Tudo que você precisa para escalar seu negócio.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: "200ms" }}>
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="gold-gradient text-primary-foreground font-semibold shadow-gold hover:opacity-90 text-base px-8 py-6"
            >
              Criar Minha Barbearia <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="text-base px-8 py-6"
            >
              Ver Planos
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Funcionalidades</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            Tudo em <span className="text-gold-gradient">uma plataforma</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-all animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="h-10 w-10 rounded-lg gold-gradient flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="container py-20">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Depoimentos</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            Quem usa, <span className="text-gold-gradient">recomenda</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className="rounded-xl border border-border bg-card p-6 animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <Quote className="h-6 w-6 text-primary/40 mb-4" />
              <p className="text-sm text-muted-foreground mb-4 italic">"{t.text}"</p>
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-3.5 w-3.5 fill-primary text-primary" />
                ))}
              </div>
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.shop}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container py-20">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Planos</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
            Escolha o plano <span className="text-gold-gradient">ideal</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Comece grátis por 7 dias. Cancele quando quiser.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const Icon = planIcons[i];
            return (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-8 transition-all animate-fade-in ${
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
                  <Icon className={`mx-auto h-8 w-8 mb-3 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{plan.desc}</p>
                  <div className="mt-4">
                    <span className="text-xs text-muted-foreground">R$ </span>
                    <span className="font-display text-4xl font-bold text-primary">{plan.price}</span>
                    <span className="text-xs text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate("/auth")}
                  className={`w-full font-semibold ${
                    plan.popular
                      ? "gold-gradient text-primary-foreground hover:opacity-90 shadow-gold"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="container pb-20">
        <div className="rounded-2xl border border-primary/20 bg-card p-10 sm:p-16 text-center max-w-3xl mx-auto">
          <Scissors className="h-10 w-10 text-primary mx-auto mb-6" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-4">
            Pronto para transformar sua barbearia?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Junte-se a centenas de barbearias que já estão faturando mais com nossa plataforma.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="gold-gradient text-primary-foreground font-semibold shadow-gold hover:opacity-90 text-base px-10 py-6"
          >
            Começar Gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SaaSLanding;
