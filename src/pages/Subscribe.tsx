import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { plans } from "@/components/SubscriptionPlans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Subscribe = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const plan = plans.find((p) => p.id === planId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Formatação de telefone em tempo real
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanPhone = phone.replace(/\D/g, "");
    if (name.trim().length < 3) {
      toast({ title: "Nome muito curto", description: "Por favor, informe seu nome completo.", variant: "destructive" });
      return;
    }
    if (cleanPhone.length < 10) {
      toast({ title: "Telefone inválido", description: "Informe um WhatsApp válido com DDD.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Inserção blindada no banco de dados
      const { error } = await supabase.from("subscribers").insert({
        user_id: user?.id,
        name: name.trim(),
        phone: phone.trim(),
        plan: plan?.id,
        plan_price: plan?.price,
        status: 'active'
      });

      if (error) throw error;

      toast({ 
        title: "Assinatura Ativada! 🎉", 
        description: `Seja bem-vindo ao plano ${plan?.name}. Redirecionando...` 
      });
      
      // Pequeno delay para o usuário ler o toast de sucesso
      setTimeout(() => navigate("/dashboard"), 1500);

    } catch (err: any) {
      console.error("Erro na assinatura:", err);
      toast({ 
        title: "Falha na ativação", 
        description: err.message || "Não conseguimos processar sua assinatura. Tente novamente.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  // Proteções de carregamento e acesso
  if (authLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!plan) {
    return (
      <div className="container max-w-md py-20 text-center animate-fade-in">
        <p className="text-muted-foreground mb-4">Plano não encontrado ou expirado.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Voltar para Início</Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-md py-20 text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-3">Identificação Necessária</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Para ativar o plano <span className="text-primary font-bold">{plan.name}</span>, precisamos que você acesse sua conta.
        </p>
        <Button onClick={() => navigate("/auth")} className="w-full gold-gradient text-primary-foreground font-bold h-12">
          Fazer Login ou Criar Conta
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-md py-10 animate-fade-in">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Voltar
      </button>

      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-secondary/30 p-8 mb-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <CheckCircle2 className="h-12 w-12 text-primary" />
        </div>
        <p className="text-xs uppercase tracking-widest text-primary font-bold mb-2">Você escolheu o plano</p>
        <h2 className="font-display text-3xl font-bold mb-2">{plan.name}</h2>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-muted-foreground">R$</span>
          <span className="text-4xl font-display font-black text-primary">{plan.price.toFixed(2).replace(".", ",")}</span>
          <span className="text-xs text-muted-foreground">/mês</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h3 className="font-display text-lg font-bold mb-6 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          Dados da Assinatura
        </h3>
        
        <form onSubmit={handleSubscribe} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Responsável Financeiro</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo para nota"
              className="h-12 bg-background"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">WhatsApp de Contato</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className="h-12 bg-background"
              required
              maxLength={15}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full gold-gradient text-primary-foreground font-black h-14 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Ativando...</>
            ) : (
              "Confirmar e Ativar Agora"
            )}
          </Button>
        </form>
        
        <p className="text-[10px] text-center text-muted-foreground mt-6 uppercase tracking-tighter">
          Pagamento processado em ambiente seguro &bull; Sem fidelidade
        </p>
      </div>
    </div>
  );
};

export default Subscribe;
