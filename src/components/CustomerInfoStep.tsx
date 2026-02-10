import { User, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBooking } from "@/contexts/BookingContext";

const CustomerInfoStep = () => {
  const { customerName, customerPhone, setCustomerName, setCustomerPhone } = useBooking();

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-xl font-bold mb-1">Seus Dados</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Informe seu nome e telefone para que o barbeiro saiba quem irá atender
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Nome completo
          </label>
          <Input
            placeholder="Ex: João da Silva"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={100}
            className="bg-card border-border"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> WhatsApp / Telefone
          </label>
          <Input
            placeholder="(11) 99999-9999"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
            maxLength={15}
            className="bg-card border-border"
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerInfoStep;
