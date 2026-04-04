import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { 
  Scissors, Loader2, Check, AlertTriangle, CalendarDays,
  MapPin, ArrowLeft, XCircle, QrCode, Banknote, ShieldCheck, CreditCard, WifiOff
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

  // --- ESTADOS DE NAVEGAÇÃO ---
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientData, setClientData] = useState({ name: "", phone: "" });
  
  // Captura o retorno da InfinitePay
  const [success, setSuccess] = useState(searchParams.get("success") === "true"); 
  const [cancelled, setCancelled] = useState(false);

  // --- QUERIES ---
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
    refetchInterval: 5000,
  });
  
  // PONTO 1: VALIDAÇÃO DE PAGAMENTOS
  const isPaymentConfigured = !!shop?.settings?.infinitepay_tag;

  // --- MOTOR DE CHECKOUT SEM CORS ---
  const bookingMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(selectedDate!);
      const [h, m] = selectedTime!.split(":").map(Number);
      scheduledAt.setHours(h, m, 0, 0);

      const amountToCharge = (selectedService.advance_payment_value && selectedService.advance_payment_value > 0)
        ? selectedService.advance_payment_value
        : selectedService.price;

      // 1. Cria o agendamento no Supabase COM STATUS PENDENTE
      const { data: apptResponse, error: rpcError } = await supabase.rpc("create_public_appointment", {
        _barbershop_id: shop!.id,
        _client_name: clientData.name.trim(),
        _client_phone: clientData.phone.trim(),
        _service_name: selectedService.name,
        _price: selectedService.price,
        _scheduled_at: scheduledAt.toISOString(),
        _payment_method: "pix" // PONTO 1: Pagamento sempre online
      });

      if (rpcError) throw rpcError;

      const apptId = typeof apptResponse === 'object' ? apptResponse?.id : apptResponse;
      if (!apptId) throw new Error("Falha ao recuperar o ID do agendamento.");

      // 2. Trava a vaga na agenda com status pendente
      await supabase.from("appointments").update({ 
        barber_name: selectedBarber.name,
        status: 'pendente_pagamento', // PONTO 1: Status inicial é sempre pendente
        has_signal: (selectedService.advance_payment_value || 0) > 0,
        signal_value: selectedService.advance_payment_value || 0
      }).eq("id", apptId);

      // 3. MÁGICA: Redirecionamento Direto para InfinitePay
      const infiniteTag = shop?.settings?.infinitepay_tag;
      if (!infiniteTag) throw new Error("Esta barbearia não está configurada para receber pagamentos online.");

      const cleanHandle = infiniteTag.replace(/[@$ ]/g, '');
      const itemName = ((selectedService.advance_payment_value || 0) > 0) ? `Sinal: ${selectedService.name}` : selectedService.name;
      const priceInCents = Math.round(amountToCharge * 100); 

      if (priceInCents < 100) {
        throw new Error("O valor do serviço deve ser de no mínimo R$ 1,00 para pagamento online.");
      }

      const items = JSON.stringify([
        {
          name: itemName,
          price: priceInCents,
          quantity: 1
        }
      ]);

      const redirectUrl = `https://${window.location.host}/agendamentos/${slug}?success=true`;

      const checkoutUrl = `https://checkout.infinitepay.io/${cleanHandle}?items=${encodeURIComponent(items)}&order_nsu=${apptId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

      return { url: checkoutUrl };
    },
    onSuccess: (res) => {
      if (res.url) {
        // Redireciona o usuário para o checkout
        window.location.href = res.url; 
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Falha na cobrança", 
        description: error.message || "Erro desconhecido. Tente novamente.", 
        variant: "destructive" 
      });
      setStep(3);
      setSelectedTime(null);
      queryClient.invalidateQueries({ queryKey: ["slots"] });
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
          if (appt.status === 'cancelled' || appt.status === 'pendente_pagamento') return false;
          const aStart = new Date(appt.scheduled_at);
          const aEnd = addMinutes(aStart, 40); // Considerando duração fixa de 40min para conflito
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
      {/* HEADER */}
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

        {/* PONTO 1: BLOQUEIO SE PAGAMENTO NÃO ESTIVER CONFIGURADO */}
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
            {/* STEP INDICATOR */}
            <div className="flex gap-2 mb-10">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? "gold-gradient shadow-gold" : "bg-secondary"}`} />
              ))}
            </div>

            {/* STEP 1: SERVIÇOS */}
            {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h3 className="text-2xl font-black mb-1 tracking-tight text-foreground font-display">Qual serviço você deseja?</h3>
                    <p className="text-sm text-muted-foreground mb-8 font-medium">O pagamento do sinal ou valor total é obrigatório.</p>
                    <div className="grid gap-3">
                        {shopResources?.services.map((s: any) => (
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

            {/* STEP 2: BARBEIRO */}
            {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-2xl font-black mb-8 text-foreground font-display">Quem vai te atender?</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {shopResources?.barbers.map((b: any) => (
                            <button key={b.id} onClick={() => { setSelectedBarber(b); setStep(3); }} className="group rounded-3xl border border-border bg-card p-6 text-center hover:border-primary/40 transition-all">
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
            {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-2xl font-black mb-8 text-foreground font-display">Data e Horário</h3>
                    <div className="bg-card border border-border rounded-3xl p-4 mb-8 flex justify-center shadow-card">
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

            {/* STEP 4: DADOS DO CLIENTE E PAGAMENTO */}
            {step === 4 && (
                <div className="animate-in fade-in zoom-in-95">
                    <h3 className="text-2xl font-black mb-8 text-foreground text-center tracking-tight font-display">Finalize seu Agendamento</h3>
                    
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-card space-y-6">
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
          <div /> // Fallback para success/cancelled
        )}

        {/* TELA FINAL: SUCESSO */}
        {success && !cancelled && (
            <div className="animate-in fade-in zoom-in-95 text-center py-12 px-6 max-w-md mx-auto">
                <div className="h-24 w-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20">
                    <Check className="h-12 w-12 text-emerald-500" />
                </div>
                <h1 className="text-3xl font-black text-foreground mb-4 tracking-tight font-display">Agendamento Confirmado!</h1>
                <p className="text-muted-foreground mb-8 max-w-xs mx-auto">Seu pagamento foi aprovado. A sua vaga está garantida e te esperamos no horário marcado.</p>

                 <div className="flex flex-col gap-3 mb-6">
                  {selectedDate && selectedTime && selectedService && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const start = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`);
                        const end = addMinutes(start, selectedService.duration || 30);
                        const title = encodeURIComponent(`${selectedService.name}${shop?.name ? ` - ${shop.name}` : ''}`);
                        const dates = `${format(start, "yyyyMMdd'T'HHmmss")}/${format(end, "yyyyMMdd'T'HHmmss")}`;
                        const location = encodeURIComponent(shop?.address || '');
                        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&location=${location}`, '_blank');
                      }}
                      className="h-14 rounded-2xl font-bold border-border text-foreground hover:bg-secondary gap-2"
                    >
                      <CalendarDays className="h-5 w-5" /> Adicionar ao Google Agenda
                    </Button>
                  )}
                  
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
