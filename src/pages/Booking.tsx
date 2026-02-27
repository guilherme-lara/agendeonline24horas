import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, ArrowRight, Loader2, AlertCircle, RefreshCw, CheckCircle2 
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBooking } from "@/contexts/BookingContext";
import StepIndicator from "@/components/StepIndicator";
import ServiceCard from "@/components/ServiceCard";
import BarberCard from "@/components/BarberCard";
import TimeSlotPicker from "@/components/TimeSlotPicker";
import CustomerInfoStep from "@/components/CustomerInfoStep";
import PaymentStep from "@/components/PaymentStep";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";

const Booking = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const booking = useBooking();
  const { toast } = useToast();

  // --- 1. ADICIONADO: ESTADO DE SUCESSO PARA EVITAR O REFERENCE ERROR ---
  const [success, setSuccess] = useState(false); //

  const { data: barbershop, isLoading: loadingShop } = useQuery({
    queryKey: ["booking-shop", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbershops")
        .select("id, name, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["booking-services", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", barbershop?.id)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
  });

  const { data: barbers = [], isLoading: loadingBarbers } = useQuery({
    queryKey: ["booking-barbers", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("barbershop_id", barbershop?.id)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
  });

  // --- MUTAÇÃO CORRIGIDA ---
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!barbershop?.id) throw new Error("Barbearia não identificada.");

      const payload = {
        barbershop_id: barbershop.id,
        client_name: booking.customerName,
        client_phone: booking.customerPhone,
        barber_id: booking.selectedBarber?.id,
        barber_name: booking.selectedBarber?.name,
        service_id: booking.selectedServices[0]?.id,
        service_name: booking.selectedServices.map(s => s.name).join(", "),
        price: booking.totalPrice,
        scheduled_at: new Date(
          `${format(booking.selectedDate!, "yyyy-MM-dd")}T${booking.selectedTime}:00`
        ).toISOString(),
        payment_method: booking.paymentMethod,
        status: "pending",
      };

      const { data, error } = await supabase.from("appointments").insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setSuccess(true); // Ativa o estado de sucesso
      toast({ title: "Agendamento Realizado!", description: "Sua vaga foi reservada com sucesso." });
      
      // Limpa o contexto e redireciona após um pequeno delay para o usuário ver o check
      setTimeout(() => {
        booking.reset();
        navigate(`/${slug}/success`);
      }, 1500);
    },
    onError: (err: any) => {
      toast({ title: "Falha ao agendar", description: "Tente outro horário ou profissional.", variant: "destructive" });
    }
  });

  // --- TELA DE SUCESSO (PREVINE O ERRO DE RENDERIZAÇÃO) ---
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in zoom-in-95 duration-500">
        <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black text-white mb-2">Tudo Certo!</h2>
        <p className="text-slate-400">Estamos te redirecionando para o resumo...</p>
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500 mt-6" />
      </div>
    );
  }

  const canProceed = () => {
    switch (booking.currentStep) {
      case 1: return booking.selectedServices.length > 0;
      case 2: return booking.selectedBarber !== null;
      case 3: return booking.selectedDate !== null && booking.selectedTime !== null;
      case 4: return booking.customerName.trim().length >= 2 && booking.customerPhone.replace(/\D/g, "").length >= 10;
      case 5: return booking.paymentMethod !== null;
      default: return true;
    }
  };

  if (loadingShop || loadingServices || loadingBarbers) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse font-bold uppercase tracking-widest">Sincronizando Agenda...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8 pb-40 animate-in fade-in duration-500">
      <div className="mb-8">
        <StepIndicator currentStep={booking.currentStep} />
      </div>

      {/* Renders dos Steps permanecem iguais... */}
      {booking.currentStep === 1 && (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <h2 className="text-2xl font-black text-white mb-1">Escolha os Serviços</h2>
          <div className="space-y-3 mt-6">
            {services.map((service: any) => (
              <ServiceCard key={service.id} service={service} selected={booking.selectedServices.some((s) => s.id === service.id)} onToggle={() => booking.toggleService(service)} />
            ))}
          </div>
        </div>
      )}

      {/* ... (Outros steps 2, 3, 4, 5) */}

      {booking.currentStep === 6 && (
        <div className="animate-in zoom-in-95 duration-300">
          <h2 className="text-2xl font-black text-white mb-6">Confirme os Detalhes:</h2>
          <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-8 space-y-6 shadow-2xl backdrop-blur-md">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Serviços</p>
                {booking.selectedServices.map(s => <p key={s.id} className="text-sm font-bold text-white">{s.name}</p>)}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total</p>
                <p className="text-2xl font-black text-emerald-400 tracking-tighter">R$ {booking.totalPrice}</p>
              </div>
            </div>
            {/* ... Resto do resumo */}
          </div>
        </div>
      )}

      {/* NAVEGAÇÃO FIXA */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 p-6 z-50">
        <div className="container max-w-2xl flex gap-4">
          {booking.currentStep > 1 && (
            <Button variant="ghost" onClick={() => booking.setStep(booking.currentStep - 1)} className="h-14 px-8 text-slate-500 font-bold hover:text-white rounded-2xl">
              <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
            </Button>
          )}
          {booking.currentStep < 6 ? (
            <Button onClick={() => booking.setStep(booking.currentStep + 1)} disabled={!canProceed()} className="flex-1 gold-gradient text-black font-black h-14 rounded-2xl shadow-xl shadow-primary/20 transition-all">
              Próximo Passo <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-emerald-900/20 active:scale-95">
              {confirmMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : "Confirmar e Agendar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
