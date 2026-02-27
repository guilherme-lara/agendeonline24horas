import { useNavigate } from "react-router-dom";
import {
  CalendarDays, BarChart3, CreditCard, Bell, Users, Shield,
  Sparkles, Package, Brain, Check, ArrowRight, Scissors, Star, Quote, Zap, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  { icon: Globe, title: "Link de Agendamento", desc: "Sua barbearia aberta 24h por dia com um endereço exclusivo e profissional." },
  { icon: BarChart3, title: "BI e Relatórios", desc: "Acompanhe faturamento, lucratividade e ticket médio em dashboards neon." },
  { icon: CreditCard, title: "PDV Integrado", desc: "Feche comandas, venda produtos e controle o estoque em segundos." },
  { icon: Bell, title: "Lembretes Inteligentes", desc: "Reduza faltas em até 40% com notificações automáticas via WhatsApp." },
  { icon: Users, title: "Gestão de Comissões", desc: "Cálculo automático de ganhos para cada barbeiro do seu time." },
  { icon: Shield, title: "Dados Seguros", desc: "Infraestrutura profissional com isolamento total por barbearia." },
];

const plans = [
  {
    name: "Essential",
    price: "97",
    period: "/mês",
    desc: "Para barbeiros independentes",
    features: ["Link de agendamento único", "Até 100 agendamentos/mês", "Dashboard de ganhos", "Gestão de 1 profissional"],
    cta: "Começar Agora",
    popular: false,
    color: "slate"
  },
  {
    name: "Growth",
    price: "197",
    period: "/mês",
    desc: "O motor das barbearias de elite",
    features: [
      "Tudo do Essential",
      "Pagamentos via Pix Online",
      "Lembretes de WhatsApp",
      "Controle de Comissões",
      "Até 5 profissionais",
    ],
    cta: "Escolher Plano Growth",
    popular: true,
    color: "cyan"
  },
  {
    name: "Pro",
    price: "397",
    period: "/mês",
    desc: "Controle total e automação",
    features: [
      "Tudo do Growth",
      "Gestão de Estoque Full",
      "Sistema de Fidelidade",
      "Relatórios com IA",
      "Barbeiros Ilimitados",
    ],
    cta: "Acessar Plano Pro",
    popular: false,
    color: "emerald"
  },
];

