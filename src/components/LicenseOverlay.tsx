import { Shield, Check, Package, Sparkles, Star, ExternalLink, Lock, Settings, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openPlanCheckout } from "@/lib/infinitepay-checkout";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const plans = [
  { key: "bronze", name: "Bronze", price: "R$ 49,90", icon: Package },
  { key: "prata", name: "Prata", price: "R$ 79,90", icon: Sparkles, popular: true },
  { key: "ouro", name: "Ouro", price: "R$ 99,90", icon: Star },
];

interface LicenseOverlayProps {
  barbershopId?: string;
}

const LicenseOverlay = ({ barbershopId }: LicenseOverlayProps) => {
  const { isAdmin, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const extendTrialMutation = useMutation({
    mutationFn: async () => {
      if (!barbershopId) return;
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 30);
      const { error } = await supabase
        .from("barbershops")
        .update({ trial_ends_at: newDate.toISOString() })
        .eq("id", barbershopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-clinic"] });
      toast({ title: "Trial estendido por 30 dias!", description: "A página será atualizada." });
      window.location.reload();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao estender", description: err.message, variant: "destructive" });
    }
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <Lock className="h-10 w-10 text-destructive" />
        </div>

        <div>
          <h1 className="text-2xl font-black font-display text-foreground">Acesso Suspenso</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto mb-4">
            Sua licença expirou. Realize o pagamento para liberar o acesso imediatamente.
          </p>
          <Button variant="outline" onClick={signOut} className="mx-auto flex items-center gap-2 rounded-xl text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Sair do Sistema
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {plans.map((plan) => (
            <button
              key={plan.key}
              onClick={() => openPlanCheckout(plan.key, barbershopId)}
              className={`rounded-2xl border p-5 text-center transition-all hover:scale-[1.02] ${
                plan.popular
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <plan.icon className={`mx-auto h-6 w-6 mb-2 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-bold text-sm">{plan.name}</h3>
              <p className="text-lg font-black text-foreground mt-1">{plan.price}<span className="text-[10px] text-muted-foreground">/mês</span></p>
              <div className={`mt-3 rounded-xl py-2 text-xs font-bold ${
                plan.popular
                  ? "premium-gradient text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}>
                <ExternalLink className="h-3 w-3 inline mr-1" />
                Assinar
              </div>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Pagamento seguro via InfinitePay · Acesso liberado em minutos
        </p>
      </div>

      {isAdmin && (
        <div className="mt-12 bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl max-w-lg w-full text-center">
          <div className="flex items-center justify-center gap-2 text-amber-600 mb-3">
            <Settings className="h-5 w-5" />
            <p className="font-bold">Controles de Super Admin (Modo Suporte)</p>
          </div>
          <p className="text-xs text-amber-600/80 mb-4 font-medium">
            Você está visualizando a tela de bloqueio do cliente. Ele não pode acessar o sistema sem pagar.
          </p>
          <Button 
            onClick={() => extendTrialMutation.mutate()}
            disabled={extendTrialMutation.isPending}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11"
          >
            {extendTrialMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Estender Trial (+30 dias) e Desbloquear
          </Button>
        </div>
      )}
    </div>
  );
};

export default LicenseOverlay;
