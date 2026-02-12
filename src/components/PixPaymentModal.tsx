import { useState } from "react";
import { Copy, Check, ExternalLink, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  paymentUrl: string;
  pixCode: string;
  pixQrCodeImage: string;
  price: number;
  serviceName: string;
}

const PixPaymentModal = ({
  open,
  onClose,
  paymentUrl,
  pixCode,
  pixQrCodeImage,
  price,
  serviceName,
}: PixPaymentModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const textToCopy = pixCode || paymentUrl;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center font-display">
            Pagamento Pix
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {serviceName} —{" "}
            <span className="font-bold text-primary">R$ {price.toFixed(2)}</span>
          </p>

          {/* QR Code */}
          <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl border border-border bg-white">
            {pixQrCodeImage ? (
              <img
                src={
                  pixQrCodeImage.startsWith("data:")
                    ? pixQrCodeImage
                    : `data:image/png;base64,${pixQrCodeImage}`
                }
                alt="QR Code Pix"
                className="h-44 w-44 object-contain"
              />
            ) : (
              <QrCode className="h-28 w-28 text-gray-400" />
            )}
          </div>

          {/* Pix Copia e Cola */}
          {(pixCode || paymentUrl) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Pix Copia e Cola
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-2">
                <code className="flex-1 truncate text-xs text-foreground">
                  {pixCode || paymentUrl}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {paymentUrl && (
            <Button
              asChild
              className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90"
            >
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir link de pagamento
              </a>
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground">
            Após o pagamento, seu agendamento será confirmado automaticamente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
