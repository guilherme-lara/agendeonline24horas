import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Store, Calendar, TrendingUp, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

function RegisterDetailsModal({ register, open, onOpenChange }: { register: any, open: boolean, onOpenChange: (o: boolean) => void }) {
  const { data: movements, isLoading } = useQuery({
    queryKey: ["cash-movements-history", register?.id],
    queryFn: async () => {
      if (!register?.id) return [];
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("register_id", register.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!register?.id && open,
  });

  const totals = (movements || []).reduce(
    (acc: any, m: any) => {
      const a = Number(m.amount) || 0;
      if (m.movement_type === "sale" && m.payment_method === "cash") acc.cash += a;
      else if (m.movement_type === "sale") acc.other += a;
      else if (m.movement_type === "suprimento") acc.suprimento += a;
      else if (m.movement_type === "sangria") acc.sangria += a;
      return acc;
    },
    { cash: 0, other: 0, suprimento: 0, sangria: 0 },
  );
  
  const expectedCash = Number(register?.initial_balance || 0) + totals.cash + totals.suprimento - totals.sangria;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Caixa</DialogTitle>
        </DialogHeader>
        
        {register && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Status:</span>
                <Badge variant={register.status === 'open' ? 'default' : 'secondary'} className={register.status === 'open' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                  {register.status === 'open' ? 'Aberto' : 'Fechado'}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Abertura:</span>
                <span>{format(parseISO(register.opened_at), "dd/MM/yyyy 'às' HH:mm")} {register.users?.name ? `por ${register.users.name}` : ''}</span>
              </div>
              {register.closed_at && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Fechamento:</span>
                  <span>{format(parseISO(register.closed_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Abertura</p>
                <p className="text-base font-semibold">R$ {Number(register.initial_balance).toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendas (Dinheiro)</p>
                <p className="text-base font-semibold text-emerald-600">R$ {totals.cash.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sangrias</p>
                <p className="text-base font-semibold text-rose-600">R$ {totals.sangria.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Em Caixa</p>
                <p className="text-base font-semibold text-emerald-600">R$ {expectedCash.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Movimentações</h3>
              {isLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : movements?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center p-4 border rounded-lg">Nenhuma movimentação registrada.</p>
              ) : (
                <div className="space-y-2">
                  {movements?.map((m: any) => (
                    <div key={m.id} className="flex justify-between items-center p-3 border rounded-lg text-sm bg-white dark:bg-slate-950">
                      <div className="flex items-center gap-3">
                        {m.movement_type === 'sangria' ? (
                          <ArrowDownCircle className="w-5 h-5 text-rose-500" />
                        ) : m.movement_type === 'suprimento' ? (
                          <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Wallet className="w-5 h-5 text-blue-500" />
                        )}
                        <div>
                          <div className="font-medium capitalize">{m.movement_type} {m.payment_method ? `(${m.payment_method})` : ''}</div>
                          <div className="text-xs text-muted-foreground">{format(parseISO(m.created_at), "HH:mm")} • {m.description || 'Sem descrição'}</div>
                        </div>
                      </div>
                      <div className={`font-bold ${m.movement_type === 'sangria' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {m.movement_type === 'sangria' ? '-' : '+'} R$ {Number(Math.abs(m.amount)).toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function PDVHistorico() {
  const { clinic } = useClinic() as any;
  const [selectedRegister, setSelectedRegister] = useState<any>(null);

  const { data: registers, isLoading } = useQuery({
    queryKey: ["cash-registers-history", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      
      const { data, error } = await supabase
        .from("cash_registers")
        .select(`
          *,
          users ( name )
        `)
        .eq("barbershop_id", clinic.id)
        .order("opened_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data;
    },
    enabled: !!clinic?.id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Caixa</h1>
          <p className="text-muted-foreground">Veja as últimas sessões de PDV</p>
        </div>
      </div>

      <div className="grid gap-4">
        {registers?.map((reg) => (
          <div 
            key={reg.id} 
            onClick={() => setSelectedRegister(reg)}
            className="bg-white dark:bg-slate-900 border rounded-xl p-4 flex justify-between items-center shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${reg.status === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {format(parseISO(reg.opened_at), "dd/MM/yyyy")}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reg.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {reg.status === 'open' ? 'Aberto' : 'Fechado'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4" /> 
                  Abertura: {format(parseISO(reg.opened_at), "HH:mm")}
                  {reg.closed_at && ` • Fechamento: ${format(parseISO(reg.closed_at), "HH:mm")}`}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-medium text-muted-foreground mb-1">Troco Inicial</div>
              <div className="font-bold text-lg">
                R$ {reg.initial_balance.toFixed(2).replace(".", ",")}
              </div>
            </div>
          </div>
        ))}

        {registers?.length === 0 && (
          <div className="text-center p-10 bg-white dark:bg-slate-900 border rounded-xl">
            <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-medium">Nenhum caixa encontrado</p>
          </div>
        )}
      </div>

      <RegisterDetailsModal 
        register={selectedRegister} 
        open={!!selectedRegister} 
        onOpenChange={(v) => !v && setSelectedRegister(null)} 
      />
    </div>
  );
}
