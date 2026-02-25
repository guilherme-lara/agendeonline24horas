import FinancialTab from "@/components/FinancialTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2 } from "lucide-react";

const Relatorios = () => {
  const { barbershop, loading } = useBarbershop();

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <FinancialTab barbershopId={barbershop.id} />
    </div>
  );
};

export default Relatorios;
