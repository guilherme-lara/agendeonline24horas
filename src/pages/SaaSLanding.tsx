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
  { icon: Bell, title: "Notificações", desc: "Lembre seus clientes via WhatsApp e E-mail automaticamente." },
  { icon: Users, title: "Gestão de Equipe", desc: "Gerencie barbeiros, horários e comissões em um só lugar." },
  { icon: Shield, title: "Dados Seguros", desc: "Infraestrutura profissional com isolamento total por barbearia." },
];

const plans = [
  {
    name: "Essential",
    price: "97",
    period: "/mês",
    desc: "Ideal para profissionais solo",
    features: ["Link de agendamento personalizado", "Dashboard básico (ganhos dia/mês)", "Gestão de 1 barbeiro", "Suporte via E-mail"],
    cta: "Começar Agora",
    popular: false,
  },
  {
    name: "Growth",
    price: "197",
    period: "/mês",
    desc: "Para barbearias em expansão",
    features: [
      "Tudo do Essential",
      "Pagamentos via Pix Online",
      "Lembretes automáticos",
      "Dashboard de faturamento avançado",
      "Até 5 barbeiros",
      "Relatórios financeiros",
    ],
    cta: "Escolher Growth",
    popular: true,
  },
  {
    name: "Pro",
    price: "397",
    period: "/mês",
    desc: "Potência total para o seu negócio",
    features: [
      "Tudo do Growth",
      "Gestão de Estoque Completa",
      "Sistema de CRM e Fidelidade",
      "Relatórios preditivos com IA",
      "Barbeiros ilimitados",
      "Suporte prioritário 24/7",
    ],
    cta: "Quero o Pro",
    popular: false,
  },
];

const planIcons = [Package, Sparkles, Brain];

const testimonials = [
  { name: "Guilherme L.", shop: "Barber Flow", text: "A automação de pagamentos mudou meu negócio. Não perco mais tempo conferindo PIX.", rating: 5 },
  { name: "Rafael M.", shop: "Studio Barber", text: "O dashboard me dá uma clareza absurda de onde está vindo o lucro. Essencial.", rating: 5 },
  { name: "Lucas P.", shop: "Vintage Shop", text: "Meus clientes elogiam a facilidade do agendamento. O sistema é muito rápido.", rating: 5 },
];

const SaaSLanding = () => {
  const navigate = useNavigate();

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_70%)]" />
        <div className="container relative z-10 text-center max-w-5xl px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary mb-10 animate-fade-in">
            <Sparkles className="h-3.5 w-3.5 fill-primary" /> A plataforma mais completa para barbearias
          </div>
          
          <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl font-bold leading-[1.1] mb-8 animate-slide-up">
            Sua barbearia no <br />
            <span className="text-gold-gradient">topo do mercado</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-slide-up duration-700" style={{ animationDelay: "200ms" }}>
            Agendamento 24h, gestão financeira automática e controle total de estoque. 
            A tecnologia que você precisa para focar no que importa: a tesoura.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up duration-1000" style={{ animationDelay: "400ms" }}>
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="gold-gradient text-primary-foreground font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all text-base px-10 py-7 h-auto"
            >
              Criar Minha Barbearia <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={scrollToPricing}
              className="text-base px-10 py-7 h-auto hover:bg-secondary transition-all"
            >
              Ver Planos e Preços
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container py-24 px-4">
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3 font-bold">Tecnologia</p>
          <h2 className="font-display text-4xl sm:text-5xl font-bold">
            Gestão <span className="text-gold-gradient">sem esforço</span>
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-8 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-12 w-12 rounded-xl gold-gradient flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-xl font-bold mb-3">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-secondary/30 py-24 px-4">
        <div className="container">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl font-bold">
              Quem usa <span className="text-gold-gradient">fatura mais</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-md transition-all animate-fade-in"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <Quote className="h-8 w-8 text-primary/10 mb-4" />
                <p className="text-muted-foreground mb-8 text-sm italic leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full gold-gradient flex items-center justify-center font-bold text-primary-foreground text-xs">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.shop}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container py-32 px-4">
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3 font-bold">Investimento</p>
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-6">
            O plano certo para o seu <span className="text-gold-gradient">tamanho</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Recupere o valor do investimento em menos de 3 cortes no mês.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, i) => {
            const Icon = planIcons[i];
            return (
              <div
                key={plan.name}
                className={`relative rounded-3xl border p-10 transition-all duration-500 animate-fade-in ${
                  plan.popular
                    ? "border-primary bg-card shadow-2xl shadow-primary/10 scale-105 z-10"
                    : "border-border bg-card hover:border-primary/30"
                }`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 gold-gradient text-primary-foreground text-[10px] uppercase tracking-widest font-black px-6 py-1.5 rounded-full shadow-lg">
                    Recomendado
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <Icon className={`mx-auto h-10 w-10 mb-4 ${plan.popular ? "text-primary" : "text-muted-foreground/50"}`} />
                  <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-2">{plan.desc}</p>
                  <div className="mt-6 flex items-baseline justify-center gap-1">
                    <span className="text-sm font-bold text-muted-foreground">R$</span>
                    <span className="font-display text-5xl font-extrabold text-primary">{plan.price}</span>
                    <span className="text-xs font-medium text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-10">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => navigate("/auth")}
                  className={`w-full py-6 h-auto font-bold rounded-xl transition-all ${
                    plan.popular
                      ? "gold-gradient text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20"
                      : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container pb-32 px-4">
        <div className="rounded-[2.5rem] border border-primary/20 bg-gradient-to-b from-card to-secondary/20 p-12 sm:p-20 text-center max-w-4xl mx-auto shadow-inner relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-primary/5 rounded-full blur-3xl" />
          <Scissors className="h-12 w-12 text-primary mx-auto mb-8 animate-bounce" />
          <h2 className="font-display text-3xl sm:text-5xl font-bold mb-6">
            Chega de perder tempo com papel e caneta.
          </h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-md mx-auto leading-relaxed">
            Modernize sua barbearia agora e ofereça a melhor experiência para seus clientes.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="gold-gradient text-primary-foreground font-black shadow-2xl shadow-primary/30 hover:scale-105 transition-all text-lg px-12 py-8 h-auto"
          >
            Começar Meu Teste Grátis <ArrowRight className="ml-2 h-6 w-6" />
          </Button>
        </div>
      </section>

      {/* Footer Minimalista */}
      <footer className="container py-12 text-center border-t border-border px-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="font-display font-bold text-sm tracking-tighter">AgendeOnline24Horas</span>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
          Desenvolvido para barbeiros de alta performance &copy; 2024
        </p>
      </footer>
    </div>
  );
};

export default SaaSLanding;
