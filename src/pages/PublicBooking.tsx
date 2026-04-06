import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { 
  Scissors, Loader2, Check, AlertTriangle, CalendarDays,
  MapPin, ArrowLeft, XCircle, QrCode, Banknote, ShieldCheck, CreditCard, WifiOff, UserX
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { format, addMinutes, isBefore, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const BUFFER_MINUTES = 10;

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientData, setClientData] = useState({ name: "", phone: "" });

  const [success, setSuccess] = useState(searchParams.get("success") === "true");
  const [cancelled, setCancelled] = useState(false);

  // Polling: check appointment status when back from checkout
  const [apptStatus, setApptStatus] = useState<string | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);

  useEffect(() => {
    if (!success || statusChecked) return;
    setStatusChecked(true);

    const checkStatus = async () => {
      const apptId = sessionStorage.getItem("pending_appt_id");
      if (!apptId) { setApptStatus("confirmed"); return; }

      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("status, expires_at")
          .eq("id", apptId)
          .maybeSingle();

        if (error) return;

        if (data?.status === "confirmed" || data?.status === "completed") {
          // Payment confirmed by webhook
          setApptStatus("confirmed");
        } else if (data?.status === "cancelled" || data?.status === "expired") {
          setApptStatus("expired");
          sessionStorage.removeItem("payment_expires_at");
          sessionStorage.removeItem("pending_appt_id");
        } else {
          // Still pending — keep polling
          setApptStatus("pending");
        }
      } catch {
        // Network error — assume still pending
        setApptStatus("pending");
      }
    };

    // Poll every 3 seconds for up to 60 seconds
    checkStatus();
    const polling = setInterval(checkStatus, 3000);
    const timeout = setTimeout(() => {
      clearInterval(polling);
      if (apptStatus === "pending") setApptStatus("pending"); // force final check
    }, 60000);

    return () => { clearInterval(polling); clearTimeout(timeout); };
  }, [success]);

  // 3-minute payment lock state
  const [paymentExpiresAt, setPaymentExpiresAt] = useState<number | null>(() => {
    try {
      const stored = sessionStorage.getItem("payment_expires_at");
      if (stored) return Number(stored);
    } catch { /* */ }
    return null;
  });
  const [pendingApptId, setPendingApptId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("pending_appt_id");
    } catch { /* */ }
    return null;
  });

  // Check for expired appointment on remount/redirect return
  useEffect(() => {
    if (success || !paymentExpiresAt || !pendingApptId) return;

    const checkBooking = async () => {
      if (Date.now() > paymentExpiresAt) {
        // Check if appointment was cancelled (expired payment)
        const { data } = await supabase
          .from("appointments")
          .select("status")
          .eq("id", pendingApptId)
          .maybeSingle();
        if (data?.status === "cancelled") {
          // Payment expired — appointment was cancelled
          await supabase
            .from("appointments")
            .update({ expires_at: null })
            .eq("id", pendingApptId);
          toast({
            title: "Reserva Expirada",
            description: "O tempo para pagamento acabou. Escolha outro horário.",
            variant: "destructive",
          });
          sessionStorage.removeItem("payment_expires_at");
          sessionStorage.removeItem("pending_appt_id");
          setPaymentExpiresAt(null);
          setPendingApptId(null);
        }
      }
    };

    checkBooking();
  }, [success]);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!paymentExpiresAt) return 0;
    const diff = Math.max(0, Math.floor((paymentExpiresAt - Date.now()) / 1000));
    return diff;
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft > 0]);

  const timerText = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`;
  const timerColor = timeLeft <= 60 ? "text-red-400 animate-pulse" : timeLeft <= 120 ? "text-amber-400" : "text-emerald-400";

  const { data: shop, isLoading: loadingShop, isError: errorShop } = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbershops")
        .select("id, name, slug, address, logo_url, phone, settings")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
    staleTime: 0,
  });

  const { data: shopResources, isLoading: loadingResources } = useQuery({
    queryKey: ["shopResources", shop?.id],
    queryFn: async () => {
      const [servs, hours, barbers, barberServices] = await Promise.all([
        supabase.from("services").select("id, name, price, duration, requires_advance_payment, advance_payment_value, sort_order").eq("barbershop_id", shop!.id).eq("active", true).order("sort_order"),
        supabase.from("business_hours").select("*").eq("barbershop_id", shop!.id),
        supabase.from("barbers").select("id, name, avatar_url").eq("barbershop_id", shop!.id),
        supabase.from("barber_services").select("barber_id, service_id, commission_pct").eq("barbershop_id", shop!.id),
      ]);
      return { 
        services: servs.data || [], 
        hours: hours.data || [], 
        barbers: barbers.data || [],
        barberServices: barberServices.data || []
      };
    },
    enabled: !!shop?.id,
  });

  const { data: existingAppts = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["slots", shop?.id, selectedDate?.toISOString(), selectedBarber?.id],
    queryFn: async () => {
      // Clean up expired pending_payment appointments (best effort)
      try {
        await supabase.rpc("cleanup_expired_appointments");
      } catch {
        // RPC may not exist yet — harmless skip, client-side filter handles it.
      }

      const pad = (n: number) => String(n).padStart(2, '0');
      const y = selectedDate!.getFullYear();
      const m = pad(selectedDate!.getMonth() + 1);
      const d = pad(selectedDate!.getDate());
      const dayStart = `${y}-${m}-${d}T00:00:00-03:00`;
      const dayEnd = `${y}-${m}-${d}T23:59:59-03:00`;
      const now = new Date();

      // ───────────────────────────────────────────────────────────
      // PESSIMISTIC SLOT LOCKING — Fetch and filter appointments
      //
      // Occupying status (blocks the slot):
      // 1. confirmed, completed — permanent, always blocks
      // 2. pending/pendente_pagamento/pending_payment with active expires_at → blocks
      //
      // Free conditions:
      // 1. cancelled → never blocks
      // 2. pending/pendente_pagamento with expires_at < NOW → expired, free again
      // ───────────────────────────────────────────────────────────

      let query = supabase
        .from("appointments")
        .select("scheduled_at, service_name, status, barber_name, barber_id, expires_at")
        .eq("barbershop_id", shop!.id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd);

      // If barber is selected, fetch their appointments + unassigned ones
      if (selectedBarber) {
        query = query.or(`barber_id.eq.${selectedBarber.id},barber_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).filter((appt: any) => {
        // cancelled → terminal, never blocks
        if (appt.status === "cancelled") return false;

        // Reserve lock: blocks only if expires_at is still in the future
        const reserveStatuses = ["pending", "pendente_pagamento", "pending_payment"];
        if (reserveStatuses.includes(appt.status)) {
          if (appt.expires_at) {
            return new Date(appt.expires_at) > now;
          }
          return true; // no expiry set → block defensively
        }

        // confirmed, completed, completed, paid, etc. → always blocks
        return true;
      });
    },
    enabled: !!shop?.id && !!selectedDate,
  });
  
  const isPaymentConfigured = !!shop?.settings?.infinitepay_tag;

  useEffect(() => {
    if (!shop?.id) return;
    const channel = supabase
      .channel('public_booking_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `barbershop_id=eq.${shop.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ["slots"] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shop?.id, queryClient]);
  
  const availableBarbers = useMemo(() => {
    if (!selectedService || !shopResources) return [];
    const linkedBarberIds = shopResources.barberServices
      .filter(bs => bs.service_id === selectedService.id)
      .map(bs => bs.barber_id);
    return shopResources.barbers.filter(barber => linkedBarberIds.includes(barber.id));
  }, [selectedService, shopResources]);

  const disabledDates = useMemo(() => {
    const closedDays = shopResources?.hours?.filter((h: any) => h.is_closed).map((h: any) => h.day_of_week) || [];
    return (date: Date) => {
      if (date < startOfDay(new Date())) return true;
      if (closedDays.includes(date.getDay())) return true;
      return false;
    };
  }, [shopResources]);

  // PONTO DE ATUALIZAÇÃO 1: LÓGICA DE CAPTURA DE CLIENTE
  const bookingMutation = useMutation({
    mutationFn: async () => {
      const phoneDigits = clientData.phone.replace(/\D/g, "");
      if (phoneDigits.length < 10) throw new Error("Telefone inválido.");

      // ───────────────────────────────────────────────────────────
      // PESSIMISTIC PRE-FLIGHT CHECK: Re-verify slot availability
      // at the exact moment of creation to prevent double-booking
      // from race conditions.
      // ───────────────────────────────────────────────────────────
      const preFlightCheck = async (): Promise<boolean> => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const y = selectedDate!.getFullYear();
        const m = pad(selectedDate!.getMonth() + 1);
        const d = pad(selectedDate!.getDate());
        const dayStart = `${y}-${m}-${d}T00:00:00-03:00`;
        const dayEnd = `${y}-${m}-${d}T23:59:59-03:00`;
        const now = new Date();

        // Fetch ALL appointments for this barber/day — filter client-side
        const { data, error } = await supabase
          .from("appointments")
          .select("id, scheduled_at, status, expires_at")
          .eq("barbershop_id", shop!.id)
          .eq("barber_id", selectedBarber.id)
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .neq("status", "cancelled");

        if (error) return true; // On DB error, defer to RPC

        const [h, m] = selectedTime!.split(":").map(Number);
        const slotStart = new Date(selectedDate!);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = addMinutes(slotStart, selectedService.duration + BUFFER_MINUTES);

        // Is ANY record occupying this slot?
        for (const appt of (data || [])) {
          // Reserve lock: expired → does NOT occupy
          if (appt.status === "pendente_pagamento" || appt.status === "pending_payment") {
            if (appt.expires_at && new Date(appt.expires_at) <= now) continue;
          }

          // Time overlap check
          const timePart = appt.scheduled_at.split('T')[1]?.substring(0, 5) || appt.scheduled_at.split(' ')[1]?.substring(0, 5);
          if (!timePart) continue;
          const [dbH, dbM] = timePart.split(':').map(Number);
          const aStart = new Date(selectedDate!);
          aStart.setHours(dbH, dbM, 0, 0);
          const aEnd = addMinutes(aStart, selectedService.duration + 10);

          if (slotStart < aEnd && slotEnd > aStart) {
            return false; // SLOT OCCUPIED
          }
        }

        return true; // SLOT FREE
      };

      const isSlotFree = await preFlightCheck();
      if (!isSlotFree) {
        throw new Error("Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.");
      }

      // 1. Find or create customer (avoid upsert with composite key)
      const { data: existingCustomer, error: findError } = await supabase
        .from('customers')
        .select('id')
        .eq('barbershop_id', shop!.id)
        .eq('phone', phoneDigits)
        .maybeSingle();

      if (findError) throw new Error(`Erro ao buscar cliente: ${findError.message}`);

      let customerId: string;
      if (existingCustomer) {
        // Update last_seen / name
        await supabase
          .from('customers')
          .update({ name: clientData.name.trim(), last_seen: new Date().toISOString() })
          .eq('id', existingCustomer.id);
        customerId = existingCustomer.id;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('customers')
          .insert({ barbershop_id: shop!.id, phone: phoneDigits, name: clientData.name.trim(), last_seen: new Date().toISOString() })
          .select('id')
          .single();
        if (insertError) throw new Error(`Erro ao criar cliente: ${insertError.message}`);
        customerId = inserted.id;
      }

      // 2. Criação do Agendamento com `customer_id`
      const scheduledAt = new Date(selectedDate!);
      const [h, m] = selectedTime!.split(":").map(Number);
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDateForDB = `${scheduledAt.getFullYear()}-${pad(scheduledAt.getMonth()+1)}-${pad(scheduledAt.getDate())}T${pad(h)}:${pad(m)}:00-03:00`;

      const amountToCharge = (selectedService.advance_payment_value && selectedService.advance_payment_value > 0)
        ? selectedService.advance_payment_value
        : selectedService.price;

      // Nota: A RPC `create_public_appointment` pode precisar ser atualizada para aceitar `customer_id`
      // Por agora, vamos atualizar o agendamento em uma etapa separada.
      const { data: apptResponse, error: rpcError } = await supabase.rpc("create_public_appointment", {
        _barbershop_id: shop!.id,
        _client_name: clientData.name.trim(),
        _client_phone: phoneDigits, // Enviar telefone limpo
        _service_name: selectedService.name,
        _price: selectedService.price,
        _scheduled_at: formattedDateForDB,
        _payment_method: "pix"
      });

      if (rpcError) throw rpcError;
      const apptId = typeof apptResponse === 'object' ? apptResponse?.id : apptResponse;
      if (!apptId) throw new Error("Falha ao recuperar o ID do agendamento.");

      // 3. Vínculo do Agendamento com o Cliente, Barbeiro e LOCK DE 3 MIN.
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 min
      await supabase.from("appointments").update({
        customer_id: customerId,
        barber_id: selectedBarber.id,
        barber_name: selectedBarber.name,
        status: 'pendente_pagamento',
        has_signal: (selectedService.advance_payment_value || 0) > 0,
        signal_value: selectedService.advance_payment_value || 0,
        expires_at: expiresAt.toISOString(),
      }).eq("id", apptId);

      // 4. Redirecionamento para Pagamento
      const infiniteTag = shop?.settings?.infinitepay_tag;
      if (!infiniteTag) throw new Error("Esta barbearia não está configurada para receber pagamentos online.");

      const cleanHandle = infiniteTag.replace(/[@$ ]/g, '');
      const itemName = ((selectedService.advance_payment_value || 0) > 0) ? `Sinal: ${selectedService.name}` : selectedService.name;
      const priceInCents = Math.round(amountToCharge * 100);

      if (priceInCents < 100) {
        throw new Error("O valor do serviço deve ser de no mínimo R$ 1,00 para pagamento online.");
      }

      const items = JSON.stringify([{ name: itemName, price: priceInCents, quantity: 1 }]);
      const redirectUrl = `https://${window.location.host}/agendamentos/${slug}?success=true`;
      const checkoutUrl = `https://checkout.infinitepay.io/${cleanHandle}?items=${encodeURIComponent(items)}&order_nsu=${apptId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

      return { url: checkoutUrl, apptId };
    },
    onSuccess: (res) => {
      // Store payment lock state before redirect
      const expires = Date.now() + 3 * 60 * 1000;
      try {
        sessionStorage.setItem("payment_expires_at", String(expires));
        sessionStorage.setItem("pending_appt_id", res.apptId);
      } catch { /* */ }
      setPaymentExpiresAt(expires);
      setPendingApptId(res.apptId);
      queryClient.invalidateQueries({ queryKey: ['customers', shop?.id] });
      if (res.url) {
        window.location.href = res.url;
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Falha no Agendamento", 
        description: error.message || "Erro desconhecido. Tente novamente.", 
        variant: "destructive" 
      });
      setStep(3);
      setSelectedTime(null);
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    }
  });

  const timeSlots = useMemo(() => {
    if (!selectedDate || !selectedService || !shopResources) return [];
    const dayOfWeek = selectedDate.getDay();
    const bh = shopResources.hours.find((h: any) => h.day_of_week === dayOfWeek);
    if (!bh || bh.is_closed) return [];

    const slots: string[] = [];
    const [openH, openM] = bh.open_time.split(":").map(Number);
    const [closeH, closeM] = bh.close_time.split(":").map(Number);
    const now = new Date();

    for (let h = openH; h <= closeH; h++) {
      for (let m = (h === openH ? openM : 0); m < 60; m += 30) {
        if (h === closeH && m >= closeM) break;
        const slotStart = new Date(selectedDate);
        slotStart.setHours(h, m, 0, 0);
        if (isToday(selectedDate) && isBefore(slotStart, now)) continue;
        const slotEnd = addMinutes(slotStart, selectedService.duration + BUFFER_MINUTES);
        
        const hasConflict = existingAppts.some((appt: any) => {
          if (appt.status === 'cancelled') return false;
          const timeString = appt.scheduled_at.includes('T') ? appt.scheduled_at.split('T')[1].substring(0, 5) : appt.scheduled_at.split(' ')[1].substring(0, 5);
          const [dbH, dbM] = timeString.split(':').map(Number);
          const aStart = new Date(selectedDate);
          aStart.setHours(dbH, dbM, 0, 0);
          const aEnd = addMinutes(aStart, selectedService?.duration || 40);
          return slotStart < aEnd && slotEnd > aStart;
        });
        
        if (!hasConflict) {
          slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
      }
    }
    return slots;
  }, [selectedDate, selectedService, shopResources, existingAppts]);

  if (loadingShop) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>;
  if (errorShop || !shop) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-black text-foreground font-display">Barbearia Não Encontrada</h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-2xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center overflow-hidden">
                {shop.logo_url ? <img src={shop.logo_url} className="h-full w-full object-cover" alt="Logo" /> : <Scissors className="text-primary h-6 w-6" />}
             </div>
             <div>
                <h2 className="font-black text-lg truncate leading-none mb-1 font-display">{shop.name}</h2>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">
                   <MapPin className="h-3 w-3" /> {shop.address || "Endereço profissional"}
                </p>
             </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mt-8 px-4">
        {!isPaymentConfigured ? (
           <div className="animate-in fade-in-50 text-center py-12 px-6 max-w-md mx-auto bg-card border border-border rounded-3xl">
              <div className="h-24 w-24 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-amber-500/20">
                  <WifiOff className="h-12 w-12 text-amber-500" />
              </div>
              <h1 className="text-xl font-black text-foreground mb-2 tracking-tight font-display">Ops! Agendamentos Indisponíveis</h1>
              <p className="text-muted-foreground text-sm">Esta barbearia está configurando os pagamentos e não pode receber agendamentos no momento. Tente novamente mais tarde.</p>
            </div>
        ) :

        !success && !cancelled ? (
          <div>
            <div className="flex gap-2 mb-10">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? "gold-gradient shadow-gold" : "bg-secondary"}`} />
              ))}
            </div>

            {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h3 className="text-2xl font-black mb-1 tracking-tight text-foreground font-display">Qual serviço você deseja?</h3>
                    <p className="text-sm text-muted-foreground mb-8 font-medium">O pagamento do sinal ou valor total é obrigatório.</p>
                    <div className="grid gap-3">
                      {loadingResources ? <Loader2 className="animate-spin text-primary mx-auto" /> : shopResources?.services.map((s: any) => (
                          <button key={s.id} onClick={() => { setSelectedService(s); setStep(2); }} className="rounded-3xl border border-border bg-card p-6 text-left hover:border-primary/40 transition-all active:scale-[0.98]">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <p className="font-bold text-lg text-foreground">{s.name}</p>
                                      <p className="text-xs text-muted-foreground uppercase tracking-widest">{s.duration} min</p>
                                      <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                                          <ShieldCheck className="h-3 w-3 text-amber-500" />
                                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                                            Pagamento Online Obrigatório
                                          </span>
                                      </div>
                                  </div>
                                  <p className="text-xl font-black text-primary">R$ {Number(s.price).toFixed(2)}</p>
                              </div>
                          </button>
                      ))}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-2xl font-black mb-8 text-foreground font-display">Quem vai te atender?</h3>
                    {loadingResources ? (
                      <Loader2 className="animate-spin text-primary mx-auto" />
                    ) : availableBarbers.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {availableBarbers.map((b: any) => (
                            <button key={b.id} onClick={() => { setSelectedBarber(b); setStep(3); }} className="group rounded-3xl border border-border bg-card p-6 text-center hover:border-primary/40 transition-all">
                                <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-border group-hover:border-primary/50 transition-all">
                                    <AvatarImage src={b.avatar_url} />
                                    <AvatarFallback className="font-black text-xl bg-secondary">{b.name?.slice(0,2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <p className="font-bold text-foreground group-hover:text-primary transition-colors">{b.name}</p>
                            </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 px-6 max-w-md mx-auto bg-card border border-border rounded-3xl">
                          <div className="h-24 w-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
                              <UserX className="h-12 w-12 text-red-500" />
                          </div>
                          <h1 className="text-xl font-black text-foreground mb-2 tracking-tight font-display">Nenhum profissional disponível</h1>
                          <p className="text-muted-foreground text-sm">No momento, não há profissionais configurados para realizar o serviço de <span className="font-bold text-foreground">{selectedService?.name}</span>.</p>
                      </div>
                    )}
                    <Button variant="ghost" onClick={() => setStep(1)} className="mt-8 text-muted-foreground font-bold uppercase text-[10px] mx-auto flex"><ArrowLeft className="mr-2 h-3 w-3" /> Voltar</Button>
                </div>
            )}

            {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-2xl font-black mb-8 text-foreground font-display">Data e Horário</h3>
                    <div className="bg-card border border-border rounded-3xl p-4 mb-8 flex justify-center shadow-card">
                        <Calendar 
                          mode="single" 
                          selected={selectedDate || undefined} 
                          onSelect={(d) => d && setSelectedDate(d)} 
                          disabled={disabledDates || ((d) => d < startOfDay(new Date()))} 
                          locale={ptBR} 
                          className="mx-auto" 
                        />
                    </div>
                    {selectedDate && (
                        <div className="grid grid-cols-4 gap-2">
                            {loadingSlots ? (
                              <div className="col-span-4 flex justify-center py-4"><Loader2 className="animate-spin text-primary" /></div>
                            ) : timeSlots.length === 0 ? (
                              <p className="col-span-4 text-center text-sm text-destructive font-bold py-4">Sem horários para este dia.</p>
                            ) : (
                              timeSlots.map(t => (
                                  <button key={t} onClick={() => { setSelectedTime(t); setStep(4); }} className="h-12 rounded-xl border border-border bg-secondary/50 text-xs font-black text-foreground hover:border-primary/50 hover:text-primary transition-all">
                                      {t}
                                  </button>
                              ))
                            )}
                        </div>
                    )}
                    <Button variant="ghost" onClick={() => setStep(2)} className="mt-8 text-muted-foreground font-bold uppercase text-[10px] mx-auto flex"><ArrowLeft className="mr-2 h-3 w-3" /> Voltar</Button>
                </div>
            )}

            {step === 4 && (
                <div className="animate-in fade-in zoom-in-95">
                    <h3 className="text-2xl font-black mb-8 text-foreground text-center tracking-tight font-display">Finalize seu Agendamento</h3>
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-card space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Seu Nome Completo</label>
                                <Input 
                                  value={clientData.name} 
                                  onChange={(e) => setClientData({...clientData, name: e.target.value})} 
                                  placeholder="Ex: João da Silva" 
                                  className="bg-background border-border h-14 text-foreground font-bold" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Seu WhatsApp</label>
                                <Input 
                                  value={clientData.phone} 
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                                    let formatted = digits;
                                    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                                    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                                    setClientData({...clientData, phone: formatted});
                                  }} 
                                  placeholder="(00) 00000-0000" 
                                  className="bg-background border-border h-14 text-foreground font-mono" 
                                />
                            </div>
                        </div>

                        <div className="bg-secondary/50 rounded-3xl p-6 border border-border space-y-3">
                            <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground uppercase font-black">Serviço</span><span className="font-bold text-foreground text-right">{selectedService?.name}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground uppercase font-black">Profissional</span><span className="font-bold text-foreground text-right">{selectedBarber?.name}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground uppercase font-black">Horário</span><span className="font-bold text-primary">{selectedDate && format(selectedDate, "dd/MM")} às {selectedTime}</span></div>
                            <div className="pt-3 border-t border-border flex justify-between items-center">
                              <span className="text-sm font-black uppercase text-muted-foreground">
                                Valor a Pagar Agora
                              </span>
                              <span className="text-2xl font-black text-primary">
                                R$ {Number((selectedService.advance_payment_value || 0) > 0 ? selectedService.advance_payment_value : selectedService.price).toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between gap-4">
                          <Button variant="ghost" onClick={() => setStep(3)} className="h-16 px-6 text-muted-foreground rounded-2xl"><ArrowLeft className="h-5 w-5" /></Button>
                          <Button 
                              onClick={() => bookingMutation.mutate()} 
                              disabled={bookingMutation.isPending || !clientData.name.trim() || clientData.phone.replace(/\D/g, "").length < 10} 
                              className="flex-1 h-16 gold-gradient text-primary-foreground font-black rounded-2xl shadow-gold active:scale-95 transition-all"
                          >
                              {bookingMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <><QrCode className="mr-2 h-5 w-5" /> Pagar e Agendar</>}
                          </Button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Payment in progress — countdown + urgency */}
        {success && (apptStatus === "pending" || (timeLeft > 0 && !statusChecked)) && (
          <div className="animate-in fade-in zoom-in-95 text-center py-12 px-6 max-w-md mx-auto">
            <div className="h-24 w-24 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-amber-500/20">
              <span className={`text-5xl font-black tabular-nums ${timerColor}`}>{timerText}</span>
            </div>
            <h1 className="text-2xl font-black text-foreground mb-4 tracking-tight font-display">
              Aguardando Pagamento
            </h1>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 mb-8">
              <div className="flex items-center gap-2 mb-3 justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />
                <p className="text-sm font-bold text-amber-500">
                  Seu horário está reservado por tempo limitado
                </p>
              </div>
              <p className="text-muted-foreground text-sm mb-2">
                Realize o pagamento do sinal para confirmar. Após a expiração, o horário será liberado para outros clientes.
              </p>
              <p className={`text-3xl font-black tabular-nums ${timerColor}`}>
                {timerText}
              </p>
            </div>

            {timeLeft <= 60 && timeLeft > 0 && (
              <p className="text-red-400 text-xs font-bold animate-pulse mb-4">
                ⚠️ Último minuto para pagar! O horário será perdido se o pagamento não for confirmado.
              </p>
            )}

            {timeLeft === 0 && apptStatus !== "confirmed" && (
              <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6">
                  <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                  <h2 className="text-xl font-black text-foreground mb-2">Reserva Expirada</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    O tempo para pagamento acabou. Escolha outro horário e tente novamente.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    sessionStorage.removeItem("payment_expires_at");
                    sessionStorage.removeItem("pending_appt_id");
                    setSuccess(false);
                    setApptStatus(null);
                    setStatusChecked(false);
                    setStep(3);
                    setSelectedTime(null);
                    queryClient.invalidateQueries({ queryKey: ["slots"] });
                  }}
                  className="gold-gradient text-primary-foreground h-14 px-10 rounded-2xl font-black shadow-gold w-full"
                >
                  Escolher Outro Horário
                </Button>
              </div>
            )}

            {apptStatus === "confirmed" && (
              <div className="h-12 w-12 mx-auto mb-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Expired reservation */}
        {apptStatus === "expired" && (
          <div className="animate-in fade-in zoom-in-95 text-center py-12 px-6 max-w-md mx-auto">
            <div className="h-24 w-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-4 tracking-tight font-display">
              Reserva Expirada
            </h1>
            <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
              O tempo para pagamento acabou. Escolha outro horário e tente novamente.
            </p>
            <Button
              onClick={() => {
                sessionStorage.removeItem("payment_expires_at");
                sessionStorage.removeItem("pending_appt_id");
                setSuccess(false);
                setApptStatus(null);
                setStatusChecked(false);
                setStep(3);
                setSelectedTime(null);
                queryClient.invalidateQueries({ queryKey: ["slots"] });
              }}
              className="gold-gradient text-primary-foreground h-14 px-10 rounded-2xl font-black shadow-gold w-full"
            >
              Escolher Outro Horário
            </Button>
          </div>
        )}

        {success && !cancelled && apptStatus === "confirmed" && (
            <div className="animate-in fade-in zoom-in-95 text-center py-12 px-6 max-w-md mx-auto">
                <div className="h-24 w-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20">
                    <Check className="h-12 w-12 text-emerald-500" />
                </div>
                <h1 className="text-3xl font-black text-foreground mb-4 tracking-tight font-display">Agendamento Confirmado!</h1>
                <p className="text-muted-foreground mb-8 max-w-xs mx-auto">Seu pagamento foi aprovado. A sua vaga está garantida e te esperamos no horário marcado.</p>

                 <div className="flex flex-col gap-3 mb-6">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const start = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`);
                        const end = addMinutes(start, selectedService?.duration || 30);
                        const title = encodeURIComponent(`${selectedService?.name}${shop?.name ? ` - ${shop.name}` : ''}`);
                        const dates = `${format(start, "yyyyMMdd'T'HHmmss")}/${format(end, "yyyyMMdd'T'HHmmss")}`;
                        const location = encodeURIComponent(shop?.address || '');
                        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&location=${location}`, '_blank');
                      }}
                      className="h-14 rounded-2xl font-bold border-border text-foreground hover:bg-secondary gap-2"
                    >
                      <CalendarDays className="h-5 w-5" /> Adicionar ao Google Agenda
                    </Button>
                  
                  {shop?.address && (
                    <Button 
                      variant="outline"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`, '_blank')}
                      className="h-14 rounded-2xl font-bold border-border text-foreground hover:bg-secondary gap-2"
                    >
                      <MapPin className="h-5 w-5" /> Como Chegar
                    </Button>
                  )}
                </div>

                <Button onClick={() => navigate(`/`)} className="gold-gradient text-primary-foreground h-14 px-10 rounded-2xl font-black shadow-gold w-full">Ir para a Página Inicial</Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default PublicBooking;
