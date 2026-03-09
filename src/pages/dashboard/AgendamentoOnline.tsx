import { useBarbershop } from "@/hooks/useBarbershop";
import { Globe, ExternalLink, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const AgendamentoOnline = () => {
  const { barbershop, loading, isError } = useBarbershop() as any;
  const [copied, setCopied] = useState(false);
  const queryEnabled = !!barbershop?.id;

  const handleCopy = () => {
    if (!barbershop?.slug) return;
    const bookingUrl = `${window.location.origin}/agendamentos/${barbershop.slug}`;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && queryEnabled && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest">Sincronizando agendamento...</p>
      </div>
    );
  }

  if (isError && !barbershop) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400 shadow-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Falha na Sincronização</AlertTitle>
          <AlertDescription>Não conseguimos carregar o seu endereço de agendamento.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 w-full border-border hover:bg-secondary">
           Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  const bookingUrl = `${window.location.origin}/agendamentos/${barbershop.slug}`;

  return (
    <div className="p-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
          <Globe className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Agendamento Online</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Seu endereço exclusivo está ativo. Divulgue no Instagram para receber agendamentos 24h.
      </p>

      <div className="rounded-2xl border border-border bg-card p-8 space-y-6 shadow-card relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Globe className="h-20 w-20" />
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Link Público</label>
          <div className="flex gap-2">
            <Input value={bookingUrl} readOnly className="bg-background border-border text-primary font-mono text-xs focus-visible:ring-primary/50" />
            <Button variant="outline" onClick={handleCopy} className="border-border hover:bg-secondary hover:text-foreground transition-all">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="pt-4 border-t border-border/50 flex flex-col gap-3">
            <Button 
                onClick={() => window.open(bookingUrl, "_blank")} 
                className="w-full gold-gradient text-primary-foreground font-bold shadow-gold"
            >
                <ExternalLink className="h-4 w-4 mr-2" /> Visualizar Página do Cliente
            </Button>
            <p className="text-[10px] text-center text-muted-foreground/50 uppercase tracking-tight font-bold">
                Dica: O link é atualizado automaticamente se você mudar seu slug
            </p>
        </div>
      </div>
    </div>
  );
};

export default AgendamentoOnline;