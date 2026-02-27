import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Scissors, Loader2, Check, Wallet, QrCode, AlertCircle, CalendarDays, AlertTriangle, MessageCircle, RefreshCw } from "lucide-react";
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
const TOTAL_STEPS = 4;

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // States
  const [shop, setShop] = useState<BarbershopPublic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<BarberPublic[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [existingAppts, setExistingAppts] = useState<ExistingAppointment[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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

  // Pix state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{ paymentUrl: string; pixCode: string } | null>(null);
  const [pixError, setPixError] = useState(false);
  const [lastAppointmentId, setLastAppointmentId] = useState<string | null>(null);
  const [paymentConfirmedRef, setPaymentConfirmedRef] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") setSuccess(true);
  }, [searchParams]);

  // <-- CARREGAMENTO INICIAL BLINDADO -->
  const loadInitialData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(false);

    try {
      const { data: shopData, error: shopErr } = await supabase
        .from("barbershops")
        .select("id, name, slug, address, logo_url, phone, settings")
        .eq("slug", slug)
        .maybeSingle();

      if (shopErr) throw shopErr;
      if (!shopData) { setError(true); return; }

      const typedShop = shopData as (BarbershopPublic & { settings?: any });
      setShop(typedShop);

      const hasKey = !!(typedShop.settings as Record<string, any>)?.abacate_pay_api_key;
      setHasPixConfig(hasKey);
      if (!hasKey) setPaymentMethod("local");

      const [servRes, hoursRes, barbersRes] = await Promise.all([
        supabase.from("services").select("*").eq("barbershop_id", typedShop.id).eq("active", true).order("sort_order"),
        supabase.from("business_hours").select("*").eq("barbershop_id", typedShop.id),
        supabase.from("barbers").select("id, name, avatar_url").eq("barbershop_id", typedShop.id).eq("active", true),
      ]);

      setServices((servRes.data || []) as Service[]);
      setBusinessHours((hoursRes.data || []) as BusinessHour[]);
      setBarbers((barbersRes.data || []) as BarberPublic[]);

    } catch (err) {
      console.error("Erro ao carregar barbearia:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // <-- CARREGAMENTO DE SLOTS BLINDADO -->
  useEffect(() => {
    if (!shop || !selectedDate) return;
    
    const fetchExistingAppointments = async () => {
      setSlotsLoading(true);
      try {
        const dayStart = startOfDay(selectedDate).toISOString();
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);

        const { data, error: fetchErr } = await supabase
          .from("appointments")
          .select("scheduled_at, service_name, status, payment_status, created_at")
          .eq("barbershop_id", shop.id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd.toISOString())
          .neq("status", "cancelled");

        if (fetchErr) throw fetchErr;

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
      } catch (err) {
        console.error("Falha ao buscar slots:", err);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchExistingAppointments();
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

  const handleSubmit = async () => {
    if (submitting) return;
    if (!selectedBarber || !selectedService || !selectedDate || !selectedTime || !clientName.trim()) {
      toast({ title: "Atenção", description: "Preencha todos os campos para continuar.", variant: "destructive" });
      return;
    }

    const phoneDigits = clientPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      toast({ title: "Celular inválido", description: "Informe um número de telefone válido.", variant: "destructive" });
      return;
    }

    const requiresSignal = selectedService.requires_advance_payment && (selectedService.advance_payment_value || 0) > 0;
    setSubmitting(true);

    try {
      const scheduledAt = new Date(selectedDate);
      const [h, m] = selectedTime.split(":").map(Number);
      scheduledAt.setHours(h, m, 0, 0);

      const { data: appointmentId, error: rpcError } = await supabase.rpc("create_public_appointment", {
        _barbershop_id: shop!.id,
        _client_name: clientName.trim(),
        _client_phone: clientPhone.trim(),
        _service_name: selectedService.name,
        _price: selectedService.price,
        _scheduled_at: scheduledAt.toISOString(),
        _payment_method: requiresSignal ? "local" : (paymentMethod === "local" ? "local" : "pix_online"),
      });

      if (rpcError) throw rpcError;

      if (appointmentId) {
        setLastAppointmentId(appointmentId);
        await supabase.from("appointments").update({ barber_name: selectedBarber.name }).eq("id", appointmentId);
      }

      if (requiresSignal && appointmentId) {
        await supabase.from("appointments").update({ status: "pendente_sinal" }).eq("id", appointmentId);
        const cleanPhone = (shop!.phone || "").replace(/\D/g, "");
        const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const msg = encodeURIComponent(`Olá, solicitei o agendamento de *${selectedService.name}* para ${format(scheduledAt, "dd/MM 'às' HH:mm")}. Segue o comprovante do sinal de R$ ${Number(selectedService.advance_payment_value).toFixed(2).replace(".", ",")}!`);
        
        setSignalPending(true);
        setSignalWhatsAppUrl(cleanPhone.length >= 10 ? `https://wa.me/${fullPhone}?text=${msg}` : null);
        return;
      }

      if (paymentMethod === "local") {
        setSuccess(true);
        return;
      }

      if (appointmentId && hasPixConfig) {
        await attemptPixCharge(appointmentId);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Erro no agendamento", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const attemptPixCharge = async (appointmentId: string) => {
    setPixError(false);
    try {
      const pixRes = await supabase.functions.invoke("create-pix-charge", {
        body: { appointment_id: appointmentId, barbershop_id: shop!.id },
      });
      if (pixRes.data?.success && (pixRes.data?.payment_url || pixRes.data?.pix_code)) {
        setPixData({ paymentUrl: pixRes.data.payment_url || "", pixCode: pixRes.data.pix_code || "" });
        setPixModalOpen(true);
      } else {
        setPixError(true);
      }
    } catch {
      setPixError(true);
    }
  };

  // Render Logics
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (error || !shop) return (
    <div className="container max-w-md py-20 text-center animate-fade-in">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
      <h2 className="font-display text-xl font-bold mb-2">Barbearia indisponível</h2>
      <p className="text-sm text-muted-foreground mb-6">Não conseguimos carregar os dados desta página.</p>
      <Button onClick={loadInitialData} className="gold-gradient text-primary-foreground px-8 font-semibold">
        Tentar Novamente
      </Button>
    </div>
  );

  if (signalPending) return (
    <div className="container max-w-md py-20 text-center animate-scale-in">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20"><AlertTriangle className="h-8 w-8 text-yellow-400" /></div>
      <h1 className="font-display text-2xl font-bold mb-2">Aguardando Sinal</h1>
      <p className="text-muted-foreground text-sm mb-6">Seu agendamento foi registrado! Ele será confirmado após o envio do comprovante.</p>
      {signalWhatsAppUrl && (
        <a href={signalWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors">
          <MessageCircle className="h-4 w-4" /> Enviar via WhatsApp
        </a>
      )}
    </div>
  );

  if (success) return (
    <div className="container max-w-md py-20 text-center animate-scale-in">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full gold-gradient shadow-gold"><Check className="h-8 w-8 text-primary-foreground" /></div>
      <h1 className="font-display text-2xl font-bold mb-2">Confirmado!</h1>
      <p className="text-muted-foreground text-sm">Seu horário na <span className="text-primary font-semibold">{shop.name}</span> foi reservado com sucesso.</p>
      <Button onClick={() => window.location.href = "/meus-agendamentos"} variant="outline" className="mt-8">Ver meus horários</Button>
    </div>
  );

  const availableSlots = generateTimeSlots();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card py-6">
        <div className="container max-w-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} className="h-11 w-11 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-11 w-11 rounded-full gold-gradient flex items-center justify-center"><Scissors className="h-5 w-5 text-primary-foreground" /></div>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold truncate">{shop.name}</h1>
              <p className="text-[10px] text-muted-foreground truncate opacity-80">{shop.address || "Localização não informada"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = "/meus-agendamentos"} className="text-xs text-muted-foreground">
            Minha Agenda
          </Button>
        </div>
      </div>

      <div className="container max-w-2xl py-6 pb-24">
        <div className="flex gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i + 1 <= step ? "gold-gradient" : "bg-secondary"}`} />
          ))}
        </div>

        {/* Step 1: Services */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-display text-xl font-bold mb-1">Escolha o Serviço</h2>
            <p className="text-sm text-muted-foreground mb-6">O que vamos fazer hoje?</p>
            <div className="grid gap-3">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedService(s); setStep(2); }}
                  className={`group w-full text-left rounded-xl border p-4 transition-all hover:border-primary/40 bg-card hover:shadow-md ${selectedService?.id === s.id ? "border-primary ring-1 ring-primary" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm group-hover:text-primary transition-colors">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration} min</p>
                    </div>
                    <span className="font-display font-bold text-primary">R$ {s.price}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Barbeiro */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-display text-xl font-bold mb-1">Quem vai atender?</h2>
            <p className="text-sm text-muted-foreground mb-6">Selecione o profissional de sua preferência</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBarber(b)}
                  className={`flex flex-col items-center gap-3 rounded-xl border p-5 transition-all bg-card ${selectedBarber?.id === b.id ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <Avatar className="h-16 w-16 border-2 border-border">
                    <AvatarImage src={b.avatar_url} className="object-cover" />
                    <AvatarFallback className="font-bold">{b.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-xs text-center">{b.name}</p>
                  {selectedBarber?.id === b.id && <Check className="h-4 w-4 text-primary animate-in zoom-in" />}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-8">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={!selectedBarber} className="flex-1 gold-gradient text-primary-foreground font-bold">Continuar</Button>
            </div>
          </div>
        )}

        {/* Step 3: Data e Hora */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-display text-xl font-bold mb-1">Data e Horário</h2>
            <p className="text-sm text-muted-foreground mb-6">Qual o melhor momento para você?</p>
            <div className="flex justify-center mb-6 bg-card rounded-xl border border-border p-2">
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={(d) => d && setSelectedDate(d)}
                disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || isDayClosed(d)}
                locale={ptBR}
              />
            </div>
            {selectedDate && (
              <div className="animate-in fade-in duration-500">
                <p className="text-sm font-bold mb-4 flex items-center gap-2"><RefreshCw className={`h-3.5 w-3.5 ${slotsLoading ? "animate-spin text-primary" : ""}`} /> Horários para {format(selectedDate, "dd/MM")}</p>
                {slotsLoading ? (
                  <div className="grid grid-cols-4 gap-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-lg">Sem horários livres nesta data.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((t) => (
                      <button key={t} onClick={() => setSelectedTime(t)} className={`py-2 text-xs font-bold rounded-lg border transition-all ${selectedTime === t ? "gold-gradient text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"}`}>{t}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 mt-10">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Voltar</Button>
              <Button onClick={() => setStep(4)} disabled={!selectedDate || !selectedTime || slotsLoading} className="flex-1 gold-gradient text-primary-foreground font-bold">Continuar</Button>
            </div>
          </div>
        )}

        {/* Step 4: Finalização */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-display text-xl font-bold mb-6">Confirme seus dados</h2>
            <div className="space-y-4 mb-8">
              <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Seu Nome</label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome completo" className="h-12 bg-card" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">WhatsApp</label><Input value={clientPhone} onChange={(e) => setClientPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="h-12 bg-card" /></div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-8 space-y-3">
              <div className="flex justify-between text-sm"><span>Serviço:</span><span className="font-bold">{selectedService?.name}</span></div>
              <div className="flex justify-between text-sm"><span>Profissional:</span><span className="font-bold">{selectedBarber?.name}</span></div>
              <div className="flex justify-between text-sm"><span>Data e Hora:</span><span className="font-bold text-primary">{selectedDate && format(selectedDate, "dd/MM")} às {selectedTime}</span></div>
              <div className="border-t border-primary/10 pt-2 flex justify-between items-center"><span className="text-sm font-bold">Total a pagar:</span><span className="text-xl font-display font-bold text-primary">R$ {selectedService?.price}</span></div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-12">Voltar</Button>
              <Button onClick={handleSubmit} disabled={submitting || !clientName.trim()} className="flex-[2] gold-gradient text-primary-foreground font-bold h-12 shadow-lg shadow-primary/20">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agendando...</> : "Confirmar Agendamento"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* PIX Errors & Modals */}
      {pixError && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-sm text-center shadow-2xl">
            <QrCode className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Erro no Pix Online</h3>
            <p className="text-sm text-muted-foreground mb-6">Não conseguimos gerar o pagamento. Deseja tentar novamente ou pagar no local?</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => attemptPixCharge(lastAppointmentId!)} className="gold-gradient">Tentar Novamente</Button>
              <Button onClick={() => setSuccess(true)} variant="outline">Pagar na Barbearia</Button>
            </div>
          </div>
        </div>
      )}

      {pixData && <PixPaymentModal open={pixModalOpen} onClose={handlePixModalClose} paymentUrl={pixData.paymentUrl} pixCode={pixData.pixCode} price={selectedService?.price || 0} serviceName={selectedService?.name || ""} appointmentId={lastAppointmentId || undefined} onPaymentConfirmed={handlePaymentConfirmed} />}
    </div>
  );
};

export default PublicBooking;
