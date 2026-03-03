import { useNavigate } from "react-router-dom";
import { Star, ArrowRight, Loader2, Scissors, Users, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import HeroBanner from "@/components/HeroBanner";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const navigate = useNavigate();

  // --- BUSCA DE SERVIÇOS REAIS ---
  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["home-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("active", true)
        .order("sort_order")
        .limit(4); // Pegamos os 4 principais para a Home
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true, // Auto-sincronia de preços
  });

  // --- BUSCA DE PROFISSIONAIS REAIS ---
  // Usa view segura que NÃO expõe email/phone dos barbeiros
  const { data: barbers = [], isLoading: loadingBarbers } = useQuery({
    queryKey: ["home-barbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("id, name, avatar_url, active")
        .eq("active", true)
        .limit(4);
      if (error) throw error;
      return (data || []) as unknown as Array<{ id: string; name: string; avatar_url: string | null; active: boolean }>;
    },
  });

  const isLoading = loadingServices || loadingBarbers;

  return (
    <div className="min-h-screen bg-[#0b1224] text-white selection:bg-cyan-500/30">
      {/* Banner Principal */}
      <HeroBanner />

      {/* SEÇÃO: SERVIÇOS EM DESTAQUE */}
      <section className="container py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 mb-4 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              Experiência Premium
            </Badge>
            <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              Serviços <span className="text-cyan-500">Exclusivos</span>
            </h2>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => navigate("/booking")}
            className="group text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/5 font-bold transition-all rounded-2xl h-12 px-6"
          >
            Ver catálogo completo <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {isLoading && !services.length && !barbers.length ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, i) => (
              <div
                key={service.id}
                onClick={() => navigate("/booking")}
                className="group relative rounded-[2rem] border border-slate-800 bg-slate-900/40 p-8 hover:border-cyan-500/30 transition-all duration-500 cursor-pointer overflow-hidden shadow-2xl backdrop-blur-sm"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Scissors className="h-16 w-16" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  {service.name}
                </h3>
                <p className="text-xs text-slate-500 mb-6 line-clamp-2 leading-relaxed">
                  {"Técnica refinada e acabamento impecável para o seu estilo."}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Valor</span>
                    <span className="text-lg font-black text-emerald-400">
                      R$ {Number(service.price).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <Badge variant="outline" className="border-slate-800 text-slate-500 font-bold px-3 py-1">
                    {service.duration} min
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEÇÃO: PLANOS (SaaS) */}
      <div className="relative border-y border-slate-800/50">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent pointer-events-none" />
        <SubscriptionPlans />
      </div>

      {/* SEÇÃO: EQUIPE DE ELITE */}
      <section className="container py-32 relative">
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 blur-[120px] rounded-full -z-10" />
        
        <div className="text-center mb-16">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-4 uppercase font-black text-[10px] tracking-[0.2em]">
            Time de Especialistas
          </Badge>
          <h2 className="text-4xl font-black text-white sm:text-5xl tracking-tight">
            Mestres da <span className="text-emerald-500 text-glow-emerald">Navalha</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {barbers.map((barber, i) => (
            <div
              key={barber.id}
              className="group relative rounded-[2.5rem] border border-slate-800 bg-slate-900/40 p-8 text-center hover:border-emerald-500/30 hover:bg-slate-900/60 transition-all duration-500 shadow-2xl backdrop-blur-md"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="relative mx-auto mb-6 h-32 w-32">
                <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full scale-0 group-hover:scale-100 transition-transform duration-500" />
                <img
                  src={barber.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=barber"}
                  alt={barber.name}
                  className="relative h-full w-full rounded-[2rem] object-cover border-2 border-slate-800 group-hover:border-emerald-500 transition-all duration-500"
                />
                <div className="absolute -bottom-2 -right-2 bg-[#0b1224] rounded-2xl p-1.5 border border-slate-800 shadow-xl group-hover:border-emerald-500 transition-colors">
                  <div className="flex items-center justify-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-xl">
                    <Star className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-400">5.0</span>
                  </div>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1 tracking-tight group-hover:text-emerald-400 transition-colors">
                {barber.name}
              </h3>
              <p className="text-[10px] text-slate-500 mb-8 uppercase font-black tracking-[0.15em]">
                {"Master Barber"}
              </p>
              
              <Button 
                onClick={() => navigate("/booking")}
                className="w-full h-12 bg-slate-950 border border-slate-800 text-white font-bold rounded-2xl group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:text-white transition-all shadow-lg active:scale-95"
              >
                Reservar Horário
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER RÁPIDO */}
      <footer className="container py-12 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Plataforma SaaS v3.0 Ativa</p>
        </div>
        <p className="text-[10px] text-slate-700 font-bold uppercase tracking-tighter">
            © 2026 Guilherme Lara &bull; Master Tech Ecosystem
        </p>
      </footer>
    </div>
  );
};

export default Index;
