import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Loader2, 
  QrCode, 
  Copy, 
  CreditCard, 
  Banknote, 
  Zap, 
  Receipt,
  ArrowRight
} from "lucide-react";
import { CartItem } from "./CartPanel";
import { createInfinitePayCharge } from "@/services/infinitepay";
import { toast } from "sonner";

export interface PaymentSplit {
  method: string;
  amount: number;
  qrCode?: string;
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  customerName: string;
  onConfirm: (method: string, amount: number) => void;
  isSubmitting?: boolean;
}

const PAYMENT_METHODS = [
  { 
    id: "pix", 
    label: "PIX", 
    subtitle: "Instantâneo",
    icon: Zap,
    badge: "Mais Rápido"
  },
  { 
    id: "credit_card", 
    label: "Cartão de Crédito", 
    subtitle: "Maquininha",
    icon: CreditCard,
    badge: null
  },
  { 
    id: "debit_card", 
    label: "Cartão de Débito", 
    subtitle: "Maquininha",
    icon: CreditCard,
    badge: null
  },
  { 
    id: "cash", 
    label: "Dinheiro", 
    subtitle: "Cédula à vista",
    icon: Banknote,
    badge: null
  },
];

export function CheckoutModal({ 
  open, 
  onOpenChange, 
  items, 
  customerName, 
  onConfirm, 
  isSubmitting 
}: CheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>("pix");
  const [cashGiven, setCashGiven] = useState<string>("");
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);

  // Financial calculations
  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.total_price, 0), [items]);
  const totalDeposit = useMemo(() => items.reduce((acc, item) => acc + (item.advance_payment || 0), 0), [items]);
  const totalDue = useMemo(() => Math.max(0, subtotal - totalDeposit), [subtotal, totalDeposit]);

  // Cash change calculation
  const cashGivenNumber = parseFloat(cashGiven.replace(",", "."));
  const changeAmount = !isNaN(cashGivenNumber) && cashGivenNumber > totalDue ? cashGivenNumber - totalDue : 0;

  const handleGeneratePix = async () => {
    if (totalDue <= 0) return;
    setIsGeneratingPix(true);
    try {
      const amountCents = Math.round(totalDue * 100);
      const [first, ...rest] = String(customerName || "Cliente").trim().split(" ");
      const res = await createInfinitePayCharge({
        amount: amountCents,
        document_number: "",
        first_name: first || "Cliente",
        last_name: rest.join(" ") || "N",
        appointment_id: items[0]?.source_appointment_id || "pdv-" + Date.now(),
        barbershop_id: "",
      });

      if (!res.success) throw new Error(res.error || "Falha ao gerar cobrança Pix");
      setPixQrCode(res.brcode || res.pix_key || null);
      toast.success("Pix gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar cobrança Pix");
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setPixQrCode(null);
      setCashGiven("");
      setSelectedMethod("pix");
    }
    onOpenChange(v);
  };

  const handleConfirm = () => {
    onConfirm(selectedMethod, totalDue);
  };

  const currentMethodObj = PAYMENT_METHODS.find(m => m.id === selectedMethod) || PAYMENT_METHODS[0];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 border-border bg-card">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Fechamento de Comanda
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {customerName ? (
                  <>Cliente: <span className="font-semibold text-foreground">{customerName}</span> • </>
                ) : null}
                {items.length} {items.length === 1 ? "item" : "itens"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Financial Breakdown Card */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
            {totalDeposit > 0 ? (
              <>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Valor dos Procedimentos/Produtos:</span>
                  <span className="font-semibold text-foreground">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 -mx-2 px-2 py-1 rounded-lg">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Sinal Online Pago Antecipadamente
                  </span>
                  <span>- R$ {totalDeposit.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="border-t border-border/80 pt-2 flex justify-between items-baseline">
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Total Devido Agora
                  </span>
                  <span className="text-3xl font-black text-foreground">
                    R$ {totalDue.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-baseline py-1">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Total a Cobrar
                </span>
                <span className="text-4xl font-black text-foreground">
                  R$ {totalDue.toFixed(2).replace(".", ",")}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method Selector: 4 Big Tactile Buttons */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Forma de Pagamento
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedMethod === method.id;

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethod(method.id)}
                    className={`relative flex flex-col p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/30 shadow-xs"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/40 text-foreground"
                    }`}
                  >
                    {method.badge && (
                      <span className="absolute top-2.5 right-2.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {method.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <span className="font-bold text-sm leading-tight text-foreground">{method.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{method.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contextual Options based on selected payment method */}
          {selectedMethod === "pix" && (
            <div className="p-3.5 bg-muted/20 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Cobrança PIX</span>
                {!pixQrCode && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 gap-1"
                    disabled={isGeneratingPix || totalDue <= 0}
                    onClick={handleGeneratePix}
                  >
                    {isGeneratingPix ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <QrCode className="w-3.5 h-3.5" />
                    )}
                    Gerar QR Code na Tela
                  </Button>
                )}
              </div>

              {pixQrCode ? (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2 bg-background p-2 rounded-lg border border-border">
                    <code className="text-[11px] font-mono truncate flex-1 select-all">
                      {pixQrCode}
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(pixQrCode);
                        toast.success("Código Pix copiado!");
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Apresente a chave para o cliente ou aguarde a transferência.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Receba via maquininha ou chave Pix da clínica e confirme abaixo.
                </p>
              )}
            </div>
          )}

          {selectedMethod === "cash" && (
            <div className="p-3.5 bg-muted/20 border border-border rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Valor em Dinheiro Entregue</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={`R$ ${totalDue.toFixed(2)}`}
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    className="h-10 text-sm font-bold bg-background"
                  />
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border text-right">
                  <span className="text-[11px] text-muted-foreground block font-medium">Troco a Devolver</span>
                  <span className={`text-base font-black ${changeAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                    R$ {changeAmount.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {(selectedMethod === "credit_card" || selectedMethod === "debit_card") && (
            <div className="p-3 bg-muted/20 border border-border rounded-xl">
              <p className="text-xs text-muted-foreground text-center">
                Passe o valor de <strong className="text-foreground">R$ {totalDue.toFixed(2).replace(".", ",")}</strong> na maquininha de cartão e clique em confirmar.
              </p>
            </div>
          )}

          {/* Giant Primary Confirmation Button */}
          <Button
            size="lg"
            className="w-full h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.99] disabled:opacity-50"
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Registrando Venda...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6 mr-2" />
                Confirmar • R$ {totalDue.toFixed(2).replace(".", ",")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
