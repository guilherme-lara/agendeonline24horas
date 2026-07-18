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
import { Loader2, Plus, Trash2, CreditCard, Banknote, QrCode, Wallet } from "lucide-react";
import { toast } from "sonner";

const METHODS = [
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "pix", label: "Pix", icon: QrCode },
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Comanda</p>
              <p className="font-semibold text-sm">
                {appointment?.client_name ?? "-"} · {appointment?.service_name ?? "-"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-primary">{brl(total)}</p>
            </div>
          </div>

          {!registerId && (
            <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
              Nenhum caixa aberto. Os pagamentos serão registrados no atendimento, mas não
              entrarão em uma sessão de caixa.
            </p>
          )}

          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr,110px,80px,auto] gap-2 items-center"
              >
                <Select
                  value={row.method}
                  onValueChange={(v) => updateRow(idx, { method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => updateRow(idx, { amount: e.target.value })}
                  placeholder="0,00"
                />
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={row.installments}
                  onChange={(e) =>
                    updateRow(idx, { installments: Math.max(1, Number(e.target.value) || 1) })
                  }
                  disabled={row.method !== "credit_card"}
                  title="Parcelas (apenas crédito)"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(idx)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
              <Plus className="h-4 w-4" /> Adicionar forma de pagamento
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm border-t border-border pt-3">
            <div className="space-y-0.5">
              <p className="text-muted-foreground text-xs">Pago</p>
              <p className="font-semibold">{brl(paidTotal)}</p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-muted-foreground text-xs">Restante</p>
              <Badge
                className={
                  remaining === 0
                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                    : remaining < 0
                      ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                      : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                }
              >
                {brl(remaining)}
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SplitPaymentModal;
