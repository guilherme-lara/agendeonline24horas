import FinancialTab from "@/components/FinancialTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const Relatorios = () => {
  const { barbershop, loading, refetch } = useBarbershop();

  // Se estiver carregando, exibe o spinner
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // TELA DE PROTEÇÃO: Se não houver barbearia após o carregamento, houve falha de conexão ou dados
  if (!barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Erro ao carregar relatórios</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Não conseguimos conectar aos dados da sua barbearia.
        </p>
        <Button 
          onClick={() => refetch()} 
          className="gold-gradient text-primary-foreground font-semibold px-8"
        >
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <FinancialTab barbershopId={barbershop.id} />
    </div>
  );
};

export default Relatorios;
