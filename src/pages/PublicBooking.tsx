import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { 
  Scissors, Loader2, Check, Wallet, QrCode, AlertCircle, 
  CalendarDays, AlertTriangle, MessageCircle, RefreshCw, MapPin, Clock, User, ArrowRight, ArrowLeft 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
import { format, addMinutes, isBefore, isToday, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BUFFER_MINUTES = 10;

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- ESTADOS DE NAVEGAÇÃO ---
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientData, setClientData] = useState({ name: "", phone: "" });
  
  // --- ADICIONADO: ESTADOS DE SUCESSO E SINAL (CORREÇÃO DO ERRO) ---
  const [success, setSuccess] = useState(false); //
  const [signalPending, setSignalPending] = useState(false);

  // --- QUERIES ---
  const { data: shop, isLoading: loadingShop, isError: errorShop } = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("barbershops").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: shopResources } = useQuery({
    queryKey: ["shop-resources", shop?.id],
    queryFn: async () => {
      const [servs, hours, barbers] = await Promise.all([
        supabase.from("services").select("*").eq("barbershop_id", shop?.id).eq("active", true).order("sort_order"),
        supabase.from("business_hours").select("*").eq("barbershop_id", shop?.id),
        supabase.from("barbers").select("*").eq("barbershop_id", shop?.id).eq("active", true),
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
        .from("appointments")
        .select("scheduled_at, service_name, status")
        .eq("barbershop_id", shop?.id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd.toISOString())
        .neq("status", "cancelled");
      if (error) throw error;
      return data;
    },
    enabled: !!shop?.id && !!selectedDate,
  });

  // --- MUTAÇÃO ---
  const bookingMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(selectedDate!);
      const [h, m] = selectedTime!.split(":").map(Number);
      scheduledAt.setHours(h, m, 0, 0);

      const requiresSignal = selectedService.requires_advance_payment && (selectedService.advance_payment_value || 0) > 0;

      // Chama a função RPC (Certifique-se de ter rodado o DROP FUNCTION no banco)
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
        setSignalPending(true);
      } else {
        setSuccess(true); // Define sucesso como verdadeiro para mostrar a tela final
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: "Falha ao processar agendamento. Tente novamente.", variant: "destructive" });
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
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return slots;
  }, [selectedDate, selectedService, shopResources, existingAppts]);

  if (loadingShop) return <div className="min-h-screen bg-[#0b1224] flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>;

  if (errorShop || !shop) return (
    <div className="min-h-screen bg-[#0b1224] flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-black text-white">Barbearia Não Encontrada</h1>
      <Button onClick={() => window.location.reload()} className="mt-4 gold-gradient">Recarregar</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b1224] text-white selection:bg-cyan-500/30 pb-20">
      {/* HEADER */}
      <div className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-2xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                {shop.logo_url ? <img src={shop.logo_url} className="h-full w-full object-cover" /> : <Scissors className="text-cyan-400 h-6 w-6" />}
             </div>
             <h2 className="font-black text-lg truncate">{shop.name}</h2>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mt-8">
        {/* STEP INDICATOR - CORRIGIDO */}
        {!success && !signalPending && (
            <div className="flex gap-2 mb-10 px-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "bg-slate-800"}`} />
              ))}
            </div>
        )}

        {/* TELAS DE SUCESSO E SINAL */}
        {success ? (
            <div className="animate-in fade-in zoom-in-95 text-center py-12 px-6">
                <div className="h-24 w-24 bg-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                    <Check className="h-12 w-12 text-emerald-500" />
                </div>
                <h1 className="text-3xl font-black text-white mb-4">Agendamento Realizado!</h1>
                <p className="text-slate-500 mb-10">Tudo pronto! Um lembrete será enviado para o seu WhatsApp.</p>
                <Button onClick={() => window.location.href = "/"} className="gold-gradient h-14 px-10 rounded-2xl font-black shadow-xl">Voltar ao Início</Button>
            </div>
        ) : signalPending ? (
            <div className="animate-in fade-in zoom-in-95 text-center py-12 px-6">
                <div className="h-24 w-24 bg-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                    <Wallet className="h-12 w-12 text-amber-500" />
                </div>
                <h1 className="text-3xl font-black text-white mb-4 tracking-tight">Pagamento Pendente</h1>
                <p className="text-slate-500 mb-10 max-w-xs mx-auto">Este serviço exige um sinal de <b>R$ {Number(selectedService.advance_payment_value).toFixed(2).replace(".", ",")}</b> para confirmar.</p>
                <Button onClick={() => window.open(`https://wa.me/55${shop.phone?.replace(/\D/g, "")}`, "_blank")} className="bg-green-600 hover:bg-green-500 h-14 px-10 rounded-2xl font-black shadow-xl w-full flex items-center justify-center gap-2">
                    <MessageCircle className="h-5 w-5" /> Enviar Comprovante
                </Button>
            </div>
        ) : (
            /* CONTEÚDO DOS PASSOS (1 a 4) */
            <div className="px-4">
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-2xl font-black mb-8 text-white">O que vamos fazer hoje?</h3>
                        <div className="grid gap-3">
                            {shopResources?.services.map((s: any) => (
                                <button key={s.id} onClick={() => { setSelectedService(s); setStep(2); }} className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 text-left hover:border-cyan-500/40 transition-all active:scale-[0.98]">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-lg text-white">{s.name}</p>
                                            <p className="text-xs text-slate-500 uppercase tracking-widest">{s.duration} min</p>
                                        </div>
                                        <p className="text-xl font-black text-emerald-400">R$ {Number(s.price).toFixed(2)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-2xl font-black mb-8 text-white">Quem vai te atender?</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {shopResources?.barbers.map((b: any) => (
                                <button key={b.id} onClick={() => { setSelectedBarber(b); setStep(3); }} className="group rounded-[2rem] border border-slate-800 bg-slate-900/40 p-6 text-center hover:border-cyan-500/40 transition-all">
                                    <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-slate-800 group-hover:border-cyan-500/50 transition-all">
                                        <AvatarImage src={b.avatar_url} />
                                        <AvatarFallback className="font-black text-xl">{b.name.slice(0,2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <p className="font-bold text-white group-hover:text-cyan-400 transition-colors">{b.name}</p>
                                </button>
                            ))}
                        </div>
                        <Button variant="ghost" onClick={() => setStep(1)} className="mt-8 text-slate-500 font-bold uppercase text-[10px] mx-auto flex"><ArrowLeft className="mr-2 h-3 w-3" /> Voltar</Button>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-2xl font-black mb-8 text-white">Escolha o horário</h3>
                        <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-4 mb-8 flex justify-center backdrop-blur-sm shadow-xl">
                            <Calendar mode="single" selected={selectedDate || undefined} onSelect={(d) => d && setSelectedDate(d)} disabled={(d) => d < startOfDay(new Date())} locale={ptBR} className="mx-auto" />
                        </div>
                        {selectedDate && (
                            <div className="grid grid-cols-4 gap-2">
                                {timeSlots.map(t => (
                                    <button key={t} onClick={() => { setSelectedTime(t); setStep(4); }} className="h-12 rounded-xl border border-slate-800 bg-slate-950/50 text-xs font-black text-white hover:border-cyan-500/50 hover:text-cyan-400 transition-all">{t}</button>
                                ))}
                            </div>
                        )}
                        <Button variant="ghost" onClick={() => setStep(2)} className="mt-8 text-slate-500 font-bold uppercase text-[10px] mx-auto flex"><ArrowLeft className="mr-2 h-3 w-3" /> Voltar</Button>
                    </div>
                )}

                {step === 4 && (
                    <div className="animate-in fade-in zoom-in-95">
                        <h3 className="text-2xl font-black mb-8 text-white text-center tracking-tight">Finalizar Reserva</h3>
                        <div className="bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl space-y-6 backdrop-blur-xl">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Seu Nome</label>
                                    <Input value={clientData.name} onChange={(e) => setClientData({...clientData, name: e.target.value})} placeholder="Ex: João Silva" className="bg-slate-950 border-slate-800 h-14 text-white font-bold" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                                    <Input value={clientData.phone} onChange={(e) => setClientData({...clientData, phone: e.target.value})} placeholder="(00) 00000-0000" className="bg-slate-950 border-slate-800 h-14 text-white font-mono" />
                                </div>
                            </div>
                            <div className="bg-slate-950/50 rounded-3xl p-6 border border-slate-800 space-y-3">
                                <div className="flex justify-between items-center"><span className="text-xs text-slate-500 uppercase font-black">Serviço</span><span className="font-bold text-white">{selectedService.name}</span></div>
                                <div className="flex justify-between items-center"><span className="text-xs text-slate-500 uppercase font-black">Horário</span><span className="font-bold text-cyan-400">{format(selectedDate!, "dd/MM")} às {selectedTime}</span></div>
                                <div className="pt-3 border-t border-slate-800 flex justify-between items-center"><span className="text-sm font-black uppercase text-slate-400">Valor</span><span className="text-2xl font-black text-emerald-400">R$ {Number(selectedService.price).toFixed(2)}</span></div>
                            </div>
                            <Button onClick={() => bookingMutation.mutate()} disabled={bookingMutation.isPending || !clientData.name.trim() || clientData.phone.length < 10} className="w-full h-16 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-xl shadow-cyan-900/20 active:scale-95 transition-all">
                                {bookingMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : "Confirmar Agendamento"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default PublicBooking;
