import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
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

  if (!plan) {
    return (
      <div className="container max-w-md py-20 text-center">
        <p className="text-muted-foreground">Plano não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-md py-20 text-center animate-fade-in">
        <h2 className="font-display text-2xl font-bold mb-3">Faça login para continuar</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Você precisa estar logado para assinar o plano <span className="text-primary font-semibold">{plan.name}</span>.
        </p>
        <Button
          onClick={() => navigate("/login")}
          className="gold-gradient text-primary-foreground font-semibold hover:opacity-90"
        >
          Fazer Login
        </Button>
      </div>
    );
  }

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 10) {
      toast({ title: "Preencha todos os campos corretamente.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("subscribers").insert({
        user_id: user.id,
        name: name.trim(),
        phone: phone.trim(),
        plan: plan.id,
        plan_price: plan.price,
      });

      if (error) throw error;

      toast({ title: "Assinatura realizada!", description: `Plano ${plan.name} ativado com sucesso.` });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-md py-8 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="rounded-xl border border-primary/30 bg-card p-6 mb-6">
        <h2 className="font-display text-xl font-bold mb-1">Plano {plan.name}</h2>
        <p className="text-2xl font-bold text-primary font-display">
          R$ {plan.price.toFixed(2).replace(".", ",")}
          <span className="text-xs text-muted-foreground font-normal">/mês</span>
        </p>
      </div>

      <h3 className="font-display text-lg font-bold mb-4">Seus Dados</h3>
      <form onSubmit={handleSubscribe} className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nome completo</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="bg-card border-border"
            required
            maxLength={100}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">WhatsApp</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="bg-card border-border"
            required
            maxLength={20}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
          ) : (
            "Confirmar Assinatura"
          )}
        </Button>
      </form>
    </div>
  );
};

export default Subscribe;
