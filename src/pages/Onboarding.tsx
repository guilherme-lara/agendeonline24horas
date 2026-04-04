import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Scissors, Loader2, ArrowRight, Clock, 
  Plus, Trash2, Users, Building2, Globe, Sparkles 
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// PONTO DE ATUALIZAÇÃO 1: Onboarding Refatorado
const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, isBarber } = useAuth();
  const { barbershop, loading: shopLoading } = useBarbershop() as any;
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hours, setHours] = useState(
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      open_time: "09:00",
      close_time: "19:00",
      is_closed: i === 0,
    })),
  );
  const [services, setServices] = useState([
    { name: "Corte Masculino", price: "50", duration: "40" },
    { name: "Barba Terapia", price: "40", duration: "30" },
  ]);
  const [firstBarberName, setFirstBarberName] = useState("");
  const [barbershopId, setBarbershopId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || shopLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (isBarber) {
      navigate("/barber/dashboard", { replace: true });
      return;
    }
    if (barbershop?.id) {
        // Se a barbearia já existe, pula para a próxima etapa ou dashboard
        setBarbershopId(barbershop.id);
        setName(barbershop.name || "");
        setSlug(barbershop.slug || "");
        if (barbershop.setup_completed) {
            navigate("/dashboard", { replace: true });
        } else {
            // Avança para a próxima etapa se a primeira já foi feita
            if(step === 1) setStep(2);
        }
    }
  }, [user, isBarber, barbershop, authLoading, shopLoading, navigate]);


  // Mutação ÚNICA para gerenciar a barbearia (criar e atualizar)
  const manageBarbershopMutation = useMutation({
    mutationFn: async (currentStep: number) => {
      if (currentStep === 1) {
        const finalSlug = slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const trialEndDate = addDays(new Date(), 30).toISOString();

        const { data: shop, error: shopError } = await supabase
          .from("barbershops")
          .upsert({
            owner_id: user?.id,
            name: name.trim(),
            slug: finalSlug,
            plan_name: 'pro',
            plan_status: 'trialing',
            trial_ends_at: trialEndDate,
            setup_completed: false,
          }, { onConflict: 'owner_id' })
          .select()
          .single();

        if (shopError) {
            if (shopError.message.includes("slug")) throw new Error("Esta URL já está em uso.");
            throw shopError;
        }
        
        await supabase.from("profiles").update({ barbershop_id: shop.id }).eq("user_id", user?.id);
        return { shop, nextStep: 2 };

      } else if (currentStep === 4) {
        if (!barbershopId) throw new Error("ID da barbearia não encontrado.");
        
        // Inserir horários, serviços e o primeiro barbeiro
        await Promise.all([
            supabase.from("business_hours").delete().eq('barbershop_id', barbershopId), // Limpa horários antigos
            supabase.from("services").delete().eq('barbershop_id', barbershopId) // Limpa serviços antigos
        ]);

        await Promise.all([
            supabase.from("business_hours").insert(hours.map((h) => ({ ...h, barbershop_id: barbershopId }))),
            supabase.from("services").insert(services.filter(s => s.name.trim()).map((s, i) => ({
                barbershop_id: barbershopId,
                name: s.name.trim(),
                price: parseFloat(s.price) || 0,
                duration: parseInt(s.duration) || 30,
                sort_order: i,
                requires_advance_payment: true
            }))),
            firstBarberName.trim() && supabase.from("barbers").insert({
                barbershop_id: barbershopId,
                name: firstBarberName.trim(),
            })
        ]);

        // Marcar setup como completo
        const { data: finalShop } = await supabase.from("barbershops").update({ setup_completed: true }).eq("id", barbershopId).select().single();
        return { shop: finalShop };
      }
      return { nextStep: currentStep + 1 }; // Apenas avança o passo
    },
    onSuccess: (data) => {
        if (data?.shop) {
            setBarbershopId(data.shop.id);
            queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
        }
        if (data?.nextStep) {
            setStep(data.nextStep);
        } else {
             toast({
                title: "Boas-vindas ao time!",
                description: "Sua barbearia foi configurada. Aproveite seus 30 dias de Plano PRO!",
                variant: "success",
             });
             navigate("/dashboard", { replace: true });
        }
    },
    onError: (err: any) => {
      toast({ title: "Erro no Onboarding", description: err.message, variant: "destructive" });
    },
  });

  const generateSlug = (val: string) =>
    val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (authLoading || (shopLoading && !barbershop?.id)) return <div className="min-h-screen bg-[#0b1224] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>;

  return (
    <div className="min-h-screen bg-[#0b1224] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
          <div className="text-center mb-10">
              <div className="mx-auto mb-6"><Scissors className="h-12 w-12 text-cyan-400 mx-auto" /></div>
              <h1 className="text-4xl font-black text-white tracking-tight mb-4">Seja bem-vindo!</h1>
              <div className="flex items-center justify-center gap-2 max-w-[200px] mx-auto">
                  {[1, 2, 3, 4].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-cyan-500" : "bg-slate-800"}`} />)}
              </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl">
              {step === 1 && (
                  <div className="space-y-6">
                      <div>
                          <label className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-2"><Building2 className="h-4 w-4" /> Nome do seu Negócio</label>
                          <Input value={name} onChange={e => { setName(e.target.value); setSlug(generateSlug(e.target.value)); }} placeholder="Ex: Barber Shop Premium" autoFocus />
                      </div>
                      <div>
                          <label className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-2"><Globe className="h-4 w-4" /> Sua URL Exclusiva</label>
                          <div className="flex items-center"><span className="text-sm text-slate-500 mr-1">agende.online/</span><Input value={slug} onChange={e => setSlug(generateSlug(e.target.value))} placeholder="sua-barbearia" /></div>
                      </div>
                      <Button onClick={() => manageBarbershopMutation.mutate(1)} disabled={!name.trim() || !slug.trim() || manageBarbershopMutation.isPending}>{manageBarbershopMutation.isPending && step === 1 ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/> Criando...</> : <>Próximo Passo <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
                  </div>
              )}

              {step === 2 && (
                  <div>
                      <h2 className="text-xl font-bold text-white mb-4">Horários de Funcionamento</h2>
                      <div className="space-y-2">
                          {hours.map((h, i) => (
                              <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${h.is_closed ? "bg-slate-800/50" : "bg-slate-800"}`}>
                                  <span className="font-bold text-white">{DAYS[i]}</span>
                                  {h.is_closed ? <span className="text-sm text-slate-400">Fechado</span> : <div className="flex items-center gap-2"><Input type="time" value={h.open_time} onChange={e => setHours(prev => prev.map((item, idx) => idx === i ? { ...item, open_time: e.target.value } : item))} className="w-24"/><span className="text-slate-400">-</span><Input type="time" value={h.close_time} onChange={e => setHours(prev => prev.map((item, idx) => idx === i ? { ...item, close_time: e.target.value } : item))} className="w-24"/></div>}
                                  <Button variant="ghost" size="sm" onClick={() => setHours(prev => prev.map((item, idx) => idx === i ? { ...item, is_closed: !item.is_closed } : item))}>{h.is_closed ? "Abrir" : "Fechar"}</Button>
                              </div>
                          ))}
                      </div>
                      <div className="flex justify-end mt-4"><Button onClick={() => setStep(3)}>Continuar</Button></div>
                  </div>
              )}

              {step === 3 && (
                  <div>
                      <h2 className="text-xl font-bold text-white mb-4">Time de Especialistas</h2>
                      <div>
                          <label className="text-sm font-bold text-slate-400 mb-2">Nome do Barbeiro Principal</label>
                          <Input value={firstBarberName} onChange={e => setFirstBarberName(e.target.value)} placeholder="Ex: Roberto 'The Barber'" />
                      </div>
                      <div className="flex justify-end mt-4"><Button onClick={() => setStep(4)}>Continuar</Button></div>
                  </div>
              )}

              {step === 4 && (
                  <div>
                      <div className="flex justify-between items-center mb-4">
                          <h2 className="text-xl font-bold text-white">Produtos & Serviços</h2>
                          <Button variant="outline" onClick={() => setServices(prev => [...prev, { name: "", price: "30", duration: "30" }])}><Plus className="h-4 w-4 mr-2"/>Novo</Button>
                      </div>
                      <div className="space-y-2">
                          {services.map((s, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800">
                                  <Input value={s.name} onChange={e => setServices(prev => prev.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item))} placeholder="Nome do serviço" className="flex-grow"/>
                                  <Input type="number" value={s.price} onChange={e => setServices(prev => prev.map((item, idx) => idx === i ? { ...item, price: e.target.value } : item))} placeholder="Preço" className="w-24"/>
                                  <Input type="number" value={s.duration} onChange={e => setServices(prev => prev.map((item, idx) => idx === i ? { ...item, duration: e.target.value } : item))} placeholder="Duração" className="w-24"/>
                                  <Button variant="destructive" size="sm" onClick={() => setServices(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4"/></Button>
                              </div>
                          ))}
                      </div>
                      <div className="flex justify-end mt-4">
                        <Button onClick={() => manageBarbershopMutation.mutate(4)} disabled={manageBarbershopMutation.isPending}>{manageBarbershopMutation.isPending && step === 4 ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Sparkles className="mr-2 h-4 w-4" />Finalizar</>}</Button>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Onboarding;
