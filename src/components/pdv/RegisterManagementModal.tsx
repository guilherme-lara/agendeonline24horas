import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, ArrowDownCircle, ArrowUpCircle, Lock, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface RegisterManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeRegister: any;
  clinicId: string;
}

export function RegisterManagementModal({ open, onOpenChange, activeRegister, clinicId }: RegisterManagementModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [mode, setMode] = useState<"options" | "sangria" | "suprimento" | "close">("options");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const cashMovementMutation = useMutation({
    mutationFn: async ({ type, value, note }: { type: string, value: number, note: string }) => {
      if (!activeRegister || !user?.id) throw new Error("Caixa inválido");
      
      const { error } = await supabase.from("cash_movements").insert({
        barbershop_id: clinicId,
        register_id: activeRegister.id,
        amount: type === "sangria" ? -value : value, // negative for sangria
        movement_type: type,
        origin_type: "cash_register",
        origin_id: activeRegister.id,
        payment_method: "cash",
        created_by: user.id,
        description: note
      } as any);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({ title: "Sucesso", description: `Operação de ${variables.type} registrada.` });
      setAmount("");
      setReason("");
      setMode("options");
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const closeRegisterMutation = useMutation({
    mutationFn: async () => {
      if (!activeRegister) throw new Error("Caixa inválido");
      
      const { error } = await supabase.from("cash_registers").update({
        status: "closed",
        closed_at: new Date().toISOString(),
      }).eq("id", activeRegister.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Caixa Fechado", description: "As operações do dia foram encerradas." });
      queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const handleCashMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    
    cashMovementMutation.mutate({ type: mode, value: val, note: reason || mode });
  };

  const handleClose = () => {
    if (confirm("Tem certeza que deseja FECHAR o caixa? Esta ação não pode ser desfeita e exigirá a abertura de um novo caixa para continuar operando.")) {
      closeRegisterMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) setMode("options");
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "options" && "Gerenciar Caixa Atual"}
            {mode === "sangria" && "Realizar Sangria (Retirada)"}
            {mode === "suprimento" && "Realizar Suprimento (Reforço)"}
            {mode === "close" && "Fechamento de Caixa"}
          </DialogTitle>
        </DialogHeader>

        {mode === "options" && (
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button variant="outline" className="h-16 justify-start text-lg font-normal" onClick={() => setMode("suprimento")}>
              <ArrowUpCircle className="w-6 h-6 mr-3 text-emerald-500" />
              <div>
                <div className="font-semibold text-left">Suprimento</div>
                <div className="text-sm text-muted-foreground">Adicionar troco à gaveta</div>
              </div>
            </Button>
            <Button variant="outline" className="h-16 justify-start text-lg font-normal" onClick={() => setMode("sangria")}>
              <ArrowDownCircle className="w-6 h-6 mr-3 text-rose-500" />
              <div>
                <div className="font-semibold text-left">Sangria</div>
                <div className="text-sm text-muted-foreground">Retirar dinheiro da gaveta</div>
              </div>
            </Button>
            <div className="border-t my-2"></div>
            <Button variant="destructive" className="h-16 justify-start text-lg font-normal" onClick={() => setMode("close")}>
              <Lock className="w-6 h-6 mr-3" />
              <div>
                <div className="font-semibold text-left">Fechar Caixa</div>
                <div className="text-sm text-white/80">Encerrar expediente</div>
              </div>
            </Button>
          </div>
        )}

        {(mode === "sangria" || mode === "suprimento") && (
          <form onSubmit={handleCashMovement} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor (Dinheiro R$)</label>
              <Input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo / Observação</label>
              <Input required placeholder={mode === "sangria" ? "Ex: Pagamento de água" : "Ex: Troco para o dia"} value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setMode("options")} className="flex-1">Voltar</Button>
              <Button type="submit" disabled={cashMovementMutation.isPending} className={\`flex-1 \${mode === "sangria" ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-emerald-500 hover:bg-emerald-600 text-white"}\`}>
                {cashMovementMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </form>
        )}

        {mode === "close" && (
          <div className="space-y-4 py-4 text-center">
            <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-lg text-sm mb-4">
              Ao fechar o caixa, você não poderá realizar novas vendas até abrir um novo caixa. 
              Geralmente feito ao final do expediente.
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setMode("options")} className="flex-1">Cancelar</Button>
              <Button onClick={handleClose} disabled={closeRegisterMutation.isPending} variant="destructive" className="flex-1">
                {closeRegisterMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                Confirmar Fechamento
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
