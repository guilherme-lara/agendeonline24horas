import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import CustomerSearchSelect, { type SearchableCustomer } from "@/components/CustomerSearchSelect";
import { findActiveAppointmentForCustomer } from "@/lib/findActiveAppointment";

type ServiceOption = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type AppointmentOption = {
  id: string;
  customer_id?: string | null;
  client_name: string;
  client_phone?: string | null;
  service_name: string;
  scheduled_at: string;
  status?: string | null;
};

interface SlotClientBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbershopId: string;
  slot: Date | null;
  customers: SearchableCustomer[];
  services: ServiceOption[];
  appointments: AppointmentOption[];
  onDone: () => void;
}

const SlotClientBookingDialog = ({
  open,
  onOpenChange,
  barbershopId,
  slot,
  customers,
  services,
  appointments,
  onDone,
}: SlotClientBookingDialogProps) => {
  const { toast } = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState<SearchableCustomer | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [forceNew, setForceNew] = useState(false);

  useEffect(() => {
    if (!open || !slot) return;
    setSelectedCustomer(null);
    setServiceId("");
    setForceNew(false);
    setDate(format(slot, "yyyy-MM-dd"));
    setTime(format(slot, "HH:mm"));
  }, [open, slot]);

  const selectedService = services.find((service) => service.id === serviceId);
  const scheduledAt = date && time ? new Date(`${date}T${time}:00`) : null;

  const activeAppointment = useMemo(() => {
    if (!selectedCustomer) return null;
    return findActiveAppointmentForCustomer(appointments, selectedCustomer);
  }, [appointments, selectedCustomer]);

  const handleReschedule = async () => {
    if (!selectedCustomer || !scheduledAt || !activeAppointment) return;
    setSaving(true);

    const { error } = await supabase
      .from("appointments")
      .update({
        scheduled_at: scheduledAt.toISOString(),
        customer_id: selectedCustomer.id,
        client_name: selectedCustomer.name,
        client_phone: selectedCustomer.phone,
      })
      .eq("id", activeAppointment.id);

    if (error) {
      toast({ title: "Não foi possível reagendar", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Cliente reagendado",
        description: `${selectedCustomer.name} foi movido para ${format(scheduledAt, "dd/MM 'às' HH:mm")}.`,
      });
      onOpenChange(false);
      onDone();
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!selectedCustomer || !scheduledAt || !selectedService) return;
    setSaving(true);

    const { error } = await supabase.rpc("create_public_appointment", {
      _barbershop_id: barbershopId,
      _client_name: selectedCustomer.name,
      _client_phone: selectedCustomer.phone,
      _service_name: selectedService.name,
      _price: selectedService.price,
      _scheduled_at: scheduledAt.toISOString(),
      _payment_method: "local",
      _customer_id: selectedCustomer.id,
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
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento criado", description: `${selectedCustomer.name} no horário selecionado.` });
      onOpenChange(false);
      onDone();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-sys-border bg-sys-surface text-sys-text-primary shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <CalendarClock className="h-5 w-5 text-sys-brand-primary" />
            Cliente neste horário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-sys-text-muted">
            Busque um cliente já cadastrado para agendar ou reagendar neste horário. Novos clientes devem ser cadastrados em Clientes.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-sys-text-muted">Data</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-sys-border bg-sys-bg-base" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-sys-text-muted">Horário</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="border-sys-border bg-sys-bg-base" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-sys-text-muted">Cliente cadastrado</label>
            <CustomerSearchSelect customers={customers} value={selectedCustomer} onChange={setSelectedCustomer} />
          </div>

          {activeAppointment && !forceNew && scheduledAt && (
            <div className="rounded-xl border border-sys-border bg-sys-bg-base px-3 py-2.5 text-sm">
              <p className="font-semibold text-sys-text-primary">Agendamento ativo encontrado</p>
              <p className="mt-1 text-sys-text-muted">
                {activeAppointment.service_name} em{" "}
                {format(new Date(activeAppointment.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="mt-1 text-xs text-sys-text-muted">
                Ao reagendar, esse horário antigo é liberado e o cliente vai para {format(scheduledAt, "dd/MM 'às' HH:mm")}.
              </p>
              <button
                type="button"
                onClick={() => setForceNew(true)}
                className="mt-2 text-xs font-semibold text-sys-brand-primary hover:underline"
              >
                Em vez disso, criar um novo agendamento
              </button>
            </div>
          )}

          {(!activeAppointment || forceNew) && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-sys-text-muted">Serviço</label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="h-10 border-sys-border bg-sys-bg-base">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} — R$ {Number(service.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {activeAppointment && !forceNew ? (
              <Button
                onClick={handleReschedule}
                disabled={saving || !selectedCustomer || !scheduledAt}
                className="w-full premium-gradient font-semibold text-primary-foreground hover:opacity-90"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reagendar para este horário
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={saving || !selectedCustomer || !scheduledAt || !selectedService}
                className="w-full premium-gradient font-semibold text-primary-foreground hover:opacity-90"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Agendar neste horário
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SlotClientBookingDialog;
