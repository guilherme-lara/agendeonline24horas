import PaymentSettingsTab from "@/components/PaymentSettingsTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, CreditCard, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Pagamentos = () => {
  const { barbershop, loading, isError, refetch } = useBarbershop() as any;
  const queryEnabled = !!barbershop?.id;

  if (loading && queryEnabled && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Sincronizando métodos de recebimento...</p>
      </div>
    );
  }

  if (isError && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de conexão</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar suas configurações de pagamento.</p>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex items-center gap-4 border-b border-border pb-8">
        <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
          <CreditCard className="h-7 w-7 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight font-display">Pagamentos</h1>
          <p className="text-muted-foreground text-sm font-medium">Configure o recebimento de sinais e a integração com a InfinitePay.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-2 md:p-6 shadow-card">
        <PaymentSettingsTab barbershopId={barbershop.id} />
      </div>
      
      <p className="text-center text-[10px] text-muted-foreground/50 uppercase font-bold mt-8 tracking-widest">
        🔒 Transações processadas com segurança via criptografia SSL
      </p>
    </div>
  );
};

export default Pagamentos;