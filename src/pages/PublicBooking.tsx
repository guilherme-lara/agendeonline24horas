import { useState, useMemo, useEffect } from "react";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/Avatar";
import { useToast } from "@/hooks/use-toast";
import { format, addMinutes, isBefore, isToday, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BUFFER_MINUTES = 10;

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
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
  
  // --- ADICIONADO: ESTADO DE SUCESSO PARA CORRIGIR O ERRO ---
  const [success, setSuccess] = useState(false); 
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

  const { data: existingAppts = [] } = useQuery({
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

  // --- MUTAÇÃO ATUALIZADA ---
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
        setSignalPending(true);
      } else {
        setSuccess(true); // Ativa o estado de sucesso
        setStep(5); // Vai para a tela de conclusão
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: "Este horário já foi preenchido.", variant: "destructive" });
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

  return (
    <div className="min-h-screen bg-[#0b1224] text-white selection:bg-cyan-500/30 pb-20">
      <div className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-2xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                {shop.logo_url ? <img src={shop.logo_url} className="h-full w-full object-cover" /> : <Scissors className="text-cyan-400 h-6 w-6" />}
             </div>
             <div>
                <h2 className="font-black text-lg truncate leading-none mb-1">{shop.name}</h2>
                <p className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-tighter">
                   <MapPin className="h-3 w-3" /> {shop.address || "Endereço não informado"}
                </p>
             </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mt-8">
        {/* CORREÇÃO DO REFERENCE ERROR AQUI */}
        {!success && !signalPending && (
            <div className="flex gap-2 mb-10">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "bg-slate-800"}`} />
              ))}
            </div>
        )}

        {/* Steps 1 a 4 continuam aqui... */}
        {step === 1 && (
            <div className="grid gap-3">
               {shopResources?.services.map((s: any) => (
                 <button key={s.id} onClick={() => { setSelectedService(s); setStep(2); }} className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 text-left hover:border-cyan-500/40 transition-all">
                    <div className="flex justify-between items-center">
                        <p className="font-bold text-lg text-white">{s.name}</p>
                        <p className="text-xl font-black text-emerald-400">R$ {Number(s.price).toFixed(2)}</p>
                    </div>
                 </button>
               ))}
            </div>
        )}

        {/* ... (Demais steps conforme seu código original) */}

        {step === 5 && (
            <div className="text-center py-12">
                <div className="h-24 w-24 bg-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                    <Check className="h-12 w-12 text-emerald-500" />
                </div>
                <h1 className="text-3xl font-black text-white mb-4 tracking-tight">Agendamento Realizado!</h1>
                <p className="text-slate-500 mb-10 max-w-xs mx-auto">Tudo pronto para te receber. Um lembrete será enviado para o seu WhatsApp.</p>
                <Button onClick={() => window.location.href = "/"} className="gold-gradient h-14 px-10 rounded-2xl font-black shadow-xl">Voltar ao Início</Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default PublicBooking;
