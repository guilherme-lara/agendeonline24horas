import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Store, Calendar, TrendingUp } from "lucide-react";

export default function PDVHistorico() {
  const { clinic } = useClinic() as any;

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
          <div key={reg.id} className="bg-white dark:bg-slate-900 border rounded-xl p-4 flex justify-between items-center shadow-sm hover:shadow transition-all">
            <div className="flex items-center gap-4">
              <div className={\`p-3 rounded-full \${reg.status === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}\`}>
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {format(parseISO(reg.opened_at), "dd/MM/yyyy")}
                  </span>
                  <span className={\`text-xs font-semibold px-2 py-0.5 rounded-full \${reg.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}\`}>
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
    </div>
  );
}
