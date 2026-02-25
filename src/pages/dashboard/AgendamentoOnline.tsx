import { useBarbershop } from "@/hooks/useBarbershop";
import { Globe, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const AgendamentoOnline = () => {
  const { barbershop, loading } = useBarbershop();
  const [copied, setCopied] = useState(false);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!barbershop) return null;

  const bookingUrl = `${window.location.origin}/agendamentos/${barbershop.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <h1 className="font-display text-2xl font-bold flex items-center gap-2 mb-2">
        <Globe className="h-6 w-6 text-primary" /> Agendamento Online
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Compartilhe este link com seus clientes para que eles possam agendar online.
      </p>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <label className="text-sm font-medium">Link de agendamento</label>
        <div className="flex gap-2">
          <Input value={bookingUrl} readOnly className="bg-secondary" />
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <Button onClick={() => window.open(bookingUrl, "_blank")} className="gold-gradient text-primary-foreground font-semibold">
          <ExternalLink className="h-4 w-4 mr-2" /> Abrir Página
        </Button>
      </div>
    </div>
  );
};

export default AgendamentoOnline;
