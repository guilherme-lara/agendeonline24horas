import { useNavigate } from "react-router-dom";
import {
  CalendarDays, BarChart3, CreditCard, Bell, Users, Shield,
  Sparkles, Package, Brain, Check, ArrowRight, Scissors, Star, Quote, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  { icon: Globe, title: "Link de Agendamento", desc: "Seus clientes agendam 24h direto pelo link exclusivo da sua barbearia." },
  { icon: BarChart3, title: "Dashboard Inteligente", desc: "Acompanhe faturamento, cortes e métricas em tempo real em painéis dourados." },
  { icon: CreditCard, title: "Pagamentos Integrados", desc: "Receba via Pix e Cartão diretamente na plataforma de forma segura." },
  { icon: Bell, title: "Notificações Automáticas", desc: "Lembre seus clientes via WhatsApp e E-mail, reduzindo faltas." },
  { icon: Users, title: "Gestão de Equipe", desc: "Gerencie barbeiros, horários e comissões automáticas em um só lugar." },
  { icon: Shield, title: "Dados Seguros", desc: "Infraestrutura cloud profissional com isolamento total por barbearia." },
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
    color: "slate"
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
    ],
    cta: "Escolher Plano Growth",
    popular: true,
    color: "gold"
  },
  {
    name: "Pro",
    price: "397",
    period: "/mês",
    desc: "Potência total e automação",
    features: [
      "Tudo do Growth",
      "Gestão de Estoque Completa",
      "Sistema de CRM e Fidelidade",
      "Relatórios preditivos com IA",
      "Barbeiros Ilimitados",
    ],
    cta: "Acessar Plano Pro",
    popular: false,
    color: "gold-dark"
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-x-hidden">
      {/* --- HERO SECTION --- */}
      <section className="relative pt-24 pb-32 lg:pt-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_70%)] -z-10" />
        
        <div className="container px-6 text-center max-w-5xl relative z-10">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-8 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em]">
            <Sparkles className="h-3 w-3 mr-2 fill-primary" /> A plataforma mais completa para barbearias
          </Badge>
          
          <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.0] mb-8">
            Sua barbearia no <br />
            <span className="text-gold-gradient">topo do mercado.</span>
          </h1>
          
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
            Agendamento digital 24h, gestão financeira automática e controle total de estoque. 
            A tecnologia que você precisa para focar no que importa: a tesoura.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto h-16 px-10 gold-gradient text-primary-foreground font-black rounded-2xl shadow-2xl shadow-primary/20 text-lg transition-all active:scale-95 group"
            >
              Criar Minha Barbearia <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              onClick={scrollToPricing}
              className="w-full sm:w-auto h-16 px-10 border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary font-bold rounded-2xl transition-all"
            >
              Ver Planos e Preços
            </Button>
          </div>
        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <section className="container py-24 px-6 relative">
        <div className="absolute right-0 top-1/4 w-96 h-96 bg-primary/5 blur-[120px] rounded-full" />
        
        <div className="text-center mb-20">
          <Badge variant="outline" className="border-border text-muted-foreground font-bold uppercase text-[9px] tracking-widest px-3 py-1 mb-4">Tecnologia</Badge>
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
             Gestão <span className="text-gold-gradient">sem esforço</span>
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-border bg-card p-8 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 backdrop-blur-sm"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-12 w-12 rounded-2xl gold-gradient flex items-center justify-center mb-6 group-hover:scale-110 transition-all">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-xl font-bold mb-3 racking-tight">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- TESTIMONIALS --- */}
      <section className="bg-secondary/30 py-24 border-y border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="container px-6 relative">
            <h2 className="text-center text-sm font-black uppercase text-muted-foreground tracking-[0.4em] mb-16">Quem usa <span className="text-glow-gold">fatura mais</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {testimonials.map((t, i) => (
                    <div key={t.name} className="bg-card border border-border p-8 rounded-2xl shadow-xl backdrop-blur-md">
                        <div className="flex gap-1 mb-6">
                          {Array.from({ length: t.rating }).map((_, j) => (
                            <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                          ))}
                        </div>
                        <Quote className="h-8 w-8 text-primary/10 mb-4" />
                        <p className="text-muted-foreground mb-8 italic text-sm leading-relaxed font-medium">"{t.text}"</p>
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl gold-gradient flex items-center justify-center font-black text-primary-foreground text-xs">
                                {t.name[0]}
                            </div>
                            <div>
                                <p className="font-bold text-sm">{t.name}</p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{t.shop}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section id="pricing" className="container py-32 px-6">
        <div className="text-center mb-20">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-4 px-3 py-1 text-[10px] font-black uppercase tracking-widest">Investimento</Badge>
          <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            O plano certo para o seu <span className="text-gold-gradient">tamanho</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto font-medium leading-relaxed">
            Recupere o valor do investimento em menos de 3 cortes no mês. Sem fidelidade.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, i) => {
            const Icon = planIcons[i];
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-10 transition-all duration-500 flex flex-col ${
                  plan.popular
                    ? "border-primary bg-card shadow-2xl shadow-primary/10 scale-105 z-10"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 gold-gradient text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full shadow-lg">
                    Recomendado
                  </div>
                )}
                
                <div className="mb-8">
                  <Icon className={`mx-auto h-10 w-10 mb-6 ${plan.popular ? "text-primary" : "text-muted-foreground/50"}`} />
                  <h3 className="font-display text-2xl font-bold tracking-tight">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-2 font-bold uppercase tracking-widest">{plan.desc}</p>
                  
                  <div className="mt-8 flex items-baseline gap-1 justify-center">
                    <span className="text-sm font-bold text-muted-foreground">R$</span>
                    <span className="font-display text-6xl font-extrabold text-foreground tracking-tighter">
                      {plan.price}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{plan.period}</span>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm font-medium">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => navigate("/login")}
                  className={`w-full h-14 font-black rounded-xl transition-all shadow-xl ${
                    plan.popular
                      ? "gold-gradient text-primary-foreground shadow-primary/20 hover:opacity-90"
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

      {/* --- FINAL CALL TO ACTION --- */}
      <section className="container py-32 px-6">
        <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/30 p-12 sm:p-24 text-center max-w-5xl mx-auto shadow-2xl overflow-hidden backdrop-blur-xl relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.05),transparent_70%)] -z-10" />
          
          <div className="relative z-10">
            <Scissors className="h-16 w-16 text-primary mx-auto mb-10" />
            <h2 className="font-display text-4xl sm:text-6xl font-bold mb-6 tracking-tight leading-none">
              Chega de perder tempo com papel e caneta.
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-lg mx-auto font-medium leading-relaxed">
              Modernize sua barbearia agora e ofereça a melhor experiência para seus clientes.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              className="gold-gradient text-primary-foreground font-black shadow-2xl shadow-primary/30 h-16 px-12 rounded-2xl text-lg transition-all active:scale-95"
            >
              Começar Meu Teste Grátis <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="container py-12 text-center border-t border-border px-6">
        <div className="flex items-center justify-center gap-3 mb-4Opacity-50">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="font-display font-bold text-sm tracking-tighter text-foreground">AgendeOnline24Horas</span>
        </div>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
          Plataforma para barbeiros de alta performance &copy; 2024
        </p>
      </footer>
    </div>
  );
};

export default SaaSLanding;
