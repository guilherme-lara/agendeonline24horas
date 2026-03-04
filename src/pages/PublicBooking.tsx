import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Scissors, Loader2, Check, Wallet, AlertTriangle, 
  MessageCircle, MapPin, ArrowLeft, Copy, QrCode, Clock, XCircle, Info
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
  const [cancelled, setCancelled] = useState(false);
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
            setSignalPending(false);
            setSuccess(true);
            setStep(5);
          } else if (newStatus === 'cancelled' || newStatus === 'rejected') {
            setSignalPending(false);
            setCancelled(true);
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

        {/* STEP 1: SERVIÇOS (COM AVISO DE SINAL) */}
        {step === 1 && !cancelled && !success && !signalPending && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h3 className="text-2xl font-black mb-1 tracking-tight text-foreground font-display">O que vamos fazer hoje?</h3>
                <p className="text-sm text-muted-foreground mb-8 font-medium">Selecione o serviço para agendamento.</p>
                <div className="grid gap-3">
                    {shopResources?.services.map((s: any) => (
                        <button key={s.id} onClick={() => { setSelectedService(s); setStep(2); }} className="rounded-3xl border border-border bg-card p-6 text-left hover:border-primary/40 transition-all active:scale-[0.98]">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-lg text-foreground">{s.name}</p>
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest">{s.duration} min</p>
                                    
                                    {/* AVISO DE SINAL OBRIGATÓRIO NO CARD DO SERVIÇO */}
                                    {s.requires_advance_payment && (
                                        <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                                              Requer Sinal de R$ {Number(s.advance_payment_value).toFixed(2).replace(".", ",")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xl font-black text-primary">R$ {Number(s.price).toFixed(2)}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* STEP 2: BARBEIRO */}
        {step === 2 && !cancelled && !success && !signalPending && (
            <div className="animate-in fade-in slide-in-from-right-4">
                <h3 className="text-2xl font-black mb-8 text-foreground font-display">Quem vai te atender?</h3>
                <div className="grid grid-cols-2 gap-4">
                    {shopResources?.barbers.map((b: any) => (
                        <button key={b.id} onClick={() => { setSelectedBarber(b); setStep(3); }} className="group rounded-[2rem] border border-border bg-card p-6 text-center hover:border-primary/40 transition-all">
                            <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-border group-hover:border-primary/50 transition-all">
                                <AvatarImage src={b.avatar_url} />
                                <AvatarFallback className="font-black text-xl bg-secondary">{b.name?.slice(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors">{b.name}</p>
                        </button>
                    ))}
                </div>
                <Button variant="ghost" onClick={() => setStep(1)} className="mt-8 text-muted-foreground font-bold uppercase text-[10px] mx-auto flex"><ArrowLeft className="mr-2 h-3 w-3" /> Voltar</Button>
            </div>
        )}

        {/* STEP 3: DATA E HORA */}
        {step === 3 && !cancelled && !success && !signalPending && (
            <div className="animate-in fade-in slide-in-from-right-4">
                <h3 className="text-2xl font-black mb-8 text-foreground font-display">Data e Horário</h3>
                <div className="bg-card border border-border rounded-[2rem] p-4 mb-8 flex justify-center shadow-card">
                    <Calendar 
                      mode="single" 
                      selected={selectedDate || undefined} 
                      onSelect={(d) => d && setSelectedDate(d)} 
                      disabled={(d) => d < startOfDay(new Date())} 
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

        {/* STEP 4: PREENCHER DADOS E GERAR AGENDAMENTO */}
        {step === 4 && !cancelled && !success && !signalPending && (
            <div className="animate-in fade-in zoom-in-95">
                <h3 className="text-2xl font-black mb-8 text-foreground text-center tracking-tight font-display">Seus Dados</h3>
                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-card space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Seu Nome</label>
                            <Input 
                              value={clientData.name} 
                              onChange={(e) => setClientData({...clientData, name: e.target.value})} 
                              placeholder="Ex: João Silva" 
                              className="bg-background border-border h-14 text-foreground font-bold" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">WhatsApp</label>
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
                        <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground uppercase font-black">Horário</span><span className="font-bold text-primary">{selectedDate && format(selectedDate, "dd/MM")} às {selectedTime}</span></div>
                        <div className="pt-3 border-t border-border flex justify-between items-center"><span className="text-sm font-black uppercase text-muted-foreground">Valor</span><span className="text-2xl font-black text-primary">R$ {selectedService && Number(selectedService.price).toFixed(2).replace(".", ",")}</span></div>
                    </div>

                    <div className="pt-4 flex items-center justify-between gap-4">
                      <Button variant="ghost" onClick={() => setStep(3)} className="h-16 px-6 text-muted-foreground rounded-2xl"><ArrowLeft className="h-5 w-5" /></Button>
                      <Button 
                          onClick={() => bookingMutation.mutate()} 
                          disabled={bookingMutation.isPending || !clientData.name.trim() || clientData.phone.replace(/\D/g, "").length < 10} 
                          className="flex-1 h-16 gold-gradient text-primary-foreground font-black rounded-2xl shadow-gold active:scale-95 transition-all"
                      >
                          {bookingMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <><Check className="mr-2 h-5 w-5" /> Confirmar Horário</>}
                      </Button>
                    </div>
                </div>
            </div>
        )}

        {/* TELA FINAL: AGUARDANDO SINAL (O NOVO "STEP 5" DE CHECKOUT) */}
        {signalPending && !cancelled && (
            <div className="animate-in fade-in zoom-in-95">
                <h3 className="text-2xl font-black mb-8 text-foreground text-center tracking-tight font-display">Pagamento do Sinal</h3>
                
                <div className="bg-card border border-border rounded-[2.5rem] p-6 shadow-card space-y-6">
                  
                  {/* ALERTA DE INSTRUÇÃO */}
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-500">Quase lá!</p>
                      <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 mt-1">
                        Seu horário está pré-reservado. Realize o pagamento do sinal e envie o comprovante para finalizarmos sua reserva.
                      </p>
                    </div>
                  </div>

                  {/* SEÇÃO PIX */}
                  {pixKey ? (
                    <div className="space-y-4">
                      <div className="bg-secondary/50 border border-border rounded-2xl p-4 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Valor a pagar agora</p>
                        <p className="text-3xl font-black text-primary">
                          R$ {selectedService && Number(selectedService.advance_payment_value).toFixed(2).replace(".", ",")}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Chave Pix ({pixBeneficiary})</p>
                        <div className="flex gap-2">
                          <div className="flex-1 bg-background rounded-xl px-4 py-3 font-mono text-xs text-foreground break-all border border-border flex items-center">
                            {pixKey}
                          </div>
                          <Button onClick={handleCopyPix} className="h-auto bg-primary text-primary-foreground px-4 shrink-0 hover:bg-primary/90 rounded-xl">
                            {copiedPix ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="pt-4 border-t border-border space-y-4">
                    {/* BOTÃO WHATSAPP */}
                    <Button 
                      onClick={() => window.open(`https://wa.me/55${shop.phone?.replace(/\D/g, "")}?text=Olá! Acabei de pagar o sinal do meu agendamento. Meu nome é ${clientData.name}. Segue o comprovante:`, "_blank")} 
                      className="bg-[#25D366] hover:bg-[#20bd5a] text-white h-14 rounded-xl font-black shadow-lg w-full flex items-center justify-center gap-2"
                    >
                        <MessageCircle className="h-5 w-5" /> Enviar Comprovante no WhatsApp
                    </Button>

                    {/* BOTÃO BLOQUEADO (AGUARDANDO) */}
                    <Button disabled className="w-full h-16 rounded-2xl font-black bg-secondary text-muted-foreground opacity-100 border border-border">
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Aguardando confirmação do salão...
                    </Button>
                  </div>
                </div>
            </div>
        )}

        {/* TELA FINAL: SUCESSO */}
        {success && !cancelled && (
            <div className="animate-in fade-in zoom-in-95 text-center py-12 px-6">
                <div className="h-24 w-24 bg-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                    <Check className="h-12 w-12 text-emerald-500" />
                </div>
                <h1 className="text-3xl font-black text-foreground mb-4 tracking-tight font-display">Agendamento Realizado!</h1>
                <p className="text-muted-foreground mb-10 max-w-xs mx-auto">Sua vaga está garantida. Te esperamos no horário marcado!</p>
                <Button onClick={() => navigate(`/${slug}/success`)} className="gold-gradient text-primary-foreground h-14 px-10 rounded-2xl font-black shadow-gold w-full max-w-xs mx-auto">Ver Resumo</Button>
            </div>
        )}

        {/* TELA FINAL: CANCELADO / RECUSADO */}
        {cancelled && (
            <div className="animate-in fade-in zoom-in-95 text-center py-12 px-6">
                <div className="h-24 w-24 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                    <XCircle className="h-12 w-12 text-red-500" />
                </div>
                <h1 className="text-3xl font-black text-foreground mb-4 tracking-tight font-display">Reserva Não Confirmada</h1>
                <p className="text-muted-foreground mb-10 max-w-xs mx-auto">
                  Houve um problema com a confirmação do seu pagamento ou o horário ficou indisponível.
                </p>
                
                <div className="space-y-4 max-w-sm mx-auto">
                    <Button 
                      onClick={() => window.open(`https://wa.me/55${shop.phone?.replace(/\D/g, "")}`, "_blank")} 
                      className="bg-[#25D366] hover:bg-[#20bd5a] text-white h-14 w-full rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <MessageCircle className="h-5 w-5" /> Falar com o Suporte
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => window.location.reload()} 
                      className="h-14 w-full rounded-2xl font-black border-border transition-all hover:bg-secondary active:scale-95"
                    >
                        Tentar Novamente
                    </Button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default PublicBooking;
