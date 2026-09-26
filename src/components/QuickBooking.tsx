import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import CustomerSearchSelect, { type SearchableCustomer } from "@/components/CustomerSearchSelect";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface QuickBookingProps {
  barbershopId: string;
  services: Service[];
  customers: SearchableCustomer[];
  onBooked: () => void;
}

const QuickBooking = ({ barbershopId, services, customers, onBooked }: QuickBookingProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<SearchableCustomer | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedService = services.find((s) => s.id === serviceId);

  const handleSubmit = async () => {
    if (!customer || !serviceId || !date || !time || !selectedService) return;
    setSaving(true);

    const scheduledAt = new Date(`${date}T${time}:00`);

    const { error } = await supabase.rpc("create_public_appointment", {
      _barbershop_id: barbershopId,
      _client_name: customer.name,
      _client_phone: customer.phone,
      _service_name: selectedService.name,
      _price: selectedService.price,
      _scheduled_at: scheduledAt.toISOString(),
      _payment_method: "local",
      _customer_id: customer.id,
      _items: [
        {
          name: selectedService.name,
          price: selectedService.price,
          duration: selectedService.duration,
          product_type: false,
        },
      ],
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento criado!" });
      setCustomer(null); setServiceId(""); setDate(""); setTime("");
      setOpen(false);
      onBooked();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="premium-gradient text-primary-foreground font-semibold hover:opacity-90">
          <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Agendamento Rápido
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Agendamento Rápido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <CustomerSearchSelect customers={customers} value={customer} onChange={setCustomer} />
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Selecione o serviço" />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} — R$ {s.price}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Horário</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={saving || !customer || !serviceId || !date || !time}
            className="w-full premium-gradient text-primary-foreground font-semibold hover:opacity-90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
            Criar Agendamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickBooking;
