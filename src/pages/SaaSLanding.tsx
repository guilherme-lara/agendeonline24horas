import { useNavigate } from "react-router-dom";
import { openPlanCheckout } from "@/lib/infinitepay-checkout";
import {
  CalendarDays, BarChart3, CreditCard, Bell, Users, Shield,
  Check, ArrowRight, Sparkles, Star, Quote, Clock,
  TrendingUp, MessageCircleOff, Wallet, ClipboardCheck,
  Scissors, Brush, Palette, Fingerprint, HeartPulse, Store,
  ChevronRight, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── PROBLEMA → SOLUÇÃO ───
const painPoints = [
  {
    icon: Clock,
    title: "Fim dos furos na agenda",
    subtitle: "Pagamento de sinal obrigatório",
    desc: "Cobramos um sinal via Pix no momento do agendamento. Seu cliente se compromete, a no-show cai a zero, e você fatura o que planejou — sem surpresas no fim do mês.",
  },
  {
    icon: MessageCircleOff,
    title: "Adeus ao caos do WhatsApp",
    subtitle: "Agendamento autônomo 24h",
    desc: "Seu cliente escolhe serviço, profissional e horário sozinho, pelo link exclusivo do seu negócio. Sem troca de mensagens, sem idas e vindas, sem erros humanos.",
  },
  {
    icon: Wallet,
    title: "Gestão financeira que fecha conta",
    subtitle: "Split de comissões automático",
    desc: "Relatórios claros de faturamento diário, semanal e mensal. Comissões calculadas e distribuídas automaticamente para cada profissional. Adeus planilha de Excel.",
  },
  {
    icon: TrendingUp,
    title: "Escala sem aumentar equipe",
    subtitle: "Cresça sem caos operacional",
    desc: "De 1 a 30 profissionais no mesmo painel. Adicione sedes, organize turnos e acompanhe tudo em tempo real — sem contratar gerente para isso.",
  },
];

// ─── PARA QUEM É ───
const niches = [
  { icon: HeartPulse, title: "Clínicas de Estética", desc: "Procedimentos faciais, corporais e tratamentos de alto padrão com agendamento controlado." },
  { icon: Scissors, title: "Salões de Beleza", desc: "Corte, cor, tratamentos — gerencie stylists, comissões e horários em um único painel." },
  { icon: Brush, title: "Barbearias & Salões Premium", desc: "Barba, corte e experiência masculina. Controle de fila e sinal para segurar a vaga." },
  { icon: Palette, title: "Esmalterias & Nail Design", desc: "Design de unhas, nail art e spa dos pés com agenda otimizada e pagamentos antecipados." },
  { icon: HeartPulse, title: "Spas & Centros de Bem-Estar", desc: "Massagens, terapias e rituais de relaxamento com experiência do cliente impecável." },
  { icon: Fingerprint, title: "Estúdios de Tatuagem", desc: "Sessões, orçamentos e portfólio integrados. Deposite sinal e garanta a agenda do artista." },
];

// ─── FEATURES COM BENEFÍCIO ───
const featureBenefits = [
  { icon: CalendarDays, title: "Agenda Inteligente 24h", desc: "Link personalizado que seus clientes acessam a qualquer momento. O sistema bloqueia horários conflitantes automaticamente." },
  { icon: CreditCard, title: "Receba antecipado com segurança", desc: "Cobre sinal ou valor integral via Pix com confirmação instantânea através da Infinite Pay — a menor taxa do mercado para o seu segmento." },
  { icon: BarChart3, title: "Visão real do seu faturamento", desc: "Dashboard com receita diária, ticket médio, taxa de ocupação e projeções. Tome decisões com dados, não no achismo." },
  { icon: Bell, title: "Cliente lembrado, cliente presente", desc: "Notificações automáticas por WhatsApp e e-mail reduzem faltas em até 80%. Sem esforço manual da sua equipe." },
  { icon: Users, title: "Equipe gerenciada, comissão paga", desc: "Cadastre profissionais, defina regras de split e deixe o sistema calcular e distribuir comissões. Transparência total." },
  { icon: Shield, title: "Seus dados protegidos de ponta a ponta", desc: "Infraestrutura em nuvem com isolamento total por negócio e criptografia em trânsito. Seus dados são só seus." },
];

// ─── PREÇOS ───
const plans = [
  {
    name: "Essencial",
    price: "49",
    cents: ",90",
    period: "/mês",
    desc: "Para quem está migrando do caderno pro digital",
    features: [
      "Agenda online profissional 24h",
      "Link de agendamento personalizado",
      "Dashboard com visão de faturamento",
      "1 profissional",
      "Suporte via e-mail",
    ],
    cta: "Começar Teste Grátis",
    popular: false,
  },
  {
    name: "Business",
    price: "79",
    cents: ",90",
    period: "/mês",
    desc: "O plano mais escolhido por salões e clínicas",
    features: [
      "Tudo do Essencial",
      "Cobrança de sinal via Pix (anti falta)",
      "Lembretes automáticos WhatsApp + e-mail",
      "Dashboard financeiro completo com projeções",
      "Até 5 profissionais",
      "Relatórios de comissão com split automático",
      "Suporte prioritário",
    ],
    cta: "Testar Business Grátis",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "99",
    cents: ",90",
    period: "/mês",
    desc: "Controle total e profissionais ilimitados",
    features: [
      "Tudo do Business",
      "Profissionais ilimitados",
      "Gestão de estoque e insumos",
      "Pacotes e combos com validade",
      "Acesso a relatórios avançados e exportação",
      "Suporte VIP via WhatsApp",
    ],
    cta: "Falar com Consultor",
    popular: false,
  },
];

const planIcons = [Zap, Star, Shield];

// ─── TESTEMONIALS ───
const testimonials = [
  { name: "Ricardo M.", shop: "Barber Club SP", text: "Antes eu perdia 8 a 10 horários por semana com furo. Depois do sinal obrigatório, caiu pra zero. O sistema se paga no primeiro dia.", rating: 5 },
  { name: "Camila R.", shop: "Studio Camila Costa", text: "Gerencio 6 profissionais sozinha. Comissão, agenda, financeiro — tudo automático. Antes eu levava 3 horas por dia nisso.", rating: 5 },
  { name: "Fernando T.", shop: "Ateliê FNX", text: "Meus clientes elogiaram a experiência. Agendam, pagam o sinal, recebem lembrete. Nunca mais tive que mandar 'oi, confirma?' no WhatsApp.", rating: 5 },
];

// ─── SECTION COMPONENTS ───

const SectionBadge = ({ children }: { children: React.ReactNode }) => (
  <Badge className="bg-primary/10 text-primary border-primary/20 mb-6 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em]">
    {children}
  </Badge>
);

const OutlineBadge = ({ children }: { children: React.ReactNode }) => (
  <Badge variant="outline" className="border-border text-muted-foreground font-bold uppercase text-[9px] tracking-widest px-3 py-1 mb-4">
    {children}
  </Badge>
);

// ─── MAIN PAGE ───

const SaaSLanding = () => {
  const navigate = useNavigate();

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-x-hidden">

      {/* ============================================================
          1. HERO SECTION
         ============================================================ */}
      <section className="relative pt-28 pb-36 lg:pt-36 lg:pb-44">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_70%)] -z-10" />

        <div className="container px-6 text-center max-w-5xl relative z-10">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-10 px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em]">
            <Sparkles className="h-3 w-3 mr-2 fill-primary" /> Teste grátis por 30 dias — sem cartão de crédito
          </Badge>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            Eleve o padrão do seu<br />
            negócio de <span className="text-gold-gradient">beleza e estética.</span>
          </h1>

          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-14 leading-relaxed font-medium">
            A plataforma completa de gestão, pagamentos e agendamentos para
            Clínicas de Estética, Salões e Spas que valorizam o tempo e a
            experiência do cliente.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
            <Button
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto h-16 px-12 gold-gradient text-primary-foreground font-black rounded-2xl shadow-2xl shadow-primary/20 text-lg transition-all active:scale-95 group"
            >
              Começar Teste Grátis <ChevronRight className="ml-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              onClick={scrollToPricing}
              className="w-full sm:w-auto h-16 px-10 border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary font-semibold rounded-2xl text-base transition-all"
            >
              Ver Funcionalidades
            </Button>
          </div>

          <p className="text-muted-foreground text-[13px] font-medium">
            Confiado por mais de <span className="text-foreground font-bold">200+</span> profissionais de beleza e bem-estar.
          </p>
        </div>
      </section>

      {/* ============================================================
          2. PROBLEMA → SOLUÇÃO
         ============================================================ */}
      <section className="py-28 lg:py-36">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20">
            <OutlineBadge>Por que escolher o AgendeOnline</OutlineBadge>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Transforme <span className="text-gold-gradient">dores reais</span> em vantagem competitiva
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
              Cada recurso foi pensado para resolver um problema que custa dinheiro e tempo no seu dia a dia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {painPoints.map((p, i) => (
              <div
                key={p.title}
                className="group rounded-2xl border border-border bg-card p-8 lg:p-10 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 flex flex-col"
              >
                <div className="flex items-start gap-5 mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 group-hover:scale-105 transition-all">
                    <p.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl lg:text-2xl font-bold tracking-tight mb-1">{p.title}</h3>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">{p.subtitle}</p>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[15px] font-medium flex-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          3. PARA QUEM É (NICHES)
         ============================================================ */}
      <section className="py-28 lg:py-36 bg-secondary/20 border-y border-border">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20">
            <OutlineBadge>Para quem é</OutlineBadge>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Uma plataforma, <span className="text-gold-gradient">diversos mercados</span>
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
              Projetado para a realidade de negócios de beleza, estética e bem-estar de alto padrão.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 lg:gap-6">
            {niches.map((n, i) => (
              <div
                key={n.title}
                className="group rounded-2xl border border-border bg-card p-7 lg:p-8 text-center hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-500"
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-primary/15 transition-all">
                  <n.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display text-base lg:text-lg font-bold mb-2 tracking-tight">{n.title}</h3>
                <p className="text-muted-foreground text-[13px] leading-relaxed font-medium">{n.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          4. POR DENTRO DO SISTEMA (FEATURES → BENEFITS)
         ============================================================ */}
      <section className="py-28 lg:py-36">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20">
            <OutlineBadge>Funcionalidades</OutlineBadge>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Tudo o que você precisa para <span className="text-gold-gradient">crescer</span>
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
              Recursos poderosos que funcionam sozinhos. Foque no atendimento, a plataforma cuida do resto.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {featureBenefits.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-8 lg:p-10 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 flex flex-col"
              >
                <div className="h-14 w-14 rounded-2xl gold-gradient flex items-center justify-center mb-7 group-hover:scale-110 transition-all">
                  <f.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-xl font-bold mb-3 tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-[15px] font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          5. PREÇOS (PRICING)
         ============================================================ */}
      <section id="pricing" className="py-28 lg:py-36">
        <div className="container px-6 max-w-6xl">
          <div className="text-center mb-20">
            <SectionBadge>Investimento</SectionBadge>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Custa menos que <span className="text-gold-gradient">um serviço cancelado</span> no mês
            </h2>
            <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
              30 dias grátis para você sentir a diferença. Sem fidelidade. Sem taxa de cancelamento. Sem surpresas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {plans.map((plan, i) => {
              const Icon = planIcons[i];
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border p-8 lg:p-10 transition-all duration-500 flex flex-col ${
                    plan.popular
                      ? "border-primary bg-card shadow-2xl shadow-primary/10 scale-105 z-10"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 gold-gradient text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full shadow-lg">
                      Mais Popular
                    </div>
                  )}

                  <div className="mb-8">
                    <Icon className={`mx-auto h-10 w-10 mb-6 ${plan.popular ? "text-primary" : "text-muted-foreground/50"}`} />
                    <h3 className="font-display text-2xl font-bold tracking-tight">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mt-2 font-medium leading-snug">{plan.desc}</p>

                    <div className="mt-8 flex items-baseline gap-1 justify-center">
                      <span className="text-sm font-bold text-muted-foreground">R$</span>
                      <span className="font-display text-6xl font-extrabold text-foreground tracking-tighter">
                        {plan.price}
                      </span>
                      <span className="text-xl font-bold text-foreground">{plan.cents}</span>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-4 mb-10 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm font-medium">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground leading-tight">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => openPlanCheckout(plan.name.toLowerCase())}
                    className={`w-full h-14 font-black rounded-xl transition-all ${
                      plan.popular
                        ? "gold-gradient text-primary-foreground shadow-xl shadow-primary/20 hover:opacity-90"
                        : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
          TESTEMONIALS (Prova Social)
         ============================================================ */}
      <section className="py-28 lg:py-36 bg-secondary/20 border-y border-border">
        <div className="container px-6 max-w-6xl">
          <h2 className="text-center font-display text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Quem usa, <span className="text-gold-gradient">cresce</span>
          </h2>
          <p className="text-center text-muted-foreground text-base max-w-md mx-auto mb-16 font-medium">
            Profissionais que transformaram a gestão do seu negócio com a nossa plataforma.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-card border border-border rounded-2xl p-8 lg:p-10 flex flex-col hover:shadow-xl transition-all duration-500"
              >
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>

                <p className="text-muted-foreground mb-8 italic text-[15px] leading-relaxed font-medium flex-1">
                  &ldquo;{t.text}&rdquo;
                </p>

                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  <div className="h-11 w-11 rounded-xl gold-gradient flex items-center justify-center font-black text-primary-foreground text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground font-semibold">{t.shop}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          6. CTA FINAL
         ============================================================ */}
      <section className="py-28 lg:py-36">
        <div className="container px-6 max-w-5xl">
          <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/30 p-12 sm:p-16 lg:p-24 text-center shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_70%)] -z-10" />

            <div className="relative z-10">
              <Sparkles className="h-14 w-14 text-primary mx-auto mb-8" />
              <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight leading-tight">
                Pronto para modernizar<br />o seu atendimento?
              </h2>
              <p className="text-lg text-muted-foreground mb-12 max-w-lg mx-auto leading-relaxed font-medium">
                Comece hoje com 30 dias grátis. Configure em minutos e veja seus clientes agendando sozinhos ainda esta semana.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/login")}
                className="gold-gradient text-primary-foreground font-black shadow-2xl shadow-primary/30 h-16 px-14 rounded-2xl text-lg transition-all active:scale-95 group"
              >
                Criar Minha Conta Grátis <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
         ============================================================ */}
      <footer className="border-t border-border py-12">
        <div className="container px-6 text-center max-w-5xl">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-display font-bold text-sm tracking-tighter text-foreground">AgendeOnline24Horas</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed max-w-md mx-auto">
            A plataforma de gestão inteligente para negócios de beleza e bem-estar que não acegam ficar para trás.&copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SaaSLanding;
