import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, CreditCard, Banknote, QrCode, Wallet, Copy } from "lucide-react";
import { toast } from "sonner";

import { createInfinitePayCharge } from "@/services/infinitepay";

const METHODS = [
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "pix", label: "Pix (InfinitePay)", icon: QrCode },
  { value: "payment_link", label: "Link de Pagamento", icon: QrCode },
  { value: "credit_card", label: "Crédito", icon: CreditCard },
  { value: "debit_card", label: "Débito", icon: CreditCard },
  { value: "transfer", label: "Transferência", icon: Wallet },
] as const;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Row {
  method: string;
  amount: string; // string for input control
  installments: number;
  qrCode?: string;
  isGenerating?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  appointment: {
    id: string;
    barbershop_id: string;
    total_price?: number | null;
    price?: number | null;
    client_name?: string | null;
    service_name?: string | null;
  } | null;
  markAppointmentCompleted?: boolean;
}

const SplitPaymentModal = ({
  open,
  onClose,
  onSuccess,
  appointment,
  markAppointmentCompleted = true,
}: Props) => {
  const total = Number(appointment?.total_price ?? appointment?.price ?? 0);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [registerId, setRegisterId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows([{ method: "cash", amount: total.toFixed(2), installments: 1 }]);
    if (!appointment?.barbershop_id) return;
    (async () => {
      const { data } = await (supabase.from("cash_registers") as any)
        .select("id")
        .eq("barbershop_id", appointment.barbershop_id)
        .eq("status", "open")
        .maybeSingle();
      setRegisterId(data?.id ?? null);
    })();
  }, [open, appointment?.barbershop_id, total]);

  const paidTotal = useMemo(
    () =>
      rows.reduce((s, r) => s + (Number(r.amount.replace(",", ".")) || 0), 0),
    [rows],
  );
  const remaining = +(total - paidTotal).toFixed(2);
  const isValid = Math.abs(remaining) < 0.005 && rows.every((r) => Number(r.amount) > 0);

  const addRow = () => {
    const suggested = Math.max(remaining, 0).toFixed(2);
    setRows((prev) => [...prev, { method: "pix", amount: suggested, installments: 1 }]);
  };
  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const handleGeneratePix = async (idx: number) => {
    const row = rows[idx];
    const amount = Number(row.amount.replace(",", "."));
    if (amount <= 0) return toast.error("Valor inválido");
    if (!appointment) return;

    updateRow(idx, { isGenerating: true });
    try {
      const amountCents = Math.round(amount * 100);
      const [first, ...rest] = String(appointment.client_name || "Cliente").trim().split(" ");
      const res = await createInfinitePayCharge({
        amount: amountCents,
        document_number: "",
        first_name: first || "Cliente",
        last_name: rest.join(" ") || "N",
        appointment_id: appointment.id,
        barbershop_id: appointment.barbershop_id,
      });
      if (!res.success) throw new Error(res.error || "Falha ao gerar cobrança");
      updateRow(idx, { qrCode: res.brcode || res.pix_key, isGenerating: false });
      toast.success("Pix gerado com sucesso");
    } catch (err: any) {
      toast.error(err.message || "Falha ao gerar Pix");
      updateRow(idx, { isGenerating: false });
    }
  };

  const handleSubmit = async () => {
    if (!appointment) return;
    if (!isValid) {
      toast.error("A soma dos pagamentos deve ser igual ao total");
      return;
    }
    setSaving(true);
    try {
      const payments = rows.map((r) => ({
        appointment_id: appointment.id,
        barbershop_id: appointment.barbershop_id,
        amount: Number(r.amount.replace(",", ".")),
        payment_method: r.method,
        installments: r.installments,
        status: "confirmed",
        register_id: registerId,
      }));

      const { error: payErr } = await (supabase.from("appointment_payments") as any).insert(
        payments,
      );
      if (payErr) throw payErr;

      // Registra movimentações no caixa aberto (uma por método)
      if (registerId) {
        const movements = payments.map((p) => ({
          register_id: registerId,
          barbershop_id: appointment.barbershop_id,
          type: "sale",
          amount: p.amount,
          payment_method: p.payment_method,
          description: `Atendimento ${appointment.service_name ?? ""} — ${
            appointment.client_name ?? ""
          }`.trim(),
          appointment_id: appointment.id,
        }));
        await (supabase.from("cash_movements") as any).insert(movements);
      }

      if (markAppointmentCompleted) {
        await (supabase.from("appointments") as any)
          .update({ status: "completed", payment_status: "paid" })
          .eq("id", appointment.id);
      }

      toast.success("Pagamento registrado");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao registrar pagamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border text-foreground shadow-elev-3 p-6 w-full max-w-full sm:max-w-md fixed sm:relative top-auto bottom-0 sm:top-[50%] translate-y-0 sm:-translate-y-1/2 rounded-t-3xl rounded-b-none sm:rounded-2xl m-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-black font-display text-center uppercase tracking-widest">Fechamento / PDV</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo da Comanda */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-inner">
            <div className="flex justify-between items-center border-b border-primary/10 pb-3">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Procedimento</p>
                <p className="font-black text-sm">{appointment?.service_name ?? "-"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cliente</p>
                <p className="font-black text-sm truncate max-w-[120px]">{appointment?.client_name ?? "-"}</p>
              </div>
            </div>
            <div className="flex justify-between items-end pt-1">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Devido</p>
                <p className="text-4xl font-black text-primary font-mono tracking-tighter">{brl(total)}</p>
              </div>
              <Badge variant="outline" className="bg-background border-primary/20 text-primary uppercase text-[10px] font-black h-6">A Receber</Badge>
            </div>
          </div>

          {!registerId && (
            <div className="text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="text-amber-500 font-bold mt-0.5">!</span>
              <p>Nenhum caixa aberto. O pagamento não entrará no saldo do caixa atual.</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Formas de Pagamento</h3>
            </div>
            {rows.map((row, idx) => (
              <div key={idx} className="bg-secondary/30 rounded-2xl p-4 border border-border space-y-3 relative group transition-all hover:border-primary/30">
                <div className="grid grid-cols-[1fr,auto] gap-3">
                  <Select
                    value={row.method}
                    onValueChange={(v) => updateRow(idx, { method: v, qrCode: undefined })}
                  >
                    <SelectTrigger className="bg-background border-border h-12 text-sm font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <div className="flex items-center gap-2"><m.icon className="h-4 w-4 text-primary" /> {m.label}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => updateRow(idx, { amount: e.target.value, qrCode: undefined })}
                      placeholder="0.00"
                      className="bg-background border-border h-12 text-lg font-black font-mono text-emerald-400 w-32 text-right pr-4"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                    {row.method === "credit_card" && (
                        <div className="flex-1 flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground">Parcelas:</span>
                            <Input
                                type="number" min={1} max={12}
                                value={row.installments}
                                onChange={(e) => updateRow(idx, { installments: Math.max(1, Number(e.target.value) || 1) })}
                                className="h-10 w-20 text-center font-bold bg-background border-border"
                            />
                        </div>
                    )}
                    {rows.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeRow(idx)} className="ml-auto h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {(row.method === "pix" || row.method === "payment_link") && (
                  <div className="pt-2 border-t border-border/50">
                    {!row.qrCode ? (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full text-xs h-10 font-bold bg-primary/10 text-primary hover:bg-primary/20"
                        disabled={row.isGenerating || Number(row.amount.replace(",", ".")) <= 0}
                        onClick={() => handleGeneratePix(idx)}
                      >
                        {row.isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                        Gerar {row.method === "pix" ? "Pix" : "Link"}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 bg-background p-2 rounded-xl border border-border">
                        <code className="flex-1 text-[11px] font-mono select-all overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
                          {row.qrCode}
                        </code>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-primary hover:bg-primary/10 shrink-0" 
                          onClick={() => {
                            navigator.clipboard.writeText(row.qrCode || "");
                            toast.success("Código copiado!");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addRow} className="w-full h-12 rounded-2xl border-dashed border-border text-muted-foreground hover:text-foreground font-bold hover:bg-secondary/50 transition-all">
              <Plus className="h-4 w-4 mr-2" /> Dividir Pagamento
            </Button>
          </div>

          <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-sm">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Informado</p>
              <p className="text-xl font-black text-emerald-400 font-mono">{brl(paidTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Diferença</p>
              <p className={`text-xl font-black font-mono ${remaining === 0 ? 'text-emerald-500' : remaining < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                {remaining > 0 ? 'Falta ' : remaining < 0 ? 'Troco ' : ''}{brl(Math.abs(remaining))}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 sm:mt-6 grid grid-cols-2 gap-3 pb-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="h-14 md:h-16 rounded-2xl font-bold text-sm border-border w-full">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving} className="h-14 md:h-16 rounded-2xl font-black text-sm bg-primary text-primary-foreground hover:opacity-90 shadow-elev-1 w-full">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Banknote className="mr-2 h-5 w-5" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SplitPaymentModal;
