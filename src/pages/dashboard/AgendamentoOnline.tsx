import { useBarbershop } from "@/hooks/useBarbershop";
import { Globe, ExternalLink, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const AgendamentoOnline = () => {
  // Agora utiliza a inteligência do React Query vinda do hook
  const { barbershop, loading, isError } = useBarbershop() as any;
  const [copied, setCopied] = useState(false);

  // Proteção contra loading infinito
  const queryEnabled = !!barbershop?.id;

  const handleCopy = () => {
    if (!barbershop?.slug) return;
    const bookingUrl = `${window.location.origin}/agendamentos/${barbershop.slug}`;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Carregamento inicial limpo e reativo
  if (loading && queryEnabled && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse uppercase tracking-widest">Sincronizando agendamento...</p>
      </div>
    );
  }

  // Tratamento de erro robusto (adeus F5 manual)
  if (isError && !barbershop) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400 shadow-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Falha na Sincronização</AlertTitle>
          <AlertDescription>
            Não conseguimos carregar o seu endereço de agendamento. Verifique sua internet.
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 w-full border-slate-800 hover:bg-slate-800">
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
        <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
          <Globe className="h-6 w-6 text-cyan-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Agendamento Online</h1>
      </div>
      <p className="text-sm text-slate-500 mb-8">
        Seu endereço exclusivo está ativo. Divulgue no Instagram para receber agendamentos 24h.
      </p>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 space-y-6 backdrop-blur-sm shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Globe className="h-20 w-20" />
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Link Público</label>
          <div className="flex gap-2">
            <Input value={bookingUrl} readOnly className="bg-slate-950 border-slate-800 text-cyan-400 font-mono text-xs focus-visible:ring-cyan-500/50" />
            <Button variant="outline" onClick={handleCopy} className="border-slate-800 hover:bg-slate-800 hover:text-white transition-all">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="pt-4 border-t border-slate-800/50 flex flex-col gap-3">
            <Button 
                onClick={() => window.open(bookingUrl, "_blank")} 
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-900/20"
            >
                <ExternalLink className="h-4 w-4 mr-2" /> Visualizar Página do Cliente
            </Button>
            <p className="text-[10px] text-center text-slate-600 uppercase tracking-tight font-bold">
                Dica: O link é atualizado automaticamente se você mudar seu slug
            </p>
        </div>
      </div>
    </div>
  );
};

export default AgendamentoOnline;
