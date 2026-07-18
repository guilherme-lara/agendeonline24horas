import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Store, Lock } from "lucide-react";

export default function PDV() {
  const { clinic, loading: clinicLoading } = useClinic();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [initialBalance, setInitialBalance] = useState("");

  const { data: openRegister, isLoading: registerLoading } = useQuery({
    queryKey: ["active-cash-register", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return null;
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("barbershop_id", clinic.id)
        .eq("status", "open")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clinic?.id,
  });

  const openRegisterMutation = useMutation({
    mutationFn: async (balance: number) => {
      if (!clinic?.id || !user?.id) throw new Error("Faltam dados");
      const { data, error } = await supabase
        .from("cash_registers")
        .insert({
          barbershop_id: clinic.id,
          opened_by: user.id,
          initial_balance: balance,
          status: "open",
          opened_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Caixa Aberto", description: "O PDV está liberado para uso." });
      queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao abrir caixa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(initialBalance.replace(",", "."));
    if (isNaN(balance) || balance < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    openRegisterMutation.mutate(balance);
  };

  const isLoading = clinicLoading || registerLoading;
  const isRegisterOpen = !!openRegister;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Carregando Frente de Caixa...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Modal Inadiável de Abrir Caixa */}
      <Dialog open={!isRegisterOpen}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lock className="w-5 h-5 text-amber-500" />
              Caixa Fechado
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Para iniciar as operações do PDV hoje, informe o Fundo de Caixa (troco inicial) disponível na gaveta.
            </p>
            <form onSubmit={handleOpenRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Troco Inicial (R$)</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  required
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="text-lg"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={openRegisterMutation.isPending}>
                {openRegisterMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Store className="w-4 h-4 mr-2" />
                )}
                Abrir Caixa Agora
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interface do PDV (Tela dividida) */}
      <div className="flex-1 flex gap-4">
        {/* Coluna Esquerda: Fila do Dia & Ações */}
        <div className="w-2/3 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 border rounded-xl shadow-sm p-4 flex justify-between items-center">
             <h2 className="text-lg font-semibold tracking-tight">Fila do Dia</h2>
             <Button variant="default" size="lg" className="font-semibold shadow-md">
                + Nova Venda Avulsa
             </Button>
          </div>
          <div className="flex-1 bg-white dark:bg-slate-900 border rounded-xl shadow-sm p-4 overflow-y-auto">
             <p className="text-muted-foreground text-center mt-10">Lista de agendamentos entrará aqui...</p>
          </div>
        </div>

        {/* Coluna Direita: Carrinho / Comanda Atual */}
        <div className="w-1/3 bg-white dark:bg-slate-900 border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-lg font-semibold tracking-tight">Comanda Atual</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center">
            <p className="text-muted-foreground text-center">Nenhuma venda iniciada.</p>
          </div>
          <div className="p-4 border-t bg-slate-50 dark:bg-slate-800/50">
            <div className="flex justify-between items-center mb-4 text-lg font-semibold">
              <span>Total</span>
              <span>R$ 0,00</span>
            </div>
            <Button size="lg" className="w-full text-lg h-14 font-bold" disabled>
              Cobrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
