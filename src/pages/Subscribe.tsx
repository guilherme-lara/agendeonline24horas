import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Loader2, ArrowLeft, CheckCircle2, ShieldCheck, 
  CreditCard, Zap, Sparkles, Rocket 
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { plans } from "@/components/SubscriptionPlans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const planIcons: Record<string, any> = {
  essential: Zap,
  growth: Sparkles,
  pro: Rocket
};

const Subscribe = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const plan = plans.find((p) => p.id === planId);

  const [formData, setFormData] = useState({
    name: "",
    phone: ""
  });

  // --- MUTAÇÃO: ATIVAR ASSINATURA ---
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      // Health Check de Sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Por favor, faça login novamente.");

      const { error } = await supabase.from("subscribers").insert({
        user_id: user?.id,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        plan: plan?.id,
        plan_price: plan?.price,
        status: 'active'
      });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalida o cache global para que o sistema reconheça o novo plano instantaneamente
      queryClient.invalidateQueries({ queryKey: ["saas-plan"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      
      toast({ 
        title: "Assinatura Ativada! 🎉", 
        description: `Bem-vindo ao nível ${plan?.name}. Seu painel está sendo liberado.` 
      });
      
      setTimeout(() => navigate("/dashboard"), 1500);
    },
    onError: (err: any) => {
      toast({ 
        title: "Erro na ativação", 
        description: err.message || "Tente novamente em instantes.", 
        variant: "destructive" 
      });
    }
  });

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim().length < 3 || formData.phone.replace(/\D/g, "").length < 10) {
      toast({ title: "Dados incompletos", description: "Verifique o nome e o telefone.", variant: "destructive" });
      return;
    }
    subscribeMutation.mutate();
  };

  // --- RENDERS DE PROTEÇÃO ---
  if (authLoading) return (
    <div className="min-h-screen bg-[#0b1224] flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
    </div>
  );

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#0b1224] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-white font-bold mb-4">Plano não identificado.</h2>
        <Button onClick={() => navigate("/")} variant="outline" className="border-slate-800 text-slate-400">Voltar</Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0b1224] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="h-20 w-20 bg-cyan-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-cyan-500/20">
          <ShieldCheck className="h-10 w-10 text-cyan-400" />
        </div>
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Falta pouco!</h2>
        <p className="text-slate-500 mb-10 max-w-xs mx-auto">Para ativar o plano <b>{plan.name}</b>, você precisa estar conectado à sua conta.</p>
        <Button onClick={() => navigate("/login")} className="gold-gradient h-14 px-12 rounded-2xl font-black shadow-xl w-full max-w-sm">Acessar Minha Conta</Button>
      </div>
    );
  }

  const PlanIcon = planIcons[plan.id] || Sparkles;

  return (
    <div className="min-h-screen bg-[#0b1224] py-12 px-6 relative overflow-hidden flex flex-col items-center">
      {/* EFEITO DE FUNDO */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full -z-10" />

      <div className="w-full max-w-md">
        <button 
          onClick={() => navigate(-1)} 
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-white transition-all mb-10"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Voltar
        </button>

        {/* CARD DO PLANO ESCOLHIDO */}
        <div className="relative rounded-[2.5rem] border border-cyan-500/30 bg-slate-900/60 p-8 mb-8 shadow-2xl backdrop-blur-md overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <PlanIcon className="h-20 w-20 text-cyan-400" />
          </div>
          
          <Badge className="bg-cyan-500 text-white font-black text-[9px] uppercase tracking-widest mb-4 px-3">Upgrade Selecionado</Badge>
          <h2 className="text-3xl font-black text-white tracking-tighter mb-2">{plan.name}</h2>
          
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-slate-500">R$</span>
            <span className="text-5xl font-black text-cyan-400 tracking-tighter">
              {plan.price.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-xs font-bold text-slate-600 uppercase ml-1">/mês</span>
          </div>
        </div>

        {/* FORMULÁRIO DE ATIVAÇÃO */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-sm">
          <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            Confirmação de Faturamento
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome do Responsável</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo para o contrato"
                className="h-14 bg-slate-950 border-slate-800 text-white font-bold focus-visible:ring-cyan-500/50"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">WhatsApp Financeiro</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
                className="h-14 bg-slate-950 border-slate-800 text-white font-mono focus-visible:ring-cyan-500/50"
                required
                maxLength={15}
              />
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={subscribeMutation.isPending}
                className="w-full h-16 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-xl shadow-cyan-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                {subscribeMutation.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Processando...</>
                ) : (
                  <><CreditCard className="h-5 w-5" /> Ativar Plano Agora</>
                )}
              </Button>
            </div>
          </form>
          
          <p className="text-[9px] text-center text-slate-600 mt-8 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck className="h-3 w-3" /> Transação Criptografada via SSL &bull; Sem Multas
          </p>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;
