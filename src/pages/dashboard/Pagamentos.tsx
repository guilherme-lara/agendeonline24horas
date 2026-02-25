import PaymentSettingsTab from "@/components/PaymentSettingsTab";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2 } from "lucide-react";

const Pagamentos = () => {
  const { barbershop, loading } = useBarbershop();

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <PaymentSettingsTab barbershopId={barbershop.id} />
    </div>
  );
};

export default Pagamentos;
