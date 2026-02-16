import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Scissors, Loader2, Check, Wallet, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
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
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
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

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [shop, setShop] = useState<BarbershopPublic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [existingAppts, setExistingAppts] = useState<ExistingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix_online" | "local">("local");
  const [hasPixConfig, setHasPixConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Pix payment state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    paymentUrl: string;
    pixCode: string;
  } | null>(null);
  const [pixError, setPixError] = useState(false);
  const [lastAppointmentId, setLastAppointmentId] = useState<string | null>(null);
  const [paymentConfirmedRef, setPaymentConfirmedRef] = useState(false);

  // Check if redirected from payment success
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setSuccess(true);
    }
  }, [searchParams]);

  // Load shop, services, and business hours
  useEffect(() => {
    if (!slug) return;
    supabase
      .from("barbershops")
      .select("id, name, slug, address, logo_url, settings")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        const shopData = data as (BarbershopPublic & { settings?: any }) | null;
        setShop(shopData);
        if (shopData) {
          // Check if barbershop has AbacatePay configured
          const hasKey = !!(shopData.settings as Record<string, any>)?.abacate_pay_api_key;
          setHasPixConfig(hasKey);
          if (!hasKey) {
            setPaymentMethod("local");
          }

          Promise.all([
            supabase.from("services").select("*").eq("barbershop_id", shopData.id).eq("active", true).order("sort_order"),
            supabase.from("business_hours").select("*").eq("barbershop_id", shopData.id),
          ]).then(([servRes, hoursRes]) => {
            const srvData = (servRes.data || []) as Service[];
            setServices(srvData);
            setBusinessHours((hoursRes.data || []) as BusinessHour[]);
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
        // Filter out pending Pix appointments older than 10 minutes (expired holds)
        const validAppts = (data || []).filter((appt: any) => {
          if (appt.status === "confirmed" || appt.status === "completed" || appt.payment_status === "paid" || appt.payment_status === "pending_local") {
            return true; // Always block for confirmed/completed/local
          }
          // Pending pix: only block if created less than 10 min ago
          if (appt.created_at) {
            const createdAt = new Date(appt.created_at);
            const diffMs = now.getTime() - createdAt.getTime();
            return diffMs < HOLD_MINUTES * 60 * 1000;
          }
          return true;
        });
        setExistingAppts(validAppts as ExistingAppointment[]);
        setSlotsLoading(false);
      });
  }, [shop, selectedDate]);

  const getHoursForDay = (dayOfWeek: number): BusinessHour | null => {
    return businessHours.find((h) => h.day_of_week === dayOfWeek) || null;
  };

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
    const phoneDigits = clientPhone.replace(/\D/g, "");
    if (!selectedService || !selectedDate || !selectedTime || !clientName.trim() || phoneDigits.length < 10) return;
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
        _payment_method: paymentMethod === "local" ? "local" : "pix_online",
      });

      if (error) throw error;

      // If local payment, go straight to success
      if (paymentMethod === "local") {
        setSuccess(true);
        return;
      }

      // Try to create Pix charge if barbershop has AbacatePay configured
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
        body: {
          appointment_id: appointmentId,
          barbershop_id: shop!.id,
        },
      });

      console.log("Pix charge response:", pixRes.data);

      if (pixRes.data?.success && (pixRes.data?.payment_url || pixRes.data?.pix_code)) {
        setPixData({
          paymentUrl: pixRes.data.payment_url || "",
          pixCode: pixRes.data.pix_code || "",
        });
        setPixModalOpen(true);
        return;
      }
      console.error("Pix charge failed:", pixRes.data);
      setPixError(true);
    } catch (pixErr) {
      console.error("Pix charge error:", pixErr);
      setPixError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryPix = () => {
    if (lastAppointmentId) {
      attemptPixCharge(lastAppointmentId);
    }
  };

  const handleFallbackToLocal = async () => {
    if (lastAppointmentId) {
      await supabase
        .from("appointments")
        .update({ payment_method: "local", payment_status: "pending_local" })
        .eq("id", lastAppointmentId);
      setPixError(false);
      setSuccess(true);
    }
  };

  const handlePixModalClose = () => {
    setPixModalOpen(false);
    // Only show success if payment was actually confirmed
    if (paymentConfirmedRef) {
      setSuccess(true);
    }
  };

  const handlePaymentConfirmed = () => {
    setPaymentConfirmedRef(true);
    // Auto-close modal and show success after a brief delay
    setTimeout(() => {
      setPixModalOpen(false);
      setSuccess(true);
    }, 2500);
  };

  const availableSlots = generateTimeSlots();

  return (
    <div className="min-h-screen">
      {/* Shop Header */}
      <div className="border-b border-border bg-card py-6">
        <div className="container max-w-2xl flex items-center gap-3">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.name} className="h-11 w-11 rounded-full object-cover border border-border" />
          ) : (
            <div className="h-11 w-11 rounded-full gold-gradient flex items-center justify-center">
              <Scissors className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-display text-lg font-bold">{shop.name}</h1>
            <p className="text-xs text-muted-foreground">Agendamento online</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="container max-w-2xl pt-6">
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "gold-gradient" : "bg-secondary"}`} />
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

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-xl font-bold mb-1">Data e Horário</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Escolha o melhor dia e horário
              {selectedService && <span className="text-primary"> • {selectedService.name} ({selectedService.duration}min)</span>}
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

        {/* Step 3: Client Info & Payment Method & Confirm */}
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
                {/* Pix disabled for MVP */}
                <div className="relative">
                  <button
                    disabled
                    className="w-full flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4 text-left opacity-50 cursor-not-allowed"
                  >
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
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Voltar</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !clientName.trim() || clientPhone.replace(/\D/g, "").length < 10}
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
