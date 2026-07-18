import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2, DoorOpen, DoorClosed, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { toast } from "sonner";

type MovementType = "sangria" | "suprimento";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CashRegisterPanel = () => {
  const { clinic, professionalId } = useClinic() as any;
  const qc = useQueryClient();
  const [openDialog, setOpenDialog] = useState<null | "open" | "close" | MovementType>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const shopId: string | undefined = clinic?.id;

  const { data: register, isLoading } = useQuery({
    queryKey: ["cash-register-open", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await (supabase.from("cash_registers") as any)
        .select("*")
        .eq("barbershop_id", shopId)
        .eq("status", "open")
        .maybeSingle();
      return data as any | null;
    },
    staleTime: 30 * 1000,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["cash-movements", register?.id],
    enabled: !!register?.id,
    queryFn: async () => {
      const { data } = await (supabase.from("cash_movements") as any)
        .select("id, type, amount, payment_method, description, created_at")
        .eq("register_id", register.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
  });

  const totals = (movements || []).reduce(
    (acc: any, m: any) => {
      const a = Number(m.amount) || 0;
      if (m.type === "sale" && m.payment_method === "cash") acc.cash += a;
      else if (m.type === "sale") acc.other += a;
      else if (m.type === "suprimento") acc.suprimento += a;
      else if (m.type === "sangria") acc.sangria += a;
      return acc;
    },
    { cash: 0, other: 0, suprimento: 0, sangria: 0 },
  );
  const expectedCash =
    Number(register?.initial_balance || 0) + totals.cash + totals.suprimento - totals.sangria;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cash-register-open", shopId] });
    qc.invalidateQueries({ queryKey: ["cash-movements"] });
  };

  const openMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(",", ".")) || 0;
      const { error } = await (supabase.from("cash_registers") as any).insert({
        barbershop_id: shopId,
        opened_by: professionalId,
        initial_balance: value,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa aberto");
      setOpenDialog(null);
      setAmount("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao abrir caixa"),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(",", ".")) || 0;
      const { error } = await (supabase.from("cash_registers") as any)
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: professionalId,
          final_balance: value,
          expected_balance: expectedCash,
        })
        .eq("id", register.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa fechado");
      setOpenDialog(null);
      setAmount("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao fechar caixa"),
  });

  const movementMutation = useMutation({
    mutationFn: async (type: MovementType) => {
      const value = Number(amount.replace(",", ".")) || 0;
      if (value <= 0) throw new Error("Valor inválido");
      const { error } = await (supabase.from("cash_movements") as any).insert({
        register_id: register.id,
        barbershop_id: shopId,
        type,
        amount: value,
        payment_method: type === "sangria" || type === "suprimento" ? "cash" : paymentMethod,
        description: description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      setOpenDialog(null);
      setAmount("");
      setDescription("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao registrar"),
  });

  if (!shopId) return null;

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Frente de Caixa</p>
              {isLoading ? (
                <p className="text-xs text-muted-foreground">Verificando...</p>
              ) : register ? (
                <p className="text-xs text-muted-foreground">
                  Aberto em{" "}
                  {new Date(register.opened_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum caixa aberto</p>
              )}
            </div>
          </div>

          {register ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              Aberto
            </Badge>
          ) : (
            <Badge variant="outline">Fechado</Badge>
          )}
        </div>

        {register && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Abertura" value={brl(Number(register.initial_balance))} />
            <Stat label="Vendas em dinheiro" value={brl(totals.cash)} />
            <Stat label="Sangrias" value={brl(totals.sangria)} tone="danger" />
            <Stat label="Esperado em caixa" value={brl(expectedCash)} tone="success" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!register ? (
            <Button onClick={() => setOpenDialog("open")} className="gap-2">
              <DoorOpen className="h-4 w-4" /> Abrir caixa
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setOpenDialog("suprimento")}
                className="gap-2"
              >
                <ArrowUpCircle className="h-4 w-4" /> Suprimento
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpenDialog("sangria")}
                className="gap-2"
              >
                <ArrowDownCircle className="h-4 w-4" /> Sangria
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setAmount(expectedCash.toFixed(2));
                  setOpenDialog("close");
                }}
                className="gap-2 ml-auto"
              >
                <DoorClosed className="h-4 w-4" /> Fechar caixa
              </Button>
            </>
          )}
        </div>
      </CardContent>

      {/* Diálogo unificado */}
      <Dialog open={openDialog !== null} onOpenChange={(v) => !v && setOpenDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {openDialog === "open" && "Abrir caixa"}
              {openDialog === "close" && "Fechar caixa"}
              {openDialog === "suprimento" && "Registrar suprimento"}
              {openDialog === "sangria" && "Registrar sangria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <label className="text-xs text-muted-foreground">
              {openDialog === "open" ? "Saldo inicial (R$)" : "Valor (R$)"}
            </label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />

            {(openDialog === "sangria" || openDialog === "suprimento") && (
              <>
                <label className="text-xs text-muted-foreground">Descrição</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Motivo / observação"
                />
              </>
            )}

            {openDialog === "close" && (
              <p className="text-xs text-muted-foreground">
                Esperado: <span className="font-semibold">{brl(expectedCash)}</span>. Informe o
                valor real conferido no caixa.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDialog(null)}>
              Cancelar
            </Button>
            <Button
              disabled={openMutation.isPending || closeMutation.isPending || movementMutation.isPending}
              onClick={() => {
                if (openDialog === "open") openMutation.mutate();
                else if (openDialog === "close") closeMutation.mutate();
                else if (openDialog) movementMutation.mutate(openDialog);
              }}
            >
              {(openMutation.isPending || closeMutation.isPending || movementMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p
      className={`text-base font-semibold ${
        tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-rose-600" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

export default CashRegisterPanel;
