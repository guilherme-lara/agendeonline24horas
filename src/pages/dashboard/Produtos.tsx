import InventoryTab from "@/components/InventoryTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, Package, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Produtos = () => {
  const { barbershop, loading, isError, refetch } = useBarbershop() as any;
  const queryEnabled = !!barbershop?.id;

  if (loading && queryEnabled && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Sincronizando inventário...</p>
      </div>
    );
  }

  if (isError && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronia</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar a lista de produtos.</p>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex items-center gap-4 border-b border-border pb-8">
        <div className="bg-primary/10 p-3 rounded-2xl border border-primary/20">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight font-display">Produtos & Estoque</h1>
          <p className="text-muted-foreground text-sm font-medium">Gerencie o inventário e venda de produtos do seu negócio.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 shadow-card">
        <InventoryTab barbershopId={barbershop.id} />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center text-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Sincronia Ativa</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center text-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]" />
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Baixa Automática no PDV</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center text-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Controle de Validade</p>
        </div>
      </div>
    </div>
  );
};

export default Produtos;