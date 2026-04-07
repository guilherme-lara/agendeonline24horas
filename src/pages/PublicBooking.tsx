import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Scissors, Loader2, Check, AlertTriangle, CalendarDays,
  MapPin, ArrowLeft, XCircle, QrCode, WifiOff, UserX, Tag, ShoppingBag, Minus, Plus, Trash2, ChevronRight
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
import { useCart, type CartItem } from "@/contexts/CartContext";

const BUFFER_MINUTES = 10;
const PAYMENT_LOCK_MS = 3 * 60 * 1000;

const ALWAYS_BLOCKING_STATUSES = new Set(["confirmed", "completed"]);
const TEMPORARY_LOCK_STATUSES = new Set(["pending_payment", "pendente_pagamento"]);
const LEGACY_PENDING_STATUSES = new Set(["pending", "pendente_sinal"]);
const NON_BLOCKING_STATUSES = new Set(["cancelled", "expired"]);

const getMinutesFromTimeString = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const getDayBoundsBRT = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return {
    dayStart: `${year}-${month}-${day}T00:00:00-03:00`,
    dayEnd: `${year}-${month}-${day}T23:59:59-03:00`,
  };
};

const getFallbackExpiry = (appointment: any) => {
  if (appointment?.expires_at) {
    const explicitExpiry = new Date(appointment.expires_at);
    if (!Number.isNaN(explicitExpiry.getTime())) {
      return explicitExpiry;
    }
  }

  if (appointment?.created_at) {
    const createdAt = new Date(appointment.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      return new Date(createdAt.getTime() + PAYMENT_LOCK_MS);
    }
  }

  return null;
};

const doesAppointmentBlockSlot = (appointment: any, now: Date) => {
  const status = String(appointment?.status ?? "").toLowerCase();

  if (NON_BLOCKING_STATUSES.has(status)) {
    return false;
  }

  if (ALWAYS_BLOCKING_STATUSES.has(status)) {
    return true;
  }

  if (TEMPORARY_LOCK_STATUSES.has(status)) {
    const expiry = getFallbackExpiry(appointment);
    return expiry ? expiry.getTime() > now.getTime() : true;
  }

  if (LEGACY_PENDING_STATUSES.has(status)) {
    const expiry = getFallbackExpiry(appointment);
    return expiry ? expiry.getTime() > now.getTime() : true;
  }

  return true;
};

const matchesSelectedBarber = (appointment: any, barber: any) => {
  if (!barber) return true;
  if (appointment?.barber_id) return appointment.barber_id === barber.id;
  if (appointment?.barber_name) return appointment.barber_name === barber.name;
  return false;
};

const getBrtMinutesFromScheduledAt = (scheduledAt: string) => {
  const date = new Date(scheduledAt);
  const totalUtcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (((totalUtcMinutes - 180) % 1440) + 1440) % 1440;
};

const hasTimeOverlap = (
  slotStartMinutes: number,
  slotEndMinutes: number,
  appointmentStartMinutes: number,
  appointmentEndMinutes: number,
) => slotStartMinutes < appointmentEndMinutes && slotEndMinutes > appointmentStartMinutes;

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { items: cartItems, addItem: addToCart, removeItem: removeFromCart, clearCart, totalPrice: cartTotalPrice, totalDuration: cartTotalDuration, totalAdvancePayment: cartTotalAdvance } = useCart();

  const [step, setStep] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientData, setClientData] = useState({ name: "", phone: "" });
  const [showCart, setShowCart] = useState(false);
  const [_cartUpdateTick, setCartUpdateTick] = useState(0);

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
          // Payment confirmed by webhook — update timer state too
          setApptStatus("confirmed");
          setCartUpdateTick((t) => t + 1);
        } else if (data?.status === "cancelled" || data?.status === "expired") {
          setApptStatus("expired");
          sessionStorage.removeItem("payment_expires_at");
          sessionStorage.removeItem("pending_appt_id");
        } else {
          // Still pending — keep polling but also check if expiry passed
          const expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : null;
          if (expiresAt && Date.now() > expiresAt) {
            setApptStatus("expired");
            sessionStorage.removeItem("payment_expires_at");
            sessionStorage.removeItem("pending_appt_id");
            return;
          }
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
      checkStatus(); // final check
    }, 62000);

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

  // FIX: Watch for changes in success/paymentExpiresAt to recompute timeLeft
  // This solves the timer not starting after redirect back from checkout
  useEffect(() => {
    if (!success) return;
    // Re-read from sessionStorage when success state changes
    try {
      const stored = sessionStorage.getItem("payment_expires_at");
      if (stored) setPaymentExpiresAt(Number(stored));
    } catch { /* */ }
  }, [success]);

  // Check for expired appointment on remount/redirect return
  useEffect(() => {
    if (success || !paymentExpiresAt || !pendingApptId) return;

    const checkBooking = async () => {
      if (Date.now() > paymentExpiresAt) {
        const { data } = await supabase
          .from("appointments")
          .select("status")
          .eq("id", pendingApptId)
          .maybeSingle();

        if (data?.status === "confirmed" || data?.status === "completed") {
          return;
        }

        await supabase
          .from("appointments")
          .update({ status: "cancelled", payment_status: "expired" })
          .eq("id", pendingApptId)
          .in("status", ["pending_payment", "pendente_pagamento", "pending", "pendente_sinal"]);

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
    };

    checkBooking();
  }, [success]);

  // Countdown timer — reset when paymentExpiresAt changes (e.g. after redirect)
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!paymentExpiresAt) {
      setTimeLeft(0);
      return;
    }
    const initial = Math.max(0, Math.floor((paymentExpiresAt - Date.now()) / 1000));
    setTimeLeft(initial);
  }, [paymentExpiresAt]);

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
      const [servs, hours, barbers, barberServices, cats] = await Promise.all([
        supabase.from("services").select("id, name, price, duration, requires_advance_payment, advance_payment_value, sort_order, category, category_id, price_is_starting_at").eq("barbershop_id", shop!.id).eq("active", true).order("sort_order"),
        supabase.from("business_hours").select("*").eq("barbershop_id", shop!.id),
        supabase.from("barbers").select("id, name, avatar_url").eq("barbershop_id", shop!.id),
        supabase.from("barber_services").select("barber_id, service_id, commission_pct").eq("barbershop_id", shop!.id),
        supabase.from("categories").select("id, name").eq("active", true),
      ]);
      return {
        services: servs.data || [],
        hours: hours.data || [],
        barbers: barbers.data || [],
        barberServices: barberServices.data || [],
        categories: cats.data || [],
      };
    },
    enabled: !!shop?.id,
  });

  const serviceDurationByName = useMemo(
    () => new Map((shopResources?.services || []).map((service: any) => [service.name, Number(service.duration) || 30])),
    [shopResources],
  );

  const fetchAppointmentsForSelectedDay = async () => {
    if (!shop?.id || !selectedDate) return [];

    const { dayStart, dayEnd } = getDayBoundsBRT(selectedDate);
    // Only select fields needed for availability checking — no client PII
    const selectWithExpiry = "id, scheduled_at, service_name, status, barber_id, barber_name, created_at, expires_at";
    const selectFallback = "id, scheduled_at, service_name, status, barber_id, barber_name, created_at";

    let result: any = await supabase
      .from("appointments")
      .select(selectWithExpiry)
      .eq("barbershop_id", shop.id)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (result.error && result.error.message?.toLowerCase().includes("expires_at")) {
      result = await supabase
        .from("appointments")
        .select(selectFallback)
        .eq("barbershop_id", shop.id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd);
    }

    if (result.error) {
      throw result.error;
    }

    return (result.data || []) as any[];
  };

  const { data: existingAppts = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["slots", shop?.id, selectedDate?.toISOString(), selectedBarber?.id],
    queryFn: async () => {
      const now = new Date();

      const appointments = await fetchAppointmentsForSelectedDay();

      return appointments.filter(
        (appointment: any) =>
          matchesSelectedBarber(appointment, selectedBarber) &&
          doesAppointmentBlockSlot(appointment, now),
      );
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

  // Categories available for this barbershop's services
  const shopCategories = useMemo(() => {
    if (!shopResources) return [];
    const ids = new Set<string>();
    for (const s of shopResources.services) {
      if (s.category_id) ids.add(s.category_id);
    }
    return shopResources.categories.filter((c: any) => ids.has(c.id));
  }, [shopResources]);

  // Auto-select first category when entering Step 2
  useEffect(() => {
    if (step === 2 && shopCategories.length > 0 && shopResources?.services.length > 0) {
      // Preserve existing category if valid, otherwise pick first available
      const hasValidCategory = selectedCategory && shopCategories.some((c: any) => c.id === selectedCategory);
      if (!hasValidCategory) {
        const firstValid = shopCategories.find((c: any) =>
          shopResources.services.some((s: any) => s.category_id === c.id)
        );
        if (firstValid) setSelectedCategory(firstValid.id);
      }
    }
  }, [step, shopCategories, shopResources, selectedCategory]);

  const disabledDates = useMemo(() => {
    const closedDays = shopResources?.hours?.filter((h: any) => h.is_closed).map((h: any) => h.day_of_week) || [];
    return (date: Date) => {
      if (date < startOfDay(new Date())) return true;
      if (closedDays.includes(date.getDay())) return true;
      return false;
    };
  }, [shopResources]);

  // Get barbers that can perform ALL services currently in cart (or the selected one)
  const effectiveServiceIds = useMemo(
    () => cartItems.length > 0
      ? cartItems.filter((i) => i.type === "service").map((i) => i.id)
      : [],
    [cartItems]
  );

  const availableBarbers = useMemo(() => {
    if (!shopResources) return [];
    if (effectiveServiceIds.length === 0) return shopResources.barbers;
    return shopResources.barbers.filter((b: any) =>
      effectiveServiceIds.every((sid: string) =>
        shopResources.barberServices.some((bs: any) => bs.service_id === sid && bs.barber_id === b.id)
      )
    );
  }, [shopResources, effectiveServiceIds]);

  // Compute total duration for slot calculation
  const totalCartDuration = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      if (item.product_type) return sum;
      return sum + (item.duration || 0);
    }, 0);
  }, [cartItems]);

  const addServiceToCart = useCallback((service: any, barber: any) => {
    const item: CartItem = {
      id: service.id,
      name: service.name,
      price: Number(service.price),
      duration: Number(service.duration),
      type: "service",
      advance_payment_value: service.advance_payment_value ? Number(service.advance_payment_value) : undefined,
      price_is_starting_at: service.price_is_starting_at,
      barber_id: barber?.id,
      barber_name: barber?.name,
      category_id: service.category_id,
    };
    addToCart(item);
    setCartUpdateTick((t) => t + 1);
  }, [addToCart]);

  // ───────────────────────────────────────────────────────────
  // BOOKING MUTATION — now supports cart with multiple services
  // ───────────────────────────────────────────────────────────
  const bookingMutation = useMutation({
    mutationFn: async () => {
      const phoneDigits = clientData.phone.replace(/\D/g, "");
      if (phoneDigits.length < 10) throw new Error("Telefone inválido.");
      if (!shop?.settings?.infinitepay_tag) {
        throw new Error("Erro: A barbearia ainda não configurou o método de pagamento.");
      }
      if (cartItems.length === 0) throw new Error("Adicione pelo menos um serviço ao agendamento.");

      // ───────────────────────────────────────────────────────────
      // PESSIMISTIC PRE-FLIGHT CHECK
      // ───────────────────────────────────────────────────────────
      const preFlightCheck = async (): Promise<boolean> => {
        const now = new Date();

        const servicesInCart = cartItems.filter((i) => i.type === "service");
        if (servicesInCart.length === 0) return true;

        // Use max duration slot for conflict checking
        const maxDuration = Math.max(...servicesInCart.map((s) => s.duration || 30));
        const slotStartMinutes = getMinutesFromTimeString(selectedTime!);
        const slotEndMinutes = slotStartMinutes + maxDuration + BUFFER_MINUTES;
        const appointments = await fetchAppointmentsForSelectedDay();

        for (const appointment of appointments) {
          if (!matchesSelectedBarber(appointment, selectedBarber)) continue;
          if (!doesAppointmentBlockSlot(appointment, now)) continue;

          const appointmentStartMinutes = getBrtMinutesFromScheduledAt(appointment.scheduled_at);
          const appointmentDuration = serviceDurationByName.get(appointment.service_name) || 30;
          const appointmentEndMinutes = appointmentStartMinutes + appointmentDuration + BUFFER_MINUTES;

          if (hasTimeOverlap(slotStartMinutes, slotEndMinutes, appointmentStartMinutes, appointmentEndMinutes)) {
            return false;
          }
        }

        return true;
      };

      const isSlotFree = await preFlightCheck();
      if (!isSlotFree) {
        throw new Error("Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.");
      }

      // 1. Find or create customer
      const { data: existingCustomer, error: findError } = await supabase
        .from('customers')
        .select('id')
        .eq('barbershop_id', shop!.id)
        .eq('phone', phoneDigits)
        .maybeSingle();

      if (findError) throw new Error(`Erro ao buscar cliente: ${findError.message}`);

      let customerId: string;
      if (existingCustomer) {
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

      // 2. Criação do Agendamento via RPC com múltiplos itens
      const scheduledAt = new Date(selectedDate!);
      const [h, m] = selectedTime!.split(":").map(Number);
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDateForDB = `${scheduledAt.getFullYear()}-${pad(scheduledAt.getMonth()+1)}-${pad(scheduledAt.getDate())}T${pad(h)}:${pad(m)}:00-03:00`;

      // Build JSON items for the RPC call
      const rpcItems = cartItems.map((item: CartItem) => ({
        name: item.name,
        price: item.price.toString(),
        duration: item.duration.toString(),
        barber_id: item.barber_id || selectedBarber?.id || null,
        barber_name: item.barber_name || selectedBarber?.name || null,
        product_type: item.type === "product",
}));

      const { data: apptId, error: rpcError } = await supabase.rpc('create_public_appointment', {
        _barbershop_id: shop!.id,
        _client_name: clientData.name.trim(),
        _client_phone: phoneDigits,
        _scheduled_at: formattedDateForDB,
        _payment_method: "pix_online",
        _barber_id: selectedBarber?.id || null,
        _barber_name: selectedBarber?.name || null,
        _customer_id: customerId,
        _items: JSON.stringify(rpcItems),
      });

      if (rpcError) {
        if (/horário|reservad|indisponível|conflict/i.test(rpcError.message || "")) {
          throw new Error("Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.");
        }
        throw new Error(rpcError.message);
      }

      if (!apptId) throw new Error("Falha ao recuperar o ID do agendamento.");

      // 3. Redirecionamento para Pagamento
      const infiniteTag = shop?.settings?.infinitepay_tag;
      if (!infiniteTag) throw new Error("Esta barbearia não está configurada para receber pagamentos online.");

      const cleanHandle = infiniteTag.replace(/[@$ ]/g, '');

      // Use cartTotalAdvance if cart has advance payment, else use full cart total
      const totalToCharge = cartTotalAdvance > 0 ? cartTotalAdvance : cartTotalPrice;
      const priceInCents = Math.round(totalToCharge * 100);

      if (priceInCents < 100) {
        throw new Error("O valor total deve ser de no mínimo R$ 1,00 para pagamento online.");
      }

      const serviceItems = cartItems.filter((i) => i.type === "service");
      const mainItem = serviceItems[0];
      const itemName = mainItem?.advance_payment_value && mainItem.advance_payment_value > 0
        ? `Sinal: ${serviceItems.length === 1 ? mainItem.name : `${serviceItems.length} serviços`}`
        : `Agendamento - ${shop?.name || 'Serviços'}`;

      const items = JSON.stringify([{ name: itemName, price: priceInCents, quantity: 1 }]);
      const redirectUrl = `https://${window.location.host}/agendamentos/${slug}?success=true`;
      const checkoutUrl = `https://checkout.infinitepay.io/${cleanHandle}?items=${encodeURIComponent(items)}&order_nsu=${apptId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

      return { url: checkoutUrl, apptId };
    },
    onSuccess: (res) => {
      // Store payment lock state before redirect
      const expires = Date.now() + PAYMENT_LOCK_MS;
      try {
        sessionStorage.setItem("payment_expires_at", String(expires));
        sessionStorage.setItem("pending_appt_id", res.apptId);
      } catch { /* */ }
      setPaymentExpiresAt(expires);
      setPendingApptId(res.apptId);
      clearCart();
      setCartUpdateTick((t) => t + 1);
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
      setSelectedTime(null);
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    }
  });

  // Compute timeSlots based on total cart duration instead of single service
  const timeSlots = useMemo(() => {
    if (!selectedDate || !shopResources) return [];

    const serviceItems = cartItems.filter((i) => i.type === "service");
    if (serviceItems.length === 0 && step < 4) return [];

    // Use totalCartDuration for slot blocking, fallback to single service during intermediate steps
    const firstServiceInCategory = shopResources.services.find((s: any) => s.category_id === selectedCategory);
    const durationToUse = totalCartDuration || Number(firstServiceInCategory?.duration || 30);

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
        const slotStartMinutes = h * 60 + m;
        const slotEndMinutes = slotStartMinutes + durationToUse + BUFFER_MINUTES;

        const hasConflict = existingAppts.some((appt: any) => {
          const appointmentStartMinutes = getBrtMinutesFromScheduledAt(appt.scheduled_at);
          const appointmentDuration = serviceDurationByName.get(appt.service_name) || 30;
          const appointmentEndMinutes = appointmentStartMinutes + appointmentDuration + BUFFER_MINUTES;

          return hasTimeOverlap(
            slotStartMinutes,
            slotEndMinutes,
            appointmentStartMinutes,
            appointmentEndMinutes,
          );
        });

        if (!hasConflict) {
          slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
      }
    }
    return slots;
  }, [selectedDate, cartItems, totalCartDuration, shopResources, existingAppts, step]);

  if (loadingShop) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>;
  if (errorShop || !shop) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-black text-foreground font-display">Barbearia Não Encontrada</h1>
    </div>
  );

  return (
    <div className={`min-h-screen bg-background text-foreground pb-20 ${cartItems.length > 0 && step >= 2 && step < 4 && !success ? 'pb-28' : ''}`}>
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
          {/* Cart button — shown after step 2 */}
          {step >= 2 && cartItems.length > 0 && !success && (
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2 rounded-xl border border-border bg-card hover:border-primary/40 transition-all"
            >
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
                {cartItems.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Cart drawer/modal */}
      {showCart && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={() => setShowCart(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-card rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom-50 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-foreground font-display">Carrinho</h3>
              <button onClick={() => setShowCart(false)} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                <Minus className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {cartItems.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum serviço adicionado.</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-secondary/50 rounded-2xl p-4 border border-border">
                    <div className="flex-1">
                      <p className="font-bold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.type === "product" ? "Produto" : `${item.duration} min`}</p>
                    </div>
                    <p className="text-sm font-black text-primary mr-3">R$ {Number(item.price).toFixed(2)}</p>
                    <button
                      onClick={() => { removeFromCart(item.id); setCartUpdateTick((t) => t + 1); }}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {cartItems.length > 0 && (
              <div className="bg-secondary/50 rounded-2xl p-4 border border-border space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-black">Total Serviços</span>
                  <span className="text-sm font-black text-foreground">{cartItems.filter((i) => i.type === "service").length} itens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-black">Tempo Estimado</span>
                  <span className="text-sm font-black text-foreground">{totalCartDuration} min</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="text-sm font-black text-muted-foreground uppercase">Total</span>
                  <span className="text-lg font-black text-primary">R$ {cartTotalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowCart(false)}
              className="w-full h-14 rounded-2xl font-black gold-gradient text-primary-foreground shadow-gold"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

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
                    <h3 className="text-2xl font-black mb-1 tracking-tight text-foreground font-display">Escolha a categoria</h3>
                    <p className="text-sm text-muted-foreground mb-8 font-medium">Selecione o tipo de serviço</p>
                    {loadingResources ? (
                      <Loader2 className="animate-spin text-primary mx-auto" />
                    ) : shopCategories.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {shopCategories.map((cat: any) => (
                            <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setStep(2); }} className="group rounded-3xl border border-border bg-card p-8 text-center hover:border-primary/40 transition-all active:scale-[0.98]">
                                <Tag className="h-8 w-8 mx-auto mb-4 text-primary" />
                                <p className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{cat.name}</p>
                            </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 px-6 max-w-md mx-auto bg-card border border-border rounded-3xl">
                          <div className="h-24 w-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
                              <UserX className="h-12 w-12 text-red-500" />
                          </div>
                          <h1 className="text-xl font-black text-foreground mb-2 tracking-tight font-display">Sem categorias</h1>
                          <p className="text-muted-foreground text-sm">Nenhuma categoria de serviço disponível no momento.</p>
                      </div>
                    )}
                </div>
            )}

            {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-2xl font-black mb-1 text-foreground font-display">Escolha os serviços</h3>
                    <p className="text-sm text-muted-foreground mb-4 font-medium">
                      Adicione quantos quiser de diferentes categorias
                    </p>

                    {/* Category switcher — always visible when there are items in cart */}
                    {shopCategories.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                        {shopCategories.map((cat: any) => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                              selectedCategory === cat.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {loadingResources ? (
                      <Loader2 className="animate-spin text-primary mx-auto" />
                    ) : shopResources?.services.filter((s: any) => s.category_id === selectedCategory).length || 0 > 0 ? (
                      <div className="grid gap-3">
                        {shopResources?.services
                          .filter((s: any) => s.category_id === selectedCategory)
                          .map((s: any) => {
                            const isInCart = cartItems.some((ci) => ci.id === s.id);
                            return (
                            <div key={s.id}
                              className={`rounded-3xl border bg-card p-5 text-left transition-all ${
                                isInCart
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : "border-border hover:border-primary/40"
                              } active:scale-[0.98]`}
                            >
                                <div className="flex justify-between items-start gap-2 min-w-0">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-base sm:text-lg text-foreground truncate">{s.name}</p>
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest">{s.duration} min</p>
                                    </div>
                                    <p className="text-base sm:text-xl font-black text-primary text-right whitespace-nowrap shrink-0">
                                      {s.price_is_starting_at
                                        ? <span className="text-[10px] sm:text-xs block text-muted-foreground font-extrabold uppercase tracking-wide leading-none mb-0.5">A partir de</span>
                                        : null}
                                      R$ {Number(s.price).toFixed(2)}
                                    </p>
                                </div>
                                {isInCart ? (
                                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                      <Check className="h-3 w-3" /> No carrinho
                                    </span>
                                    <button
                                      onClick={() => removeFromCart(s.id)}
                                      className="text-xs font-bold text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => addServiceToCart(s, selectedBarber)}
                                    className="mt-3 w-full h-10 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-1"
                                  >
                                    <Plus className="h-3 w-3" /> Adicionar
                                  </button>
                                )}
                            </div>
                          )})}
                      </div>
                    ) : (
                      <div className="text-center py-12 px-6 max-w-md mx-auto bg-card border border-border rounded-3xl">
                          <div className="h-24 w-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
                              <UserX className="h-12 w-12 text-red-500" />
                          </div>
                          <h1 className="text-xl font-black text-foreground mb-2 tracking-tight font-display">Sem serviços</h1>
                          <p className="text-muted-foreground text-sm">Não há serviços nesta categoria.</p>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedCategory(null);
                        setStep(1);
                      }}
                      className="mt-6 text-muted-foreground font-bold uppercase text-[10px] mx-auto flex"
                    >
                      <ArrowLeft className="mr-2 h-3 w-3" /> Voltar
                    </Button>
                </div>
            )}

            {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-2xl font-black mb-1 text-foreground font-display">Quem vai te atender?</h3>
                    <p className="text-sm text-muted-foreground mb-6 font-medium">
                      {cartItems.filter((i) => i.type === "service").length > 1
                        ? `Profissionais que realizam os ${cartItems.filter((i) => i.type === "service").length} serviços selecionados`
                        : cartItems.length === 1
                          ? `Profissionais que realizam ${cartItems[0]?.name}`
                          : "Selecione um profissional"
                      }
                    </p>
                    {loadingResources ? (
                      <Loader2 className="animate-spin text-primary mx-auto" />
                    ) : availableBarbers.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {availableBarbers
                          .map((b: any) => (
                            <button key={b.id} onClick={() => { setSelectedBarber(b); setStep(4); }} className="group rounded-3xl border border-border bg-card p-6 text-center hover:border-primary/40 transition-all active:scale-[0.98]">
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
                          <p className="text-muted-foreground text-sm">Nenhum profissional realiza os serviços selecionados no momento.</p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setStep(2)}
                      className="mt-8 text-muted-foreground font-bold uppercase text-[10px] mx-auto flex"
                    >
                      <ArrowLeft className="mr-2 h-3 w-3" /> Voltar aos Serviços
                    </Button>
                </div>
            )}

            {step === 4 && (
                <div className="animate-in fade-in zoom-in-95">
                    <h3 className="text-2xl font-black mb-8 text-foreground text-center tracking-tight font-display">Finalize seu Agendamento</h3>
                    <p className="text-sm text-muted-foreground text-center mb-6 -mt-4">
                      Confira seus serviços, escolha a data e o horário
                    </p>
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-card space-y-6">
                        {/* Show cart summary if there are items, otherwise single service summary */}
                        {cartItems.length > 0 ? (
                          <div className="bg-secondary/50 rounded-2xl p-6 border border-border space-y-3 mb-2">
                            <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground uppercase font-black">Profissional</span><span className="font-bold text-foreground text-right">{selectedBarber?.name}</span></div>
                            <div className="border-t border-border pt-3">
                              <p className="text-xs text-muted-foreground uppercase font-black mb-2">Itens do Carrinho ({cartItems.length})</p>
                              {cartItems.map((item: CartItem) => (
                                <div key={item.id} className="flex justify-between items-center py-1.5">
                                  <span className="text-sm text-foreground">{item.name}</span>
                                  <span className="text-sm font-bold text-muted-foreground">{item.type === "product" ? "Produto" : `${item.duration} min`}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-secondary/50 rounded-2xl p-6 border border-border space-y-3 mb-2">
                            <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground uppercase font-black">Categoria</span><span className="font-bold text-foreground text-right">{shopResources?.categories.find((c: any) => c.id === selectedCategory)?.name || ""}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground uppercase font-black">Serviço</span><span className="font-bold text-foreground text-right">—</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground uppercase font-black">Profissional</span><span className="font-bold text-foreground text-right">{selectedBarber?.name}</span></div>
                          </div>
                        )}

                        <div className="bg-card border border-border rounded-3xl p-4 mb-2 flex justify-center shadow-card">
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
                                      <button key={t} onClick={() => setSelectedTime(t)} className={`h-12 rounded-xl border text-xs font-black transition-all ${selectedTime === t ? "border-primary text-primary bg-primary/10" : "border-border bg-secondary/50 text-foreground hover:border-primary/50 hover:text-primary"}`}>
                                          {t}
                                      </button>
                                  ))
                                )}
                            </div>
                        )}

                        <div className="space-y-4 mt-2">
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
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-black uppercase text-muted-foreground">
                                {cartItems.length > 0
                                  ? `Total a Pagar (${cartItems.length} ${cartItems.length === 1 ? 'item' : 'itens'})`
                                  : "Valor a Pagar Agora"
                                }
                              </span>
                              <div className="text-right">
                                <span className="text-2xl font-black text-primary">
                                  R$ {Number((cartTotalAdvance > 0 ? cartTotalAdvance : cartTotalPrice).toFixed(2))}
                                </span>
                                {cartItems.length > 0 && totalCartDuration > 0 && (
                                  <p className="text-[10px] text-muted-foreground font-bold">{totalCartDuration} min total</p>
                                )}
                              </div>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between gap-4">
                          <Button variant="ghost" onClick={() => { setStep(2); }} className="h-16 px-6 text-muted-foreground rounded-2xl"><ArrowLeft className="h-5 w-5" /></Button>
                          <Button
                              onClick={() => bookingMutation.mutate()}
                              disabled={bookingMutation.isPending || !clientData.name.trim() || clientData.phone.replace(/\D/g, "").length < 10 || !selectedTime || cartItems.length === 0}
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

        {/* Sticky Cart Footer — only during booking flow (steps 2-4) */}
        {!success && !cancelled && cartItems.length > 0 && step >= 2 && step < 4 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
            <div className="container max-w-2xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => { setShowCart(true); }}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="relative">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                    </div>
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center leading-none">
                      {cartItems.length}
                    </span>
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-black text-foreground truncate">
                      {cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'} · {totalCartDuration} min
                    </p>
                    <p className="text-sm font-black text-primary">
                      R$ {cartTotalPrice.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </button>
                <Button
                  onClick={() => setStep(step === 2 ? 3 : 4)}
                  className="h-12 px-8 rounded-2xl font-black gold-gradient text-primary-foreground shadow-gold whitespace-nowrap shrink-0"
                >
                  {step === 2 ? 'Escolher Profissional' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
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
                        const end = addMinutes(start, totalCartDuration || 30);
                        const title = encodeURIComponent(`Agendamento - ${shop?.name || 'Barbearia'}`);
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
