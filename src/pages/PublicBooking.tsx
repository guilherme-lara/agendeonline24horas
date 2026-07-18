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
import { format, addMinutes, isToday, startOfDay } from "date-fns";
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

// Minuto-do-dia atual no fuso de Brasília (UTC-3), independente do fuso do navegador.
const getNowBrtMinutes = () => {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (((utcMinutes - 180) % 1440) + 1440) % 1440;
};

const getBrtMinutesFromScheduledAt = (scheduledAt: string) => {
  const date = new Date(scheduledAt);
  const totalUtcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (((totalUtcMinutes - 180) % 1440) + 1440) % 1440;
};

// Início do dia atual em BRT (UTC-3), independente do fuso do navegador.
const getTodayStartBrt = () => {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()));
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
  const { items: cartItems, addItem: addToCart, removeItem: removeFromCart, updateQuantity: updateItemQuantity, clearCart, totalPrice: cartTotalPrice, totalDuration: cartTotalDuration, totalAdvancePayment: cartTotalAdvance } = useCart();

  const [step, setStep] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientData, setClientData] = useState({ name: "", phone: "" });
  const [showCart, setShowCart] = useState(false);
  
  const [_cartUpdateTick, setCartUpdateTick] = useState(0);
  const [resetCategoryFlag, setResetCategoryFlag] = useState(false);

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
        const { data, error } = await (supabase as any)
          .from("appointments_public")
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
        const { data } = await (supabase as any)
          .from("appointments_public")
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
      const { data, error } = await (supabase as any)
        .from("barbershops_public")
        .select("id, name, slug, address, logo_url, phone, infinitepay_tag, pix_static_qr_url, pix_beneficiary, confirmation_message_template")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      // Normalize to keep .settings.* access patterns working downstream
      return data
        ? {
            ...data,
            settings: {
              infinitepay_tag: data.infinitepay_tag,
              pix_static_qr_url: data.pix_static_qr_url,
              pix_beneficiary: data.pix_beneficiary,
              confirmation_message_template: data.confirmation_message_template,
            },
          }
        : null;
    },
    enabled: !!slug,
    staleTime: 0,
  });

  const { data: shopResources, isLoading: loadingResources } = useQuery({
    queryKey: ["shopResources", shop?.id],
    queryFn: async () => {
      const [servs, hours, barbers, barberServices, cats] =
        await Promise.all([
          supabase
            .from("services")
            .select(
              "id, name, price, duration, requires_advance_payment, advance_payment_value, sort_order, category, category_id, price_is_starting_at",
            )
            .eq("barbershop_id", shop!.id)
            .eq("active", true)
            .order("sort_order"),
          supabase
            .from("business_hours")
            .select("*")
            .eq("barbershop_id", shop!.id),
          supabase
            .from("barbers")
            .select("id, name, avatar_url")
            .eq("barbershop_id", shop!.id),
          supabase
            .from("barber_services")
            .select("barber_id, service_id")
            .eq("barbershop_id", shop!.id),
          supabase
            .from("categories")
            .select("id, name")
            .eq("active", true)
            .eq("barbershop_id", shop!.id),
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

    let result: any = await (supabase as any)
      .from("appointments_public")
      .select(selectWithExpiry)
      .eq("barbershop_id", shop.id)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (result.error && result.error.message?.toLowerCase().includes("expires_at")) {
      result = await (supabase as any)
        .from("appointments_public")
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

  // Categories available for this clinic's services
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
      // If we just reset the category via "Voltar", don't auto-select
      if (resetCategoryFlag) {
        setResetCategoryFlag(false);
        return;
      }

      // Preserve existing category if valid, otherwise pick first available
      const hasValidCategory = selectedCategory && shopCategories.some((c: any) => c.id === selectedCategory);
      if (!hasValidCategory) {
        const firstValid = shopCategories.find((c: any) =>
          shopResources.services.some((s: any) => s.category_id === c.id)
        );
        if (firstValid) setSelectedCategory(firstValid.id);
      }
    }
  }, [step, shopCategories, shopResources, selectedCategory, resetCategoryFlag]);

  const disabledDates = useMemo(() => {
    const closedDays = shopResources?.hours?.filter((h: any) => h.is_closed).map((h: any) => h.day_of_week) || [];
    return (date: Date) => {
      if (date < getTodayStartBrt()) return true;
      if (closedDays.includes(date.getDay())) return true;
      return false;
    };
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
      const { data, error } = await (supabase as any)
        .from("barbershops_public")
        .select("id, name, slug, address, logo_url, phone, infinitepay_tag, pix_static_qr_url, pix_beneficiary, confirmation_message_template")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      // Normalize to keep .settings.* access patterns working downstream
      return data
        ? {
            ...data,
            settings: {
              infinitepay_tag: data.infinitepay_tag,
              pix_static_qr_url: data.pix_static_qr_url,
              pix_beneficiary: data.pix_beneficiary,
              confirmation_message_template: data.confirmation_message_template,
            },
          }
        : null;
    },
    enabled: !!slug,
    staleTime: 0,
  });

  const { data: shopResources, isLoading: loadingResources } = useQuery({
    queryKey: ["shopResources", shop?.id],
    queryFn: async () => {
      const [servs, hours, barbers, barberServices, cats] =
        await Promise.all([
          supabase
            .from("services")
            .select(
              "id, name, price, duration, requires_advance_payment, advance_payment_value, sort_order, category, category_id, price_is_starting_at",
            )
            .eq("barbershop_id", shop!.id)
            .eq("active", true)
            .order("sort_order"),
          supabase
            .from("business_hours")
            .select("*")
            .eq("barbershop_id", shop!.id),
          supabase
            .from("barbers")
            .select("id, name, avatar_url")
            .eq("barbershop_id", shop!.id),
          supabase
            .from("barber_services")
            .select("barber_id, service_id")
            .eq("barbershop_id", shop!.id),
          supabase
            .from("categories")
            .select("id, name")
            .eq("active", true)
            .eq("barbershop_id", shop!.id),
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

    let result: any = await (supabase as any)
      .from("appointments_public")
      .select(selectWithExpiry)
      .eq("barbershop_id", shop.id)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (result.error && result.error.message?.toLowerCase().includes("expires_at")) {
      result = await (supabase as any)
        .from("appointments_public")
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

  // Categories available for this clinic's services
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
      // If we just reset the category via "Voltar", don't auto-select
      if (resetCategoryFlag) {
        setResetCategoryFlag(false);
        return;
      }

      // Preserve existing category if valid, otherwise pick first available
      const hasValidCategory = selectedCategory && shopCategories.some((c: any) => c.id === selectedCategory);
      if (!hasValidCategory) {
        const firstValid = shopCategories.find((c: any) =>
          shopResources.services.some((s: any) => s.category_id === c.id)
        );
        if (firstValid) setSelectedCategory(firstValid.id);
      }
    }
  }, [step, shopCategories, shopResources, selectedCategory, resetCategoryFlag]);

  // Get barbers that can perform ALL services currently in cart
  const serviceIdsInCart = useMemo(
    () => cartItems.filter((i) => i.type === "service").map((i) => i.id),
    [cartItems]
  );

  const availableBarbers = useMemo(() => {
    if (!shopResources) return [];
    return shopResources.barbers;
  }, [shopResources]);

  // Compute total duration for slot calculation (products don't count)
  const totalCartDuration = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      if (item.type === "product") return sum;
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
      requires_advance_payment: service.requires_advance_payment,
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

      // 1. Find or create customer via secure RPC
      const { data: customerIdData, error: custErr } = await (supabase as any).rpc(
        'find_or_create_public_customer',
        {
          _barbershop_id: shop!.id,
          _phone: phoneDigits,
          _name: clientData.name.trim(),
        }
      );
      if (custErr) throw new Error(`Erro ao registrar cliente: ${custErr.message}`);
      const customerId: string = customerIdData as string;

      // 2. Criação do Agendamento via RPC com múltiplos itens
      const scheduledAt = new Date(selectedDate!);
      const [h, m] = selectedTime!.split(":").map(Number);
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDateForDB = `${scheduledAt.getFullYear()}-${pad(scheduledAt.getMonth()+1)}-${pad(scheduledAt.getDate())}T${pad(h)}:${pad(m)}:00-03:00`;

      // Build JSON items for the RPC call.
      // IMPORTANT: products are NOT tied to a professional. Only services carry a barber_id.
      const rpcItems = cartItems.map((item: CartItem) => {
        const isProduct = item.type === "product";
        return {
          name: item.name,
          price: item.price.toString(),
          duration: isProduct ? "0" : item.duration.toString(),
          quantity: isProduct ? (item.quantity ?? 1) : 1,
          barber_id: isProduct ? null : (item.barber_id || selectedBarber?.id || null),
          barber_name: isProduct ? null : (item.barber_name || selectedBarber?.name || null),
          product_type: isProduct,
          category_id: isProduct ? null : (item.category_id || null),
        };
      });

      // O Supabase requer os argumentos antigos de serviço base para resolver a sobrecarga (function overloading)
      const serviceItems = cartItems.filter((i) => i.type === "service");
      const mainItem = serviceItems[0] || cartItems[0];

      const { data: apptId, error: rpcError } = await supabase.rpc(
        "create_public_appointment",
        {
          _barbershop_id: shop!.id,
          _client_name: clientData.name.trim(),
          _client_phone: phoneDigits,
          _service_name: mainItem?.name || "Serviço Adicional",
          _price: mainItem?.price || 0,
          _scheduled_at: formattedDateForDB,
          _payment_method: totalToCharge > 0 ? "pix_online" : "local",
          _barber_id: (selectedBarber?.id || null) as any,
          _barber_name: (selectedBarber?.name || null) as any,
          _customer_id: (customerId || null) as any,
          _items: rpcItems as any,
        },
      );

      if (rpcError) {
        if (/horário|reservad|indisponível|conflict/i.test(rpcError.message || "")) {
          throw new Error("Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.");
        }
        throw new Error(rpcError.message);
      }

      if (!apptId) throw new Error("Falha ao recuperar o ID do agendamento.");

      // 3. Redirecionamento para Pagamento
      const infiniteTag = shop?.settings?.infinitepay_tag;
      if (!infiniteTag) return { url: null, apptId };

      const cleanHandle = infiniteTag.replace(/[@$ ]/g, '');

      // Use cartTotalAdvance if cart has advance payment, else use full cart total
      const totalToCharge = cartTotalAdvance > 0 ? cartTotalAdvance : cartTotalPrice;
      const priceInCents = Math.round(totalToCharge * 100);

      if (priceInCents > 0 && priceInCents < 100) {
        throw new Error("O valor total deve ser de no mínimo R$ 1,00 para pagamento online.");
      }

      // serviceItems e mainItem já foram declarados acima para uso no RPC
      const itemName = mainItem?.advance_payment_value && mainItem.advance_payment_value > 0
        ? `Sinal: ${serviceItems.length === 1 ? mainItem.name : `${serviceItems.length} serviços`}`
        : `Agendamento - ${shop?.name || 'Serviços'}`;

      const items = JSON.stringify([{ name: itemName, price: priceInCents, quantity: 1 }]);
      if (priceInCents === 0) {
        return { url: null, apptId };
      }

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
    const nowBrtMinutes = getNowBrtMinutes();

    for (let h = openH; h <= closeH; h++) {
      for (let m = (h === openH ? openM : 0); m < 60; m += 30) {
        if (h === closeH && m >= closeM) break;
        const slotStartMinutes = h * 60 + m;
        // Blindagem de fuso: bloqueia horários passados usando o relógio de Brasília,
        // não o fuso local do dispositivo do cliente.
        if (isToday(selectedDate) && slotStartMinutes <= nowBrtMinutes) continue;
        const slotEndMinutes = slotStartMinutes + durationToUse + BUFFER_MINUTES;
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-10 rounded-xl font-bold shadow-sm w-full transition-colors"
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
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-10 rounded-xl font-bold shadow-sm w-full transition-colors"
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
                        const title = encodeURIComponent(`Agendamento - ${shop?.name || 'Estabelecimento'}`);
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

                <Button onClick={() => navigate(`/`)} className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-10 rounded-xl font-bold shadow-sm w-full transition-colors">Ir para a Página Inicial</Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default PublicBooking;