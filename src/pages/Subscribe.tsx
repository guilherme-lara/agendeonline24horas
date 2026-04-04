import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Loader2, ArrowLeft, CheckCircle2, ShieldCheck, CreditCard, Zap, Sparkles, Rocket, Info
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { plans as allPlans } from "@/components/SubscriptionPlans"; // Ponto 4: Importa todos os planos
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const planIcons: Record<string, any> = {
  silver: Zap,
  gold: Sparkles,
  pro: Rocket
};

const Subscribe = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [selectedPlanId, setSelectedPlanId] = useState(planId);
  const selectedPlan = allPlans.find((p) => p.id === selectedPlanId);

  const [formData, setFormData] = useState({ name: "", phone: "" });

  useEffect(() => {
    if (user?.user_metadata) {
      setFormData(prev => ({ 
        ...prev, 
        name: user.user_metadata.full_name || prev.name,
        phone: user.user_metadata.phone || prev.phone
      }));
    }
  }, [user]);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const { error } = await supabase.from("subscribers").insert({
        user_id: user?.id,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        plan: selectedPlan?.id,
        plan_price: selectedPlan?.price,
        status: 'active'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-plan"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      toast({ 
        title: `🎉 Plano ${selectedPlan?.name} Ativado!`, 
        description: `Bem-vindo! Seu acesso foi liberado e você já pode usar todos os recursos.` 
      });
      setTimeout(() => navigate("/dashboard"), 1500);
    },
    onError: (err: any) => {
      toast({ 
        title: "Erro na ativação", 
        description: err.message || "Tente novamente.", 
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

  if (authLoading) return <div className="min-h-screen bg-[#0b1224] flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-cyan-500" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0b1224] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="h-20 w-20 bg-cyan-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-cyan-500/20"><ShieldCheck className="h-10 w-10 text-cyan-400" /></div>
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Falta pouco!</h2>
        <p className="text-slate-500 mb-10 max-w-xs mx-auto">Para continuar, você precisa estar conectado à sua conta.</p>
        <Button onClick={() => navigate("/login")} className="gold-gradient h-14 px-12 rounded-2xl font-black shadow-xl w-full max-w-sm">Acessar Minha Conta</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1224] py-12 px-6 relative overflow-hidden flex flex-col items-center">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full -z-10" />

      <div className="w-full max-w-4xl">
        <button onClick={() => navigate(-1)} className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-white transition-all mb-10"><ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Voltar para o site</button>
        
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-3">Escolha seu Plano</h1>
          <p className="text-slate-500 max-w-2xl mx-auto">Todos os planos incluem agendamento online ilimitado, gestão de clientes e dashboard financeiro.</p>
        </div>

        {/* PLAN CARDS */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {allPlans.map((plan) => {
            const PlanIcon = planIcons[plan.id] || Sparkles;
            const isSelected = plan.id === selectedPlanId;
            return (
              <button key={plan.id} onClick={() => setSelectedPlanId(plan.id)} className={`relative text-left rounded-3xl p-6 border-2 transition-all duration-300 ${isSelected ? 'border-cyan-500 bg-slate-900/80 shadow-2xl shadow-cyan-900/20' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}>
                {isSelected && <Badge className="absolute -top-3 left-6 bg-cyan-500 text-white font-black text-[9px] uppercase tracking-widest px-3">Selecionado</Badge>}
                <div className="flex items-center gap-4 mb-4">
                  <PlanIcon className={`h-8 w-8 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
                  <h3 className={`text-2xl font-black tracking-tighter ${isSelected ? 'text-white' : 'text-slate-400'}`}>{plan.name}</h3>
                </div>
                <div className="mb-6">
                  <span className="text-sm font-bold text-slate-500">R$</span>
                  <span className={`text-4xl font-black tracking-tighter ${isSelected ? 'text-cyan-400' : 'text-slate-300'}`}>{plan.price.toFixed(2).replace(".", ",")}</span>
                  <span className="text-xs font-bold text-slate-600 uppercase ml-1">/mês</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-400">
                  {plan.features.map(f => <li key={f} className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-cyan-500" /> {f}</li>)}
                </ul>
              </button>
            )
          })}
        </div>

        {/* CHECKOUT FORM */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">Confirmação e Ativação do Plano <span className="text-cyan-400">{selectedPlan?.name}</span></h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome do Responsável</label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome que sairá no contrato" className="h-14 bg-slate-950 border-slate-800 text-white font-bold focus-visible:ring-cyan-500/50" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">WhatsApp Financeiro</label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })} placeholder="(00) 00000-0000" className="h-14 bg-slate-950 border-slate-800 text-white font-mono focus-visible:ring-cyan-500/50" required maxLength={15} />
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-xl">
              <Info className="h-5 w-5 text-cyan-400 flex-shrink-0" />
              <p className="text-xs text-slate-400">O valor de <span className="font-bold text-white">R$ {selectedPlan?.price.toFixed(2).replace(".", ",")}</span> será cobrado em sua fatura via Pix ou boleto, com vencimento em 5 dias úteis.</p>
            </div>
            <div className="pt-4">
              <Button type="submit" disabled={subscribeMutation.isPending} className="w-full h-16 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-xl shadow-cyan-900/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                {subscribeMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin" /> Ativando...</> : <><CreditCard className="h-5 w-5" /> Ativar Plano {selectedPlan?.name} Agora</>}
              </Button>
            </div>
          </form>
          <p className="text-[9px] text-center text-slate-600 mt-8 font-bold uppercase tracking-widest flex items-center justify-center gap-2"><ShieldCheck className="h-3 w-3" /> Transação Criptografada &bull; Ambiente 100% Seguro</p>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;