// --- ADICIONE ESTAS DUAS LISTAS ABAIXO (O QUE FALTAVA) ---
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
    <div className="min-h-screen bg-[#0b1224] text-white selection:bg-cyan-500/30 overflow-x-hidden">
      {/* --- HERO SECTION --- */}
      <section className="relative pt-24 pb-32 lg:pt-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-cyan-500/10 blur-[120px] rounded-full -z-10" />
        
        <div className="container px-6 text-center max-w-5xl relative z-10">
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 mb-8 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em]">
            <Sparkles className="h-3 w-3 mr-2 fill-cyan-400" /> A Revolução da Barbearia 2.0
          </Badge>
          
          <h1 className="font-black text-5xl sm:text-7xl lg:text-8xl tracking-tight leading-[0.9] mb-8">
            Escalamos sua <br />
            <span className="text-cyan-500">Barbearia.</span>
          </h1>
          
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
            Agendamento digital, gestão financeira automática e automação de estoque. 
            Dê adeus às planilhas e assuma o controle do seu lucro.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto h-16 px-10 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-2xl shadow-cyan-900/20 text-lg transition-all active:scale-95 group"
            >
              Criar Minha Conta <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              onClick={scrollToPricing}
              className="w-full sm:w-auto h-16 px-10 border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-900 font-bold rounded-2xl transition-all"
            >
              Ver Planos de Assinatura
            </Button>
          </div>
        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <section className="container py-24 px-6 relative">
        <div className="absolute right-0 top-1/4 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full" />
        
        <div className="text-center mb-20">
          <Badge variant="outline" className="border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-widest px-3 py-1 mb-4">Core Engine</Badge>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Potência Industrial</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative rounded-[2rem] border border-slate-800 bg-slate-900/40 p-8 hover:border-cyan-500/30 transition-all duration-500 backdrop-blur-sm"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-6 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all">
                <f.icon className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{f.title}</h3>
              <p className="text-slate-500 leading-relaxed text-sm font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section id="pricing" className="container py-32 px-6">
        <div className="text-center mb-20">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4 px-3 py-1 text-[10px] font-black uppercase tracking-widest">Pricing</Badge>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-6">
            O plano ideal para sua <span className="text-emerald-500">Escala</span>
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto font-medium leading-relaxed">
            Sem letras miúdas. Cancele quando quiser. Recupere o investimento em menos de 1 dia de trabalho.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, i) => {
            const Icon = planIcons[i];
            return (
              <div
                key={plan.name}
                className={`relative rounded-[2.5rem] border p-10 transition-all duration-500 flex flex-col ${
                  plan.popular
                    ? "border-cyan-500 bg-slate-900/60 shadow-2xl shadow-cyan-900/20 scale-105 z-10"
                    : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full shadow-lg">
                    Mais Escolhido
                  </div>
                )}
                
                <div className="mb-8">
                  <Icon className={`h-10 w-10 mb-6 ${plan.popular ? "text-cyan-400" : "text-slate-600"}`} />
                  <h3 className="text-2xl font-black text-white tracking-tight">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-widest">{plan.desc}</p>
                  
                  <div className="mt-8 flex items-baseline gap-1">
                    <span className="text-sm font-bold text-slate-500">R$</span>
                    <span className={`text-6xl font-black tracking-tighter ${plan.popular ? "text-cyan-400" : "text-white"}`}>
                      {plan.price}
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{plan.period}</span>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm font-medium">
                      <Check className={`h-5 w-5 ${plan.popular ? "text-cyan-400" : "text-emerald-400"} flex-shrink-0`} />
                      <span className="text-slate-400 leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => navigate("/login")}
                  className={`w-full h-14 font-black rounded-2xl transition-all shadow-xl ${
                    plan.popular
                      ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20"
                      : "bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* --- TESTIMONIALS --- */}
      <section className="bg-slate-900/20 py-24 border-y border-slate-800/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent pointer-events-none" />
        <div className="container px-6 relative">
            <h2 className="text-center text-sm font-black uppercase text-slate-600 tracking-[0.4em] mb-16">Proof of Concept</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {testimonials.map((t, i) => (
                    <div key={t.name} className="bg-slate-950/50 border border-slate-800 p-8 rounded-[2rem] shadow-xl backdrop-blur-md">
                        <div className="flex gap-1 mb-6">
                          {Array.from({ length: t.rating }).map((_, j) => (
                            <Star key={j} className="h-4 w-4 fill-cyan-400 text-cyan-400" />
                          ))}
                        </div>
                        <Quote className="h-8 w-8 text-cyan-500/20 mb-4" />
                        <p className="text-slate-300 mb-8 italic text-sm leading-relaxed font-medium">"{t.text}"</p>
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center font-black text-cyan-400 text-xs">
                                {t.name[0]}
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm">{t.name}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t.shop}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* --- FINAL CALL TO ACTION --- */}
      <section className="container py-32 px-6">
        <div className="relative rounded-[3rem] border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 to-[#0b1224] p-12 sm:p-24 text-center max-w-5xl mx-auto shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full" />
          
          <div className="relative z-10">
            <Zap className="h-16 w-16 text-cyan-400 mx-auto mb-10 fill-cyan-400" />
            <h2 className="text-4xl sm:text-6xl font-black text-white mb-6 tracking-tight leading-none">
              A era do papel acabou.
            </h2>
            <p className="text-lg text-slate-400 mb-12 max-w-lg mx-auto font-medium leading-relaxed">
              Modernize seu fluxo, encante seus clientes e veja seus lucros crescerem com a maior plataforma do mercado.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-2xl shadow-emerald-900/30 h-16 px-12 rounded-2xl text-lg transition-all active:scale-95"
            >
              Criar Minha Barbearia Agora <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="container py-12 text-center border-t border-slate-800/50 px-6">
        <div className="flex items-center justify-center gap-3 mb-4 opacity-50">
          <Scissors className="h-4 w-4 text-cyan-500" />
          <span className="font-black text-xs uppercase tracking-[0.4em] text-white">System Online SaaS</span>
        </div>
        <p className="text-[10px] text-slate-700 font-bold uppercase tracking-[0.2em]">
          Powered by Guilherme Lara Tech Ecosystem &bull; 2026
        </p>
      </footer>
    </div>
  );
};

export default SaaSLanding;
