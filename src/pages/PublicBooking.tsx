import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Scissors, Loader2, CalendarDays, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Barbershop {
  id: string;
  name: string;
  slug: string;
  phone: string;
}

const defaultServices = [
  { name: "Corte Degradê", price: 50, duration: 40 },
  { name: "Corte Social", price: 45, duration: 35 },
  { name: "Barba Completa", price: 35, duration: 30 },
  { name: "Corte + Barba", price: 75, duration: 60 },
  { name: "Sobrancelha", price: 15, duration: 10 },
];

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
];

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [shop, setShop] = useState<Barbershop | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<typeof defaultServices[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("barbershops")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        setShop(data as Barbershop | null);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="container max-w-md py-20 text-center">
        <Scissors className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Barbearia não encontrada</h2>
        <p className="text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container max-w-md py-20 text-center animate-scale-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full gold-gradient shadow-gold">
          <Check className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Agendamento Confirmado!</h1>
        <p className="text-muted-foreground text-sm">
          Seu horário na <span className="text-primary font-semibold">{shop.name}</span> foi reservado com sucesso.
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !clientName.trim()) return;
    setSubmitting(true);
    try {
      const scheduledAt = new Date(selectedDate);
      const [h, m] = selectedTime.split(":").map(Number);
      scheduledAt.setHours(h, m, 0, 0);

      const { error } = await supabase.from("appointments").insert({
        barbershop_id: shop.id,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        service_name: selectedService.name,
        price: selectedService.price,
        scheduled_at: scheduledAt.toISOString(),
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Shop Header */}
      <div className="border-b border-border bg-card py-6">
        <div className="container max-w-2xl flex items-center gap-3">
          <div className="h-11 w-11 rounded-full gold-gradient flex items-center justify-center">
            <Scissors className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold">{shop.name}</h1>
            <p className="text-xs text-muted-foreground">Agendamento online</p>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl py-8">
        {/* Step 1: Service */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl font-bold mb-1">Escolha o Serviço</h2>
            <p className="text-sm text-muted-foreground mb-6">Selecione o serviço desejado</p>
            <div className="space-y-3">
              {defaultServices.map((s) => (
                <button
                  key={s.name}
                  onClick={() => { setSelectedService(s); setStep(2); }}
                  className={`w-full text-left rounded-lg border p-4 transition-all hover:border-primary/40 ${
                    selectedService?.name === s.name ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration}min</p>
                    </div>
                    <span className="font-display font-bold text-primary">R$ {s.price}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl font-bold mb-1">Data e Horário</h2>
            <p className="text-sm text-muted-foreground mb-6">Escolha o melhor dia e horário</p>
            <div className="flex justify-center mb-6">
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={(d) => d && setSelectedDate(d)}
                disabled={(d) => d < new Date() || d.getDay() === 0}
                locale={ptBR}
                className="rounded-lg border border-border bg-card p-3"
              />
            </div>
            {selectedDate && (
              <>
                <p className="text-sm font-medium mb-3">
                  Horários para{" "}
                  <span className="text-primary">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</span>
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-6">
                  {timeSlots.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`rounded-md border px-2 py-2 text-sm font-medium transition-all ${
                        selectedTime === t
                          ? "border-primary gold-gradient text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!selectedDate || !selectedTime}
                className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Client Info & Confirm */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl font-bold mb-1">Seus Dados</h2>
            <p className="text-sm text-muted-foreground mb-6">Preencha para confirmar o agendamento</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Seu nome" className="bg-card border-border" required maxLength={100} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">WhatsApp (opcional)</label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="(11) 99999-9999" className="bg-card border-border" maxLength={20} />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviço</span>
                <span className="font-medium">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">{selectedDate && format(selectedDate, "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium text-primary">{selectedTime}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display font-bold text-primary">R$ {selectedService?.price}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Voltar</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !clientName.trim()}
                className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agendando...</> : "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicBooking;
