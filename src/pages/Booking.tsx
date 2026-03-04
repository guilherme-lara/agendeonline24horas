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
  const { slug } = useParams(); // Identificador da barbearia na URL
  const navigate = useNavigate();
  const booking = useBooking();
  const { toast } = useToast();

  // --- BUSCA DE DADOS DA BARBEARIA (INFO MESTRE) ---
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

  // --- BUSCA DE SERVIÇOS REAIS ---
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
    refetchOnWindowFocus: true, // Sincroniza preços se o cliente mudar de aba
  });

  // --- BUSCA DE PROFISSIONAIS REAIS ---
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

  // --- MUTAÇÃO: CONFIRMAR AGENDAMENTO (BLINDADA) ---
  const confirmMutation = useMutation({
    mutationFn: async () => {
      // 1. Health Check de disponibilidade (Futuramente você pode checar se o horário ainda está vago)
      if (!barbershop?.id) throw new Error("Barbearia não identificada.");

      const payload = {
        barbershop_id: barbershop.id,
        client_name: booking.customerName,
        client_phone: booking.customerPhone,
        barber_id: booking.selectedBarber?.id,
        barber_name: booking.selectedBarber?.name,
        service_id: booking.selectedServices[0]?.id, // Simplificado para o primeiro serviço
        service_name: booking.selectedServices.map(s => s.name).join(", "),
        price: booking.totalPrice,
        scheduled_at: new Date(
          `${format(booking.selectedDate!, "yyyy-MM-dd")}T${booking.selectedTime}:00`
        ).toISOString(),
        payment_method: booking.paymentMethod,
        status: "pending", // Inicializa como pendente até aprovação ou sinal
      };

      const { data, error } = await supabase.from("appointments").insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Agendamento Realizado!", description: "Sua vaga foi reservada com sucesso." });
      booking.reset();
      navigate(`/${slug}/success`);
    },
    onError: (err: any) => {
      toast({ 
        title: "Falha ao agendar", 
        description: "Este horário pode ter sido preenchido. Tente outro.", 
        variant: "destructive" 
      });
    }
  });

  // --- LÓGICA DE NAVEGAÇÃO E VALIDAÇÃO ---
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

  const handleNext = () => booking.setStep(booking.currentStep + 1);
  const handleBack = () => booking.setStep(booking.currentStep - 1);

  // --- RENDERS DE CARREGAMENTO ---
  if (loadingShop || loadingServices || loadingBarbers) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse font-bold uppercase tracking-widest">Preparando Agenda...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8 pb-32 animate-in fade-in duration-500">
      <div className="mb-8">
        <StepIndicator currentStep={booking.currentStep} />
      </div>

      {/* STEP 1: SERVIÇOS REAIS DO BANCO */}
      {booking.currentStep === 1 && (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Escolha os Serviços</h2>
          <p className="text-sm text-slate-500 mb-8">Selecione o que deseja realizar hoje.</p>
          <div className="space-y-3">
            {services.map((service: any) => (
              <ServiceCard
                key={service.id}
                service={service}
                selected={booking.selectedServices.some((s) => s.id === service.id)}
                onToggle={() => booking.toggleService(service)}
              />
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: PROFISSIONAIS REAIS */}
      {booking.currentStep === 2 && (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Quem vai te atender?</h2>
          <p className="text-sm text-slate-500 mb-8">Selecione o seu profissional de confiança.</p>
          <div className="space-y-3">
            {barbers.map((barber: any) => (
              <BarberCard
                key={barber.id}
                barber={barber}
                selected={booking.selectedBarber?.id === barber.id}
                onSelect={() => booking.setBarber(barber)}
              />
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: CALENDÁRIO E HORÁRIOS */}
      {booking.currentStep === 3 && (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Data e Horário</h2>
          <p className="text-sm text-slate-500 mb-8">Selecione o melhor momento para você.</p>
          
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-4 mb-8 backdrop-blur-sm shadow-xl">
            <Calendar
              mode="single"
              selected={booking.selectedDate || undefined}
              onSelect={(date) => date && booking.setDate(date)}
              disabled={(date) => date < new Date() || date.getDay() === 0}
              locale={ptBR}
              className="mx-auto"
            />
          </div>

          {booking.selectedDate && (
            <div className="space-y-4">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                 Horários disponíveis para {format(booking.selectedDate, "dd 'de' MMMM", { locale: ptBR })}
               </p>
               <TimeSlotPicker
                  slots={[]}
                  selectedTime={booking.selectedTime}
                  onSelect={(time) => booking.setTime(time)}
                />
            </div>
          )}
        </div>
      )}

      {/* STEP 4 E 5: INFO E PAGAMENTO (COMPONENTES ISOLADOS) */}
      {booking.currentStep === 4 && <CustomerInfoStep />}
      {booking.currentStep === 5 && <PaymentStep />}

      {/* STEP 6: RESUMO FINAL (REATIVO AOS DADOS DO BANCO) */}
      {booking.currentStep === 6 && (
        <div className="animate-in zoom-in-95 duration-300">
          <h2 className="text-2xl font-black text-white mb-6 tracking-tight">Quase lá! Confira tudo:</h2>
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur-md">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Serviços</p>
                    {booking.selectedServices.map(s => <p key={s.id} className="text-sm font-bold text-white">{s.name}</p>)}
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-xl font-black text-emerald-400">R$ {booking.totalPrice}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-800">
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Data</p>
                    <p className="text-sm font-bold text-white">{format(booking.selectedDate!, "dd/MM/yyyy")}</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Horário</p>
                    <p className="text-sm font-bold text-cyan-400">{booking.selectedTime}</p>
                </div>
            </div>

            <div className="pt-6 border-t border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Profissional</p>
                <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
                    <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-cyan-400">
                        {booking.selectedBarber?.name.slice(0,1)}
                    </div>
                    <span className="font-bold text-white">{booking.selectedBarber?.name}</span>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* NAVEGAÇÃO FIXA PREMIUM */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 p-6 z-50">
        <div className="container max-w-2xl flex gap-4">
          {booking.currentStep > 1 && (
            <Button variant="ghost" onClick={handleBack} className="h-14 px-8 text-slate-400 font-bold hover:text-white hover:bg-slate-900 rounded-2xl">
              <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
            </Button>
          )}
          
          {booking.currentStep < 6 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-cyan-900/20 disabled:opacity-30 transition-all"
            >
              Continuar <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-emerald-900/20 transition-all active:scale-95"
            >
              {confirmMutation.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Reservando Horário...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-5 w-5" /> Confirmar e Agendar</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
