import { useState } from "react";
import { CalendarPlus, Loader2, Plus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<SearchableCustomer | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  // Estados para o modal de novo cliente
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  const selectedService = services.find((s) => s.id === serviceId);

  const formatPhoneInput = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleCreateCustomer = async () => {
    const cleanPhone = newPhone.replace(/\D/g, "");
    if (!newName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do cliente.",
        variant: "destructive",
      });
      return;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      toast({
        title: "Telefone obrigatório",
        description: "O telefone é obrigatório e deve conter DDD (mínimo 10 dígitos).",
        variant: "destructive",
      });
      return;
    }

    setIsAddingCustomer(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          barbershop_id: barbershopId,
          name: newName.trim(),
          phone: cleanPhone,
          birth_date: newBirth || null,
        })
        .select("id, name, phone")
        .single();

      if (error) throw error;

      toast({ title: "Cliente cadastrado com sucesso!" });

      // Atualiza caches da agenda e listas de clientes
      queryClient.invalidateQueries({ queryKey: ["customers-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });

      // Seleciona automaticamente o novo cliente no agendamento rápido
      if (data) {
        setCustomer({
          id: data.id,
          name: data.name,
          phone: data.phone,
        });
      }

      setNewName("");
      setNewPhone("");
      setNewBirth("");
      setIsAddCustomerOpen(false);
    } catch (err: any) {
      toast({
        title: "Erro ao cadastrar cliente",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAddingCustomer(false);
    }
  };

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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="premium-gradient text-primary-foreground font-semibold hover:opacity-90">
            <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Agendamento Rápido
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-card border-border text-foreground max-w-md shadow-elev-3 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Agendamento Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-medium">Cliente *</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddCustomerOpen(true)}
                  className="h-6 px-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                >
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <CustomerSearchSelect customers={customers} value={customer} onChange={setCustomer} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddCustomerOpen(true)}
                  className="h-10 px-3 shrink-0 border-sys-border bg-sys-bg-base font-bold text-xs text-sys-text-primary hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                  title="Cadastrar novo cliente"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" /> Cliente
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Serviço *</label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="bg-secondary border-border h-10">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium block">Data *</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium block">Horário *</label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-secondary border-border h-10" />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={saving || !customer || !serviceId || !date || !time}
              className="w-full premium-gradient text-primary-foreground font-semibold hover:opacity-90 h-11 mt-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
              Criar Agendamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para adicionar novo cliente no agendamento rápido */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md shadow-elev-3 rounded-2xl p-6 z-[70]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Novo Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                Nome Completo <span className="text-sys-status-danger">*</span>
              </Label>
              <Input
                placeholder="Ex: João Silva"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isAddingCustomer}
                className="h-11 border-sys-border bg-sys-bg-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                Telefone / WhatsApp <span className="text-sys-status-danger">*</span> (Obrigatório)
              </Label>
              <Input
                placeholder="Ex: (11) 99999-9999"
                value={newPhone}
                onChange={(e) => setNewPhone(formatPhoneInput(e.target.value))}
                disabled={isAddingCustomer}
                className="h-11 border-sys-border bg-sys-bg-base"
              />
              <p className="text-[11px] text-muted-foreground">Informe DDD + número (obrigatório para confirmações).</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                Data de Nascimento (Opcional)
              </Label>
              <Input
                type="date"
                value={newBirth}
                onChange={(e) => setNewBirth(e.target.value)}
                disabled={isAddingCustomer}
                className="h-11 border-sys-border bg-sys-bg-base"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAddCustomerOpen(false)}
              disabled={isAddingCustomer}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateCustomer}
              disabled={isAddingCustomer || !newName.trim() || newPhone.replace(/\D/g, "").length < 10}
              className="bg-primary text-primary-foreground font-bold"
            >
              {isAddingCustomer && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickBooking;
