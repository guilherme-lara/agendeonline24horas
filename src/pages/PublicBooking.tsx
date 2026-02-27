import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Scissors, Loader2, Check, Wallet, QrCode, AlertCircle, CalendarDays, AlertTriangle, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { format, addMinutes, isBefore, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import PixPaymentModal from "@/components/PixPaymentModal";

interface BarbershopPublic {
  id: string;
  name: string;
  slug: string;
  address: string;
  logo_url?: string;
  phone?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  requires_advance_payment?: boolean;
  advance_payment_value?: number;
}

interface BarberPublic {
  id: string;
  name: string;
  avatar_url?: string;
}

interface BusinessHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface ExistingAppointment {
  scheduled_at: string;
  service_name: string;
  status: string;
  payment_status: string | null;
  created_at: string | null;
}

const BUFFER_MINUTES = 10;
// Steps: 1=Service, 2=Barber, 3=Date/Time, 4=Client Info & Confirm
const TOTAL_STEPS = 4;

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [shop, setShop] = useState<BarbershopPublic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<BarberPublic[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [existingAppts, setExistingAppts] = useState<ExistingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<BarberPublic | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix_online" | "local">("local");
  const [hasPixConfig, setHasPixConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [signalPending, setSignalPending] = useState(false);
  const [signalWhatsAppUrl, setSignalWhatsAppUrl] = useState<string | null>(null);

  // Pix payment state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{ paymentUrl: string; pixCode: string } | null>(null);
  const [pixError, setPixError] = useState(false);
  const [lastAppointmentId, setLastAppointmentId] = useState<string | null>(null);
  const [paymentConfirmedRef, setPaymentConfirmedRef] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") setSuccess(true);
  }, [searchParams]);

  // Load shop, services, barbers, and business hours
  useEffect(() => {
    if (!slug) return;
    supabase
      .from("barbershops")
      .select("id, name, slug, address, logo_url, phone, settings")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        const shopData = data as (BarbershopPublic & { settings?: any }) | null;
        setShop(shopData);
        if (shopData) {
          const hasKey = !!(shopData.settings as Record<string, any>)?.abacate_pay_api_key;
          setHasPixConfig(hasKey);
          if (!hasKey) setPaymentMethod("local");

          Promise.all([
            supabase.from("services").select("*").eq("barbershop_id", shopData.id).eq("active", true).order("sort_order"),
            supabase.from("business_hours").select("*").eq("barbershop_id", shopData.id),
            supabase.from("barbers").select("id, name, avatar_url").eq("barbershop_id", shopData.id).eq("active", true),
          ]).then(([servRes, hoursRes, barbersRes]) => {
            const srvData = (servRes.data || []) as Service[];
            setServices(srvData);
            setBusinessHours((hoursRes.data || []) as BusinessHour[]);
            setBarbers((barbersRes.data || []) as BarberPublic[]);
            if (srvData.length === 0) {
              setServices([
                { id: "d1", name: "Corte Degradê", price: 50, duration: 40 },
                { id: "d2", name: "Corte Social", price: 45, duration: 35 },
                { id: "d3", name: "Barba Completa", price: 35, duration: 30 },
                { id: "d4", name: "Corte + Barba", price: 75, duration: 60 },
                { id: "d5", name: "Sobrancelha", price: 15, duration: 10 },
              ]);
            }
          });
        }
        setLoading(false);
      });
  }, [slug]);

  // Load existing appointments when date changes
  useEffect(() => {
    if (!shop || !selectedDate) return;
    setSlotsLoading(true);
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    supabase
      .from("appointments")
      .select("scheduled_at, service_name, status, payment_status, created_at")
      .eq("barbershop_id", shop.id)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd.toISOString())
      .neq("status", "cancelled")
      .then(({ data }) => {
        const now = new Date();
        const HOLD_MINUTES = 10;
        const validAppts = (data || []).filter((appt: any) => {
          if (appt.status === "confirmed" || appt.status === "completed" || appt.payment_status === "paid" || appt.payment_status === "pending_local") return true;
          if (appt.created_at) {
            const createdAt = new Date(appt.created_at);
            return now.getTime() - createdAt.getTime() < HOLD_MINUTES * 60 * 1000;
          }
          return true;
        });
        setExistingAppts(validAppts as ExistingAppointment[]);
        setSlotsLoading(false);
      });
  }, [shop, selectedDate]);

  const getHoursForDay = (dayOfWeek: number): BusinessHour | null =>
    businessHours.find((h) => h.day_of_week === dayOfWeek) || null;

  const isDayClosed = (date: Date): boolean => {
    const bh = getHoursForDay(date.getDay());
    if (bh) return bh.is_closed;
    return date.getDay() === 0;
  };

  const generateTimeSlots = (): string[] => {
    if (!selectedDate || !selectedService) return [];
    const bh = getHoursForDay(selectedDate.getDay());
    const openTime = bh ? bh.open_time : "09:00";
    const closeTime = bh ? bh.close_time : "19:00";
    const [openH, openM] = openTime.split(":").map(Number);
    const [closeH, closeM] = closeTime.split(":").map(Number);
    const slots: string[] = [];
    const now = new Date();

    for (let h = openH; h <= closeH; h++) {
      for (let m = h === openH ? openM : 0; m < 60; m += 30) {
        if (h === closeH && m >= closeM) break;
        const slotTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (isToday(selectedDate)) {
          const slotDate = new Date(selectedDate);
          slotDate.setHours(h, m, 0, 0);
          if (isBefore(slotDate, now)) continue;
        }
        const slotStart = new Date(selectedDate);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = addMinutes(slotStart, selectedService.duration + BUFFER_MINUTES);
        const closeDate = new Date(selectedDate);
        closeDate.setHours(closeH, closeM, 0, 0);
        if (isBefore(closeDate, addMinutes(slotStart, selectedService.duration))) continue;

        const hasConflict = existingAppts.some((appt) => {
          const apptStart = new Date(appt.scheduled_at);
          const apptService = services.find((s) => s.name === appt.service_name);
          const apptDuration = apptService?.duration || 30;
          const apptEnd = addMinutes(apptStart, apptDuration + BUFFER_MINUTES);
          return slotStart < apptEnd && slotEnd > apptStart;
        });
        if (!hasConflict) slots.push(slotTime);
      }
    }
    return slots;
  };

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

  // Signal pending screen - shown INSTEAD of success when advance payment required
  if (signalPending) {
    return (
      <div className="container max-w-md py-20 text-center animate-scale-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
          <AlertTriangle className="h-8 w-8 text-yellow-400" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Aguardando Pagamento do Sinal</h1>
        <p className="text-muted-foreground text-sm mb-2">
          Seu agendamento na <span className="text-primary font-semibold">{shop.name}</span> foi registrado, mas só será confirmado após o pagamento do sinal.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Envie o comprovante de pagamento pelo WhatsApp para que o dono da barbearia confirme seu horário.
        </p>
        {signalWhatsAppUrl && (
          <a
            href={signalWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar Comprovante via WhatsApp
          </a>
        )}
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
    if (!selectedBarber) {
      toast({ title: "Erro", description: "Por favor, selecione um profissional para continuar.", variant: "destructive" });
      return;
    }

    const phoneDigits = clientPhone.replace(/\D/g, "");
    if (!selectedService || !selectedDate || !selectedTime || !clientName.trim() || phoneDigits.length < 10) return;

    // CRITICAL: Check if service requires advance payment
    const requiresSignal = selectedService.requires_advance_payment && (selectedService.advance_payment_value || 0) > 0;

    setSubmitting(true);
    try {
      const scheduledAt = new Date(selectedDate);
      const [h, m] = selectedTime.split(":").map(Number);
      scheduledAt.setHours(h, m, 0, 0);

      const { data: appointmentId, error } = await supabase.rpc("create_public_appointment", {
        _barbershop_id: shop.id,
        _client_name: clientName.trim(),
        _client_phone: clientPhone.trim(),
        _service_name: selectedService.name,
        _price: selectedService.price,
        _scheduled_at: scheduledAt.toISOString(),
        _payment_method: requiresSignal ? "local" : (paymentMethod === "local" ? "local" : "pix_online"),
      });

      if (error) throw error;

      // Update barber_name
      if (appointmentId) {
        await supabase
          .from("appointments")
          .update({ barber_name: selectedBarber.name })
          .eq("id", appointmentId);
      }

      // ENFORCE: If service requires signal, set status to pendente_sinal
      if (requiresSignal && appointmentId) {
        await supabase.from("appointments").update({ status: "pendente_sinal" }).eq("id", appointmentId);

        // Redirect to WhatsApp with payment info
        const cleanPhone = (shop.phone || "").replace(/\D/g, "");
        const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const msg = encodeURIComponent(
          `Olá, acabei de solicitar o agendamento de *${selectedService.name}* para ${format(scheduledAt, "dd/MM 'às' HH:mm")}. Segue o comprovante do PIX de R$ ${Number(selectedService.advance_payment_value).toFixed(2).replace(".", ",")} referente ao sinal para confirmar meu horário!`
        );
        
        // Show dedicated signal pending screen instead of generic success
        setSignalPending(true);
        setSignalWhatsAppUrl(cleanPhone.length >= 10 ? `https://wa.me/${fullPhone}?text=${msg}` : null);
        return;
      }

      if (paymentMethod === "local") {
        setSuccess(true);
        return;
      }

      if (appointmentId && hasPixConfig) {
        setLastAppointmentId(appointmentId);
        await attemptPixCharge(appointmentId);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const attemptPixCharge = async (appointmentId: string) => {
    setPixError(false);
    setSubmitting(true);
    try {
      const pixRes = await supabase.functions.invoke("create-pix-charge", {
        body: { appointment_id: appointmentId, barbershop_id: shop!.id },
      });
      if (pixRes.data?.success && (pixRes.data?.payment_url || pixRes.data?.pix_code)) {
        setPixData({ paymentUrl: pixRes.data.payment_url || "", pixCode: pixRes.data.pix_code || "" });
        setPixModalOpen(true);
        return;
      }
      setPixError(true);
    } catch {
      setPixError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryPix = () => {
    if (lastAppointmentId) attemptPixCharge(lastAppointmentId);
  };

  const handleFallbackToLocal = async () => {
    if (lastAppointmentId) {
      await supabase.from("appointments").update({ payment_method: "local", payment_status: "pending_local" }).eq("id", lastAppointmentId);
      setPixError(false);
      setSuccess(true);
    }
  };

  const handlePixModalClose = () => {
    setPixModalOpen(false);
    if (paymentConfirmedRef) setSuccess(true);
  };

  const handlePaymentConfirmed = () => {
    setPaymentConfirmedRef(true);
    setTimeout(() => { setPixModalOpen(false); setSuccess(true); }, 2500);
  };

  // Step navigation with barber validation
  const handleNextFromBarber = () => {
    if (!selectedBarber) {
      toast({ title: "Seleção obrigatória", description: "Por favor, selecione um profissional para continuar.", variant: "destructive" });
      return;
    }
    setStep(3);
  };

  const availableSlots = generateTimeSlots();

  return (
    <div className="min-h-screen">
      {/* Shop Header */}
      <div className="border-b border-border bg-card py-6">
        <div className="container max-w-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} className="h-11 w-11 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-11 w-11 rounded-full gold-gradient flex items-center justify-center">
                <Scissors className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="font-display text-lg font-bold">{shop.name}</h1>
              {shop.address && <p className="text-xs text-muted-foreground">{shop.address}</p>}
              {shop.phone && <p className="text-xs text-muted-foreground">{shop.phone}</p>}
            </div>
          </div>
          {/* My Appointments Button */}
          <a
            href="/meus-agendamentos"
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors border border-border rounded-lg px-3 py-2 bg-card hover:border-primary/50"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Meus Agendamentos</span>
            <span className="sm:hidden">Agenda</span>
          </a>
        </div>
      </div>

      {/* Step indicator */}
      <div className="container max-w-2xl pt-6">
        <div className="flex gap-2 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i + 1 <= step ? "gold-gradient" : "bg-secondary"}`} />
          ))}
        </div>
      </div>

      <div className="container max-w-2xl pb-8">
        {/* Step 1: Service */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl font-bold mb-1">Escolha o Serviço</h2>
            <p className="text-sm text-muted-foreground mb-6">Selecione o serviço desejado</p>
            <div className="space-y-3">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedService(s); setSelectedTime(null); setStep(2); }}
                  className={`w-full text-left rounded-lg border p-4 transition-all hover:border-primary/40 ${
                    selectedService?.id === s.id ? "border-primary bg-primary/5" : "border-border bg-card"
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

        {/* Step 2: Barber Selection (MANDATORY) */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl font-bold mb-1">Escolha o Profissional</h2>
            <p className="text-sm text-muted-foreground mb-2">Selecione quem vai te atender</p>
            {!selectedBarber && (
              <div className="flex items-center gap-1.5 mb-4">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <p className="text-xs text-destructive font-medium">Escolha obrigatória</p>
              </div>
            )}

            {barbers.length === 0 ? (
              <div className="text-center py-10">
                <Scissors className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum profissional disponível no momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {barbers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBarber(b)}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-all hover:border-primary/40 ${
                      selectedBarber?.id === b.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border bg-card"
                    }`}
                  >
                    <Avatar className="h-14 w-14">
                      {b.avatar_url ? (
                        <AvatarImage src={b.avatar_url} alt={b.name} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="bg-secondary text-sm font-bold">
                        {b.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium text-sm text-center">{b.name}</p>
                    {selectedBarber?.id === b.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
              <Button
                onClick={handleNextFromBarber}
                disabled={!selectedBarber}
                className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl font-bold mb-1">Data e Horário</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Escolha o melhor dia e horário
              {selectedService && <span className="text-primary"> • {selectedService.name} ({selectedService.duration}min)</span>}
              {selectedBarber && <span className="text-muted-foreground"> • com {selectedBarber.name}</span>}
            </p>
            <div className="flex justify-center mb-6">
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={(d) => { if (d) { setSelectedDate(d); setSelectedTime(null); } }}
                disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || isDayClosed(d)}
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
                {slotsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum horário disponível nesta data.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-6">
                    {availableSlots.map((t) => (
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
                )}
              </>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Voltar</Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!selectedDate || !selectedTime}
                className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Client Info & Payment Method & Confirm */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl font-bold mb-1">Seus Dados</h2>
            <p className="text-sm text-muted-foreground mb-4">Preencha para confirmar o agendamento</p>

            {/* Advance Payment Alert */}
            {selectedService?.requires_advance_payment && (selectedService.advance_payment_value || 0) > 0 && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-400">Adiantamento Obrigatório</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este serviço requer um adiantamento de <strong className="text-foreground">R$ {Number(selectedService.advance_payment_value).toFixed(2).replace(".", ",")}</strong> para confirmação da agenda.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Seu nome" className="bg-card border-border" required maxLength={100} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Celular / WhatsApp <span className="text-destructive">*</span></label>
                <Input
                  value={clientPhone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let formatted = digits;
                    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                    setClientPhone(formatted);
                  }}
                  placeholder="(11) 99999-9999"
                  className="bg-card border-border"
                  maxLength={15}
                />
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="mb-6">
              <label className="text-xs text-muted-foreground mb-2 block">Forma de Pagamento</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <button disabled className="w-full flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4 text-left opacity-50 cursor-not-allowed">
                    <QrCode className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-sm">Pix Online</p>
                      <p className="text-xs text-muted-foreground">Pagamento instantâneo</p>
                    </div>
                  </button>
                  <Badge className="absolute -top-2 -right-2 text-[10px] bg-primary/20 text-primary border-primary/30">Em Breve</Badge>
                </div>
                <button
                  onClick={() => setPaymentMethod("local")}
                  className="flex items-center gap-3 rounded-lg border p-4 transition-all text-left border-primary bg-primary/5"
                >
                  <Wallet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-sm">Pagar na Barbearia</p>
                    <p className="text-xs text-muted-foreground">Pix, dinheiro ou cartão no local</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviço</span>
                <span className="font-medium">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profissional</span>
                <span className="font-medium">{selectedBarber?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duração</span>
                <span className="font-medium">{selectedService?.duration}min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">{selectedDate && format(selectedDate, "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium text-primary">{selectedTime}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagamento</span>
                <span className="font-medium">{paymentMethod === "pix_online" ? "Pix Online" : "Na Barbearia"}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display font-bold text-primary">R$ {selectedService?.price}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Voltar</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !clientName.trim() || clientPhone.replace(/\D/g, "").length < 10 || !selectedBarber}
                className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agendando...</> : "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pix Error - Retry / Fallback */}
      {pixError && (
        <div className="container max-w-md py-12 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <QrCode className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">Erro ao gerar o Pix</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Não foi possível gerar o QR Code de pagamento. Você pode tentar novamente ou optar por pagar na barbearia.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={handleRetryPix} disabled={submitting} className="gold-gradient text-primary-foreground font-semibold hover:opacity-90">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tentando...</> : "Tentar Novamente"}
            </Button>
            <Button variant="outline" onClick={handleFallbackToLocal}>
              <Wallet className="mr-2 h-4 w-4" /> Pagar na Barbearia
            </Button>
          </div>
        </div>
      )}

      {/* Pix Payment Modal */}
      {pixData && (
        <PixPaymentModal
          open={pixModalOpen}
          onClose={handlePixModalClose}
          paymentUrl={pixData.paymentUrl}
          pixCode={pixData.pixCode}
          price={selectedService?.price || 0}
          serviceName={selectedService?.name || ""}
          appointmentId={lastAppointmentId || undefined}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}
    </div>
  );
};

export default PublicBooking;
