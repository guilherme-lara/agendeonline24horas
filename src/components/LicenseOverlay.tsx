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
          <h1 className="text-3xl font-black font-display text-foreground tracking-tight">Acesso Bloqueado</h1>
          <p className="text-muted-foreground mt-3 text-sm max-w-md mx-auto mb-6">
            Seu período de teste ou assinatura expirou. Renove agora para restaurar imediatamente o acesso ao seu painel.
          </p>
          <Button variant="outline" onClick={signOut} className="mx-auto flex items-center gap-2 rounded-full h-10 px-6 text-muted-foreground hover:text-foreground shadow-sm">
            <LogOut className="h-4 w-4" />
            Sair do Sistema
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {plans.map((plan) => (
            <button
              key={plan.key}
              onClick={() => openPlanCheckout(plan.key, barbershopId)}
              className={`rounded-2xl border p-6 text-center transition-all duration-300 hover:-translate-y-1 ${
                plan.popular
                  ? "border-primary bg-primary/5 shadow-md scale-105 z-10"
                  : "border-border/60 bg-card hover:border-primary/40 shadow-sm"
              }`}
            >
              <plan.icon className={`mx-auto h-8 w-8 mb-3 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-bold text-sm tracking-widest uppercase">{plan.name}</h3>
              <p className="text-2xl font-black text-foreground mt-2">{plan.price}<span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">/mês</span></p>
              <div className={`mt-5 rounded-full py-2.5 text-xs font-black shadow-sm transition-colors ${
                plan.popular
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}>
                <ExternalLink className="h-3.5 w-3.5 inline mr-1" />
                Assinar Agora
              </div>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Pagamento seguro via InfinitePay · Acesso liberado em minutos
        </p>
      </div>

      {isAdmin && (
        <div className="mt-12 bg-amber-500/10 border border-amber-500/30 p-6 rounded-[2rem] max-w-lg w-full text-center shadow-sm">
          <div className="flex items-center justify-center gap-2 text-amber-600 mb-3">
            <Settings className="h-5 w-5" />
            <p className="font-black uppercase tracking-widest text-[11px]">Controles de Super Admin</p>
          </div>
          <p className="text-xs text-amber-600/80 mb-5 font-medium">
            Você está visualizando a tela de bloqueio impenetrável do cliente.
          </p>
          <Button 
            onClick={() => extendTrialMutation.mutate()}
            disabled={extendTrialMutation.isPending}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black h-12 rounded-full shadow-sm"
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
