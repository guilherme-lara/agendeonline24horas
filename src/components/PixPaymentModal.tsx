import { useState, useEffect } from "react";
import { Copy, Check, ExternalLink, QrCode, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  paymentUrl: string;
  pixCode: string;
  pixQrCodeImage: string;
  price: number;
  serviceName: string;
  appointmentId?: string;
  onPaymentConfirmed?: () => void;
}

const PixPaymentModal = ({
  open,
  onClose,
  paymentUrl,
  pixCode,
  pixQrCodeImage,
  price,
  serviceName,
  appointmentId,
  onPaymentConfirmed,
}: PixPaymentModalProps) => {
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    const textToCopy = pixCode || paymentUrl;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast({ title: "Copiado!", description: "Código Pix copiado para a área de transferência." });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: "Erro ao copiar", description: "Tente selecionar e copiar manualmente.", variant: "destructive" });
    }
  };

  // Supabase Realtime: listen for payment confirmation
  useEffect(() => {
    if (!open || !appointmentId || paymentConfirmed) return;

    // Initial check
    supabase
      .from("appointments")
      .select("payment_status, status")
      .eq("id", appointmentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data.payment_status === "paid" || data.status === "confirmed")) {
          setPaymentConfirmed(true);
          onPaymentConfirmed?.();
        }
      });

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`pix-payment-${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${appointmentId}`,
        },
        (payload) => {
          const row = payload.new as { payment_status?: string; status?: string };
          if (row.payment_status === "paid" || row.status === "confirmed") {
            setPaymentConfirmed(true);
            onPaymentConfirmed?.();
          }
        }
      )
      .subscribe();

    // Fallback polling every 8s in case realtime misses
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("appointments")
        .select("payment_status, status")
        .eq("id", appointmentId)
        .maybeSingle();
      if (data && (data.payment_status === "paid" || data.status === "confirmed")) {
        setPaymentConfirmed(true);
        onPaymentConfirmed?.();
      }
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [open, appointmentId, paymentConfirmed, onPaymentConfirmed]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && paymentConfirmed) onClose(); }}>
      <DialogContent className="max-w-[360px] border-border bg-card p-5 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-lg">
            {paymentConfirmed ? "Pagamento Confirmado!" : "Pagamento Pix"}
          </DialogTitle>
        </DialogHeader>

        {paymentConfirmed ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full gold-gradient shadow-gold">
              <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Pagamento de <span className="font-bold text-primary">R$ {price.toFixed(2)}</span> confirmado!
            </p>
            <p className="text-xs text-muted-foreground">Seu agendamento está reservado.</p>
            <Button onClick={onClose} className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90 mt-2">
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              {serviceName} —{" "}
              <span className="font-bold text-primary">R$ {price.toFixed(2)}</span>
            </p>

            {/* QR Code */}
            <div className="mx-auto flex aspect-square w-48 max-w-[80vw] items-center justify-center rounded-xl border border-border bg-white p-2">
              {pixQrCodeImage ? (
                <img
                  src={
                    pixQrCodeImage.startsWith("data:")
                      ? pixQrCodeImage
                      : `data:image/png;base64,${pixQrCodeImage}`
                  }
                  alt="QR Code Pix"
                  className="h-full w-full object-contain"
                />
              ) : (
                <QrCode className="h-20 w-20 text-muted-foreground/30" />
              )}
            </div>

            {/* Pix Copia e Cola */}
            {(pixCode || paymentUrl) && (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-muted-foreground">Pix Copia e Cola</p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2.5">
                  <code className="flex-1 truncate text-xs text-foreground/90 select-all">
                    {pixCode || paymentUrl}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-primary/10"
                    aria-label="Copiar código Pix"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <Button
                  onClick={handleCopy}
                  className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90"
                  size="sm"
                >
                  {copied ? (
                    <><Check className="mr-2 h-4 w-4" /> Copiado!</>
                  ) : (
                    <><Copy className="mr-2 h-4 w-4" /> Copiar Código Pix</>
                  )}
                </Button>
              </div>
            )}

            {paymentUrl && (
              <Button asChild variant="outline" size="sm" className="w-full border-primary/20 hover:bg-primary/5">
                <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir link de pagamento
                </a>
              </Button>
            )}

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <p className="text-[11px] text-muted-foreground">
                Aguardando confirmação do pagamento...
              </p>
            </div>

            <p className="text-[10px] text-muted-foreground/60">
              O horário será reservado automaticamente após a confirmação.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
