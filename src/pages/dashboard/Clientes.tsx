import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, AlertTriangle, UserSearch, RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Customer {
  id: string;
  name: string;
  phone: string;
  last_seen: string;
  appointment_count: number;
}

const Clientes = () => {
  const { barbershop } = useBarbershop();
  const queryEnabled = !!barbershop?.id;

  const { data: customers = [], isLoading, isError, refetch } = useQuery<Customer[]>(
    ["customers", barbershop?.id],
    async () => {
      if (!barbershop?.id) return [];

      // Usamos uma RPC para buscar clientes e agregar contagem de agendamentos e última visita
      const { data, error } = await supabase.rpc("get_customers_with_stats", {
        _barbershop_id: barbershop.id,
      });

      if (error) {
        console.error("Erro ao buscar clientes com estatísticas:", error);
        throw new Error(error.message);
      }
      return data || [];
    },
    { enabled: queryEnabled }
  );

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  if (isLoading && queryEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Buscando Clientes...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de Sincronização</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar sua lista de clientes.</p>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="mb-10">
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight font-display">
                <UserSearch className="h-8 w-8 text-primary" /> Carteira de Clientes
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium">Gerencie seus clientes e veja o histórico de agendamentos.</p>
        </div>

        {customers.length === 0 ? (
            <div className="bg-card border border-border rounded-3xl p-16 text-center shadow-card">
                <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                    <UserSearch className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Nenhum cliente cadastrado</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Sua carteira de clientes será preenchida automaticamente a cada novo agendamento online.</p>
            </div>
        ) : (
            <div className="bg-card border-border rounded-3xl shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary/30">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Contagem</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Última Visita</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {customers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-secondary/20 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-bold text-foreground">{customer.name}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{formatPhoneNumber(customer.phone)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {customer.appointment_count} {customer.appointment_count === 1 ? 'agendamento' : 'agendamentos'}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-foreground text-xs font-medium capitalize">
                                            {formatDistanceToNow(new Date(customer.last_seen), { addSuffix: true, locale: ptBR })}
                                        </div>
                                        <div className="text-muted-foreground text-[10px] uppercase tracking-tighter">
                                            {format(new Date(customer.last_seen), 'dd/MM/yyyy')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <Button 
                                            variant="outline"
                                            size="sm"
                                            asChild
                                            className="border-emerald-500/30 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/80 hover:text-emerald-300"
                                        >
                                            <a href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                                <MessageSquare className="h-4 w-4 mr-2" /> Conversar
                                            </a>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};

export default Clientes;
