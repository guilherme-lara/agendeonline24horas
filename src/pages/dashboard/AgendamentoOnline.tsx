import { useBarbershop } from "@/hooks/useBarbershop";
import { Globe, ExternalLink, Copy, Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const AgendamentoOnline = () => {
  const { barbershop, loading } = useBarbershop();
  const [copied, setCopied] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Fallback de segurança: Se demorar demais, permite resetar o loading
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        setTimedOut(true);
      }, 6000); // 6 segundos de tolerância
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleCopy = () => {
    if (!barbershop?.slug) return;
    const bookingUrl = `${window.location.origin}/agendamentos/${barbershop.slug}`;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !timedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse uppercase tracking-widest">Sincronizando agendamento...</p>
      </div>
    );
  }

  if (timedOut && loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro de Sincronização</AlertTitle>
          <AlertDescription>
            A conexão demorou mais que o esperado. Isso pode ser uma oscilação no banco de dados.
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 w-full border-slate-800">
          <RefreshCw className="h-4 w-4 mr-2" /> Recarregar Sistema
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  const bookingUrl = `${window.location.origin}/agendamentos/${barbershop.slug}`;

  return (
    <div className="p-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-cyan-500/10 p-2 rounded-lg">
          <Globe className="h-6 w-6 text-cyan-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white">Link de Agendamento</h1>
      </div>
      <p className="text-sm text-slate-500 mb-8">
        Este é o seu endereço exclusivo. Divulgue no Instagram e WhatsApp para receber agendamentos 24h.
      </p>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 space-y-6 backdrop-blur-sm shadow-xl">
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">URL Pública</label>
          <div className="flex gap-2">
            <Input value={bookingUrl} readOnly className="bg-slate-950 border-slate-800 text-cyan-400 font-mono text-xs" />
            <Button variant="outline" onClick={handleCopy} className="border-slate-800 hover:bg-slate-800">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="pt-4 border-t border-slate-800/50 flex flex-col gap-3">
            <Button 
                onClick={() => window.open(bookingUrl, "_blank")} 
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold"
            >
                <ExternalLink className="h-4 w-4 mr-2" /> Testar Página de Agendamento
            </Button>
            <p className="text-[10px] text-center text-slate-600 uppercase tracking-tight">
                Dica: Adicione este link na sua Bio do Instagram
            </p>
        </div>
      </div>
    </div>
  );
};

export default AgendamentoOnline;
