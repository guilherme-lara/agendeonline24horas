import { useState, useEffect, useCallback } from "react";
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

  // Polling: check payment status every 5 seconds
  const checkPaymentStatus = useCallback(async () => {
    if (!appointmentId) return;
    const { data } = await supabase
      .from("appointments")
      .select("payment_status, status")
      .eq("id", appointmentId)
      .maybeSingle();

    if (data && (data.payment_status === "paid" || data.status === "confirmed")) {
      setPaymentConfirmed(true);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (!open || !appointmentId || paymentConfirmed) return;
    const interval = setInterval(checkPaymentStatus, 5000);
    // Also check immediately
    checkPaymentStatus();
    return () => clearInterval(interval);
  }, [open, appointmentId, paymentConfirmed, checkPaymentStatus]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-lg">
            {paymentConfirmed ? "Pagamento Confirmado!" : "Pagamento Pix"}
          </DialogTitle>
        </DialogHeader>

        {paymentConfirmed ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full gold-gradient shadow-gold">
              <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Seu pagamento de <span className="font-bold text-primary">R$ {price.toFixed(2)}</span> foi confirmado.
            </p>
            <p className="text-xs text-muted-foreground">Seu agendamento está confirmado!</p>
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

            {/* QR Code - centered and responsive */}
            <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-xl border border-border bg-white p-2">
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
                <QrCode className="h-24 w-24 text-muted-foreground/40" />
              )}
            </div>

            {/* Pix Copia e Cola */}
            {(pixCode || paymentUrl) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Pix Copia e Cola
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-2.5">
                  <code className="flex-1 truncate text-xs text-foreground select-all">
                    {pixCode || paymentUrl}
                  </code>
                </div>
                <Button
                  onClick={handleCopy}
                  className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90"
                  size="sm"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar Código Pix
                    </>
                  )}
                </Button>
              </div>
            )}

            {paymentUrl && (
              <Button
                asChild
                variant="outline"
                className="w-full border-primary/30 hover:bg-primary/5"
              >
                <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir link de pagamento
                </a>
              </Button>
            )}

            {/* Polling indicator */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <p className="text-[11px] text-muted-foreground">
                Aguardando confirmação do pagamento...
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
