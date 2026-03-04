import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Scissors, Loader2, Check, Wallet, AlertTriangle, 
  MessageCircle, MapPin, ArrowLeft, Copy, QrCode, Clock, XCircle
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- ESTADOS DE NAVEGAÇÃO ---
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientData, setClientData] = useState({ name: "", phone: "" });
  const [success, setSuccess] = useState(false); 
  const [signalPending, setSignalPending] = useState(false);
  const [cancelled, setCancelled] = useState(false); // NOVO ESTADO DE CANCELAMENTO
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const realtimeChannelRef = useRef<any>(null);

  // --- QUERIES ---
  const { data: shop, isLoading: loadingShop, isError: errorShop } = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => {
      const { data: publicData, error } = await supabase
        .from("barbershops")
        .select("id, name, slug, address, logo_url, phone, settings")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return publicData;
    },
    enabled: !!slug,
  });

  const { data: shopResources } = useQuery({
    queryKey: ["shop-resources", shop?.id],
    queryFn: async () => {
      const [servs, hours, barbers] = await Promise.all([
        supabase.from("services").select("id, name, price, duration, requires_advance_payment, advance_payment_value, sort_order").eq("barbershop_id", shop!.id).eq("active", true).order("sort_order"),
        supabase.from("business_hours").select("*").eq("barbershop_id", shop!.id),
        supabase.from("barbers_public" as any).select("*").eq("barbershop_id", shop!.id),
      ]);
      return { services: servs.data || [], hours: hours.data || [], barbers: barbers.data || [] };
    },
    enabled: !!shop?.id,
  });

  const { data: existingAppts = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["slots", shop?.id, selectedDate?.toISOString()],
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate!).toISOString();
      const dayEnd = new Date(selectedDate!);
      dayEnd.setHours(23, 59, 59);

      const { data, error } = await supabase
        .from("appointments_public" as any)
        .select("scheduled_at, service_name, status")
        .eq("barbershop_id", shop!.id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!shop?.id && !!selectedDate,
  });

  // --- REALTIME: Escuta confirmação do pagamento ---
  useEffect(() => {
    if (!appointmentId || !signalPending) return;

    const channel = supabase
      .channel(`appointment-${appointmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `id=eq.${appointmentId}`,
        },
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (newStatus === 'confirmed' || newStatus === 'pending') {
            // Admin confirmou o pagamento!
            setSignalPending(false);
            setSuccess(true);
            setStep(5);
          } else if (newStatus === 'cancelled' || newStatus === 'rejected') {
            // Admin RECUSOU o pagamento / cancelou
            setSignalPending(false);
            setCancelled(true); // GATILHO DA TELA DE ERRO
            toast({ title: "Pagamento Recusado", description: "O estabelecimento cancelou este agendamento.", variant: "destructive" });
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appointmentId, signalPending, toast]);

  // --- MUTAÇÃO ---
  const bookingMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(selectedDate!);
      const [h, m] = selectedTime!.split(":").map(Number);
      scheduledAt.setHours(h, m, 0, 0);

      const requiresSignal = selectedService.requires_advance_payment && (selectedService.advance_payment_value || 0) > 0;

      const { data: apptId, error } = await supabase.rpc("create_public_appointment", {
        _barbershop_id: shop!.id,
        _client_name: clientData.name.trim(),
        _client_phone: clientData.phone.trim(),
        _service_name: selectedService.name,
        _price: selectedService.price,
        _scheduled_at: scheduledAt.toISOString(),
        _payment_method: "local"
      });

      if (error) throw error;

      await supabase.from("appointments").update({ barber_name: selectedBarber.name }).eq("id", apptId);

      if (requiresSignal) {
        await supabase.from("appointments").update({ status: "pendente_sinal" }).eq("id", apptId);
        return { id: apptId, type: 'signal' };
      }

      return { id: apptId, type: 'success' };
    },
    onSuccess: (res) => {
      if (res.type === 'signal') {
        setAppointmentId(res.id);
        setSignalPending(true);
      } else {
        setSuccess(true);
        setStep(5);
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: "Esse horário acabou de ser ocupado. Tente outro.", variant: "destructive" });
    }
  });

  // --- LÓGICA DE HORÁRIOS ---
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
          const aStart = new Date(appt.scheduled_at);
          const aEnd = addMinutes(aStart, 40); 
          return slotStart < aEnd && slotEnd > aStart;
        });

        if (!hasConflict) {
          slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
      }
    }
    return slots;
  }, [selectedDate, selectedService, shopResources, existingAppts]);

  const handleCopyPix = () => {
    const key = (shop?.settings as any)?.pix_key;
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedPix(true);
    toast({ title: "Pix Copiado!", description: "A chave foi copiada para a área de transferência." });
    setTimeout(() => setCopiedPix(false), 2000);
  };

  if (loadingShop) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>;

  if (errorShop || !shop) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-black text-foreground font-display">Barbearia Não Encontrada</h1>
      <Button onClick={() => window.location.reload()} className="mt-4 gold-gradient text-primary-foreground font-bold px-8">Recarregar</Button>
    </div>
  );

  const shopSettings = (shop.settings || {}) as any;
  const pixKey = shopSettings.pix_key || "";
  const pixBeneficiary = shopSettings.pix_beneficiary || shop.name;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* HEADER DINÂMICO */}
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
          <Button variant="ghost" onClick={() => window.location.href='/meus-agendamentos'} className="text-[10px] font-black uppercase text-muted-foreground hover:text-primary">Minha Agenda</Button>
        </div>
      </div>

      <div className="container max-w-2xl mt-8 px-4">
        {/* STEP INDICATOR */}
        {!success && !signalPending && !cancelled && (
            <div className="flex gap-2 mb-10">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? "gold-gradient shadow-gold" : "bg-secondary"}`} />
              ))}
            </div>
        )}

        {/* STEP 1: SERVIÇOS */}
        {step === 1 && !cancelled && !success && !signalPending && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h3 className="text-2xl font-black mb-1 tracking-tight text-foreground font-display">O que vamos fazer hoje?</h3>
