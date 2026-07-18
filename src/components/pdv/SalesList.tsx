import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Loader2, Play } from "lucide-react";

interface SalesListProps {
  barbershopId?: string;
  status: "open" | "paid" | "closed";
  onSelectSale: (sale: any) => void;
}

export function SalesList({ barbershopId, status, onSelectSale }: SalesListProps) {
  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales", barbershopId, status],
    queryFn: async () => {
      if (!barbershopId) return [];
      
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sales_items (*)
        `)
        .eq("barbershop_id", barbershopId)
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!barbershopId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sales || sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-50 border border-dashed rounded-2xl">
        <Receipt className="w-10 h-10 text-zinc-300 mb-2" />
        <p className="text-sm font-semibold text-zinc-500">Nenhuma comanda {status === 'open' ? 'aberta' : 'fechada'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {sales.map((sale: any) => (
        <div key={sale.id} className="bg-white border rounded-xl p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm text-foreground">Comanda #{sale.id.substring(0, 6)}</span>
              <Badge variant={status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                {status === 'open' ? 'Em Aberto' : 'Fechada'}
              </Badge>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {sale.sales_items?.length || 0} itens &bull; R$ {Number(sale.total_amount).toFixed(2).replace(".", ",")}
            </p>
          </div>
          <Button variant={status === 'open' ? 'default' : 'outline'} size="sm" onClick={() => onSelectSale(sale)}>
            {status === 'open' ? <><Play className="w-4 h-4 mr-1" /> Retomar</> : 'Ver Detalhes'}
          </Button>
        </div>
      ))}
    </div>
  );
}
