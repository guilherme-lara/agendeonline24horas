import { useNavigate } from "react-router-dom";
import { openPlanCheckout } from "@/lib/infinitepay-checkout";
import {
  CalendarDays, BarChart3, CreditCard, Bell, Users, Shield,
  Check, ArrowRight, Sparkles, Star, Clock,
  TrendingUp, MessageCircleOff, Wallet,
  Scissors, Brush, Palette, Fingerprint, HeartPulse,
  ChevronRight, Leaf, Flower2, Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── PROBLEMA → SOLUÇÃO ───
const painPoints = [
  { icon: Clock, title: "Fim dos furos na agenda", subtitle: "Sinal via Pix obrigatório", desc: "Cobramos um sinal no momento do agendamento. Seu cliente se compromete e a no-show cai a praticamente zero." },
  { icon: MessageCircleOff, title: "Adeus ao caos do WhatsApp", subtitle: "Agendamento autônomo 24h", desc: "Seu cliente escolhe serviço, profissional e horário sozinho — sem troca de mensagens, sem erros humanos." },
  { icon: Wallet, title: "Gestão financeira que fecha", subtitle: "Comissões automáticas", desc: "Faturamento diário, semanal e mensal claros. Comissões calculadas e distribuídas sem planilha." },
  { icon: TrendingUp, title: "Escala sem aumentar a equipe", subtitle: "1 a 30 profissionais", desc: "Adicione sedes, organize turnos e acompanhe tudo em tempo real — sem contratar gerente para isso." },
];

const niches = [
  { icon: HeartPulse, title: "Clínicas de Estética", desc: "Procedimentos faciais e corporais com agenda controlada e sinal de garantia." },
  { icon: Flower2, title: "Salões de Beleza", desc: "Corte, cor, tratamentos — gerencie stylists e comissões em um único painel." },
  { icon: Brush, title: "Studios Premium", desc: "Experiência impecável de ponta a ponta com confirmação automática por Pix." },
  { icon: Palette, title: "Esmalterias & Nail Design", desc: "Agenda otimizada, pacotes mensais e pagamento antecipado para sua arte." },
  { icon: Leaf, title: "Spas & Bem-Estar", desc: "Massagens, terapias e rituais com fluxo de cliente refinado e tranquilo." },
  { icon: Fingerprint, title: "Estúdios de Tatuagem", desc: "Sessões, orçamentos e portfólio integrados ao agendamento com sinal." },
];

const featureBenefits = [
  { icon: CalendarDays, title: "Agenda online 24h", desc: "Link personalizado para o seu negócio. Bloqueio automático de horários conflitantes." },
  { icon: CreditCard, title: "Pix antecipado", desc: "Cobre sinal ou valor integral via Pix com confirmação instantânea pela InfinitePay." },
  { icon: BarChart3, title: "Relatórios reais", desc: "Receita, ticket médio, ocupação e projeções. Decida com dados, não no achismo." },
  { icon: Bell, title: "Lembretes automáticos", desc: "Notificações por WhatsApp e e-mail reduzem faltas em até 80%, sem esforço manual." },
  { icon: Users, title: "Equipe & comissões", desc: "Cadastre profissionais, defina splits e deixe o sistema calcular tudo automaticamente." },
  { icon: Shield, title: "Dados protegidos", desc: "Infraestrutura em nuvem com isolamento por negócio e criptografia em trânsito." },
];

const plans = [
  { name: "Essencial", price: "49", cents: ",90", period: "/mês", desc: "Para quem está migrando do caderno pro digital", features: ["Agenda online 24h", "Link personalizado", "Dashboard de faturamento", "1 profissional", "Suporte por e-mail"], cta: "Começar grátis", popular: false },
  { name: "Business", price: "79", cents: ",90", period: "/mês", desc: "O plano mais escolhido por salões e clínicas", features: ["Tudo do Essencial", "Sinal via Pix anti-falta", "Lembretes WhatsApp + e-mail", "Financeiro completo + projeções", "Até 5 profissionais", "Comissões com split automático", "Suporte prioritário"], cta: "Testar Business", popular: true },
  { name: "Enterprise", price: "99", cents: ",90", period: "/mês", desc: "Controle total e profissionais ilimitados", features: ["Tudo do Business", "Profissionais ilimitados", "Estoque e insumos", "Pacotes e combos com validade", "Relatórios avançados + exportação", "Suporte VIP via WhatsApp"], cta: "Falar com consultor", popular: false },
];

const testimonials = [
  { name: "Camila R.", shop: "Studio Camila Costa", text: "Gerencio 6 profissionais sozinha. Agenda, comissão e financeiro automáticos. Antes eu levava 3 horas por dia nisso.", rating: 5 },
  { name: "Ricardo M.", shop: "Barber Club SP", text: "Antes perdia 8 horários por semana com furo. Depois do sinal obrigatório, caiu pra zero. O sistema se paga no primeiro dia.", rating: 5 },
  { name: "Fernanda T.", shop: "Ateliê Bem-Estar", text: "Meus clientes elogiaram a experiência. Agendam, pagam o sinal, recebem lembrete. Nunca mais 'oi, confirma?'.", rating: 5 },
];

const faqs = [
  { q: "Preciso de cartão de crédito para testar?", a: "Não. O teste de 30 dias é totalmente livre — sem cartão, sem fidelidade." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem multa, sem burocracia. Você tem controle total da sua assinatura no painel." },
  { q: "Como funciona o sinal por Pix?", a: "Você define o valor (parcial ou integral). O cliente paga no momento do agendamento e o horário só é confirmado após a confirmação automática." },
  { q: "Funciona em qualquer dispositivo?", a: "Sim. Painel responsivo para você e link de agendamento otimizado para o celular dos seus clientes." },
];

// ─── PILL HEADER ───
const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-[11px] font-medium uppercase tracking-[0.18em]">
    {children}
  </span>
);

// ─── MAIN ───
const SaaSLanding = () => {
  const navigate = useNavigate();
  const scrollToPricing = () => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 overflow-x-hidden font-body">

      {/* TOP NAV */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/75 border-b border-border/60">
        <div className="container max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl gold-gradient flex items-center justify-center">
              <Flower2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">AgendeOnline</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground font-medium">
            <a href="#beneficios" className="hover:text-foreground transition-colors">Benefícios</a>
            <a href="#para-quem" className="hover:text-foreground transition-colors">Para quem</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <Button
            onClick={() => navigate("/login")}
            className="h-10 px-5 rounded-full bg-foreground text-background hover:bg-foreground/90 text-sm font-medium"
          >
            Entrar
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-24 pb-32 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute top-40 right-10 w-[400px] h-[400px] rounded-full bg-accent/15 blur-[100px]" />
        </div>

        <div className="container px-6 max-w-5xl text-center relative">
          <Pill>
            <Sparkles className="h-3 w-3" /> 30 dias grátis · sem cartão
          </Pill>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.05] mt-10 mb-8 text-foreground">
            A gestão elegante para o seu<br />
            <span className="italic text-primary font-normal">negócio de beleza.</span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            Agenda online, pagamento por Pix antecipado e relatórios claros — em uma plataforma desenhada para clínicas, salões e spas que valorizam a experiência do cliente.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              onClick={() => navigate("/login")}
              className="h-14 px-9 rounded-full gold-gradient text-primary-foreground text-base font-medium shadow-gold transition-all active:scale-95 group"
            >
              Começar teste grátis
              <ChevronRight className="ml-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="ghost"
              onClick={scrollToPricing}
              className="h-14 px-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 text-base font-medium"
            >
              Ver planos →
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 mt-14 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-primary fill-primary/30" />
              200+ negócios ativos
            </div>
            <span className="h-1 w-1 rounded-full bg-border" />
            <div className="flex -space-x-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 text-primary fill-primary" />
              ))}
              <span className="ml-3 font-medium">4.9 / 5</span>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section id="beneficios" className="py-24 lg:py-32">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20 max-w-2xl mx-auto">
            <Pill>Por que AgendeOnline</Pill>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight mt-8 mb-5">
              Resolvemos o que <span className="italic text-primary font-normal">custa o seu tempo</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Cada recurso pensado para um problema real do seu dia a dia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {painPoints.map((p) => (
              <div
                key={p.title}
                className="group rounded-3xl border border-border bg-card p-8 lg:p-10 hover:shadow-card hover:border-primary/30 transition-all duration-500"
              >
                <div className="flex items-start gap-5">
                  <div className="h-12 w-12 rounded-2xl bg-primary/8 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <p.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">{p.subtitle}</p>
                    <h3 className="font-display text-xl lg:text-2xl font-medium tracking-tight mb-3">{p.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-[15px]">{p.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NICHES */}
      <section id="para-quem" className="py-24 lg:py-32 bg-secondary/40">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20 max-w-2xl mx-auto">
            <Pill>Para quem é</Pill>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight mt-8 mb-5">
              Uma plataforma, <span className="italic text-primary font-normal">muitos mercados</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Desenhado para a realidade de negócios de beleza e bem-estar de alto padrão.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {niches.map((n) => (
              <div
                key={n.title}
                className="group rounded-3xl bg-card border border-border p-8 hover:border-primary/30 hover:shadow-card transition-all duration-500"
              >
                <div className="h-12 w-12 rounded-2xl bg-primary/8 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-colors">
                  <n.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
                </div>
                <h3 className="font-display text-lg font-medium mb-3 tracking-tight">{n.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{n.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 lg:py-32">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20 max-w-2xl mx-auto">
            <Pill>Funcionalidades</Pill>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight mt-8 mb-5">
              Tudo o que você precisa <span className="italic text-primary font-normal">para crescer</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Recursos que trabalham sozinhos. Foque no atendimento, a plataforma cuida do resto.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureBenefits.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-border bg-card p-8 hover:border-primary/30 hover:shadow-card transition-all duration-500"
              >
                <div className="h-12 w-12 rounded-2xl gold-gradient flex items-center justify-center mb-6 shadow-gold">
                  <f.icon className="h-5 w-5 text-primary-foreground" strokeWidth={1.8} />
                </div>
                <h3 className="font-display text-lg font-medium mb-3 tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 lg:py-32 bg-secondary/40">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20 max-w-2xl mx-auto">
            <Pill>Investimento</Pill>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight mt-8 mb-5">
              Custa menos que <span className="italic text-primary font-normal">um cancelamento</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              30 dias grátis. Sem fidelidade. Sem taxa de cancelamento. Sem surpresas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-3xl p-8 lg:p-10 transition-all duration-500 flex flex-col ${
                  plan.popular
                    ? "bg-foreground text-background shadow-2xl scale-[1.02] border-0"
                    : "bg-card border border-border hover:border-primary/30 hover:shadow-card"
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground border-0 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] rounded-full">
                    Mais escolhido
                  </Badge>
                )}

                <div className="mb-8">
                  <h3 className="font-display text-2xl font-medium tracking-tight">{plan.name}</h3>
                  <p className={`text-sm mt-2 leading-snug ${plan.popular ? "text-background/60" : "text-muted-foreground"}`}>{plan.desc}</p>

                  <div className="mt-8 flex items-baseline gap-1">
                    <span className={`text-sm font-medium ${plan.popular ? "text-background/60" : "text-muted-foreground"}`}>R$</span>
                    <span className="font-display text-6xl font-medium tracking-tighter">{plan.price}</span>
                    <span className="text-2xl font-medium">{plan.cents}</span>
                    <span className={`text-xs ml-1 ${plan.popular ? "text-background/60" : "text-muted-foreground"}`}>{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3.5 mb-10 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${plan.popular ? "bg-primary/20" : "bg-primary/10"}`}>
                        <Check className={`h-3 w-3 ${plan.popular ? "text-primary" : "text-primary"}`} strokeWidth={3} />
                      </div>
                      <span className={plan.popular ? "text-background/85" : "text-muted-foreground"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => openPlanCheckout(plan.name.toLowerCase())}
                  className={`w-full h-12 rounded-full font-medium transition-all ${
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 lg:py-32">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20 max-w-2xl mx-auto">
            <Pill>Histórias reais</Pill>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight mt-8 mb-5">
              Quem usa, <span className="italic text-primary font-normal">cresce</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-3xl bg-card border border-border p-8 lg:p-10 flex flex-col hover:shadow-card transition-all duration-500">
                <div className="flex gap-0.5 mb-6">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground/85 mb-8 text-[15px] leading-relaxed flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-6 border-t border-border">
                  <div className="h-10 w-10 rounded-full gold-gradient flex items-center justify-center font-medium text-primary-foreground text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.shop}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 lg:py-32 bg-secondary/40">
        <div className="container px-6 max-w-3xl">
          <div className="text-center mb-16">
            <Pill>Perguntas frequentes</Pill>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight mt-8">
              Dúvidas <span className="italic text-primary font-normal">comuns</span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-card border border-border p-6 lg:p-7 cursor-pointer transition-all hover:border-primary/30">
                <summary className="flex items-center justify-between font-display text-lg font-medium tracking-tight list-none">
                  {f.q}
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed text-[15px]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 lg:py-32">
        <div className="container px-6 max-w-5xl">
          <div className="relative rounded-[2rem] overflow-hidden bg-foreground text-background p-12 sm:p-16 lg:p-24 text-center">
            <div className="absolute inset-0 -z-0 opacity-30">
              <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/40 blur-[100px]" />
              <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/40 blur-[100px]" />
            </div>

            <div className="relative z-10">
              <Sparkles className="h-10 w-10 text-primary mx-auto mb-8" strokeWidth={1.5} />
              <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium mb-6 tracking-tight leading-tight">
                Pronto para modernizar<br />o seu atendimento?
              </h2>
              <p className="text-base sm:text-lg text-background/70 mb-12 max-w-lg mx-auto leading-relaxed">
                30 dias grátis. Configure em minutos e veja seus clientes agendando sozinhos ainda esta semana.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/login")}
                className="bg-primary text-primary-foreground hover:opacity-90 h-14 px-10 rounded-full text-base font-medium transition-all active:scale-95 group"
              >
                Criar minha conta grátis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-14">
        <div className="container px-6 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gold-gradient flex items-center justify-center">
              <Flower2 className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-medium text-sm tracking-tight">AgendeOnline24Horas</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Plataforma de gestão para negócios de beleza & bem-estar · © {new Date().getFullYear()}
          </p>
          <p className="text-[11px] text-muted-foreground/70">Desenvolvido por Jotatechinfo</p>
        </div>
      </footer>
    </div>
  );
};

export default SaaSLanding;
