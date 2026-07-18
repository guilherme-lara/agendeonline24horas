import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Plus, Trash2, Loader2 } from "lucide-react";
import { CartItem } from "./CartPanel";

export interface PaymentSplit {
  method: string;
  amount: number;
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  customerName: string;
  onConfirm: (payments: PaymentSplit[]) => void;
  isSubmitting?: boolean;
}

const PAYMENT_METHODS = [
  { id: "pix", label: "Pix" },
  { id: "credit_card", label: "Cartão de Crédito" },
  { id: "debit_card", label: "Cartão de Débito" },
  { id: "cash", label: "Dinheiro" },
];

export function CheckoutModal({ open, onOpenChange, items, customerName, onConfirm, isSubmitting }: CheckoutModalProps) {
  const total = items.reduce((acc, item) => acc + item.total_price, 0);
  
  const [payments, setPayments] = useState<PaymentSplit[]>([]);
  const [currentMethod, setCurrentMethod] = useState("pix");
  const [currentAmount, setCurrentAmount] = useState("");

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const isPaid = remaining === 0;

  // Auto-fill remaining amount when modal opens or total changes
  // But we use a side-effect free approach: just default the input to remaining if empty.

  const handleAddPayment = () => {
    const amt = parseFloat(currentAmount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) return;
    
    // Check if adding this exceeds total
    const finalAmt = Math.min(amt, remaining);
    
    setPayments([...payments, { method: currentMethod, amount: finalAmt }]);
    setCurrentAmount("");
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (!isPaid) return;
    onConfirm(payments);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setPayments([]);
        setCurrentAmount("");
      }
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Finalizar Venda</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2 md:col-span-1 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border flex flex-col items-center justify-center">
            <span className="text-sm text-muted-foreground font-medium mb-1">Total da Venda</span>
            <span className="text-3xl font-black">R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
          
          <div className={`col-span-2 md:col-span-1 rounded-xl p-4 border flex flex-col items-center justify-center transition-colors ${isPaid ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>
            <span className={`text-sm font-medium mb-1 ${isPaid ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {isPaid ? 'Total Pago' : 'Falta Pagar'}
            </span>
            <span className={`text-3xl font-black ${isPaid ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500'}`}>
              R$ {isPaid ? totalPaid.toFixed(2).replace(".", ",") : remaining.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>

        {/* Pagamentos List */}
        <div className="space-y-3 mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pagamentos Lançados</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum pagamento registrado.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg border bg-white dark:bg-slate-950">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {PAYMENT_METHODS.find((m) => m.id === p.method)?.label || p.method}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">R$ {p.amount.toFixed(2).replace(".", ",")}</span>
                    <button onClick={() => handleRemovePayment(i)} className="text-rose-500 hover:text-rose-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Payment Form */}
        {!isPaid && (
          <div className="flex gap-2 items-end bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-dashed">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium">Método</label>
              <Select value={currentMethod} onValueChange={setCurrentMethod}>
                <SelectTrigger className="bg-white dark:bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium">Valor (R$)</label>
              <Input 
                type="number" 
                step="0.01" 
                className="bg-white dark:bg-slate-950 font-bold"
                placeholder={remaining.toFixed(2)}
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPayment()}
              />
            </div>
            <Button onClick={handleAddPayment} variant="secondary" className="font-semibold px-3">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        )}

        <div className="mt-6">
          <Button 
            size="lg" 
            className="w-full text-lg h-14 font-bold" 
            disabled={!isPaid || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="w-6 h-6 mr-2" />
            )}
            {isSubmitting ? "Processando..." : "Confirmar Venda"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
