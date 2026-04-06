import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Scissors, Loader2, ArrowRight, Building2, Globe, Sparkles
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, isBarber } = useAuth();
  const { barbershop, loading: shopLoading } = useBarbershop() as any;
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  // Ref para garantir acesso imediato ao ID recém-criado
  const barbershopIdRef = useRef<string | null>(null);

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
      barbershopIdRef.current = barbershop.id;
      setBarbershopId(barbershop.id);
      setName(barbershop.name || "");
      setSlug(barbershop.slug || "");
      if (barbershop.setup_completed) {
        navigate("/dashboard", { replace: true });
      } else {
        setStep(2);
      }
    }
  }, [user, isBarber, barbershop, authLoading, shopLoading, navigate]);

  const SEED_HOURS = [
    { day_of_week: 0, open_time: "09:00", close_time: "09:00", is_closed: true },
    { day_of_week: 1, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 2, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 3, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 4, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 5, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 6, open_time: "09:00", close_time: "14:00", is_closed: false },
  ];

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

      } else if (currentStep === 2) {
        const bId = barbershopIdRef.current;
        if (!bId) throw new Error("ID da barbearia não encontrado.");

        // Seed default business hours (batch insert)
        const { error: hoursError } = await supabase
          .from("business_hours")
          .upsert(
            SEED_HOURS.map((h) => ({ ...h, barbershop_id: bId })),
            { onConflict: "barbershop_id, day_of_week" }
          );

        if (hoursError) throw new Error(`Erro ao configurar horários: ${hoursError.message}`);

        await supabase.from("barbershops").update({ setup_completed: true }).eq("id", bId);
        return { finalize: true };
      }

      return { nextStep: currentStep + 1 };
    },
    onSuccess: (data) => {
      if (data?.shop) {
        barbershopIdRef.current = data.shop.id;
        setBarbershopId(data.shop.id);
        queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
      }
      if (data?.finalize) {
        toast({
          title: "Boas-vindas ao time!",
          description: "Sua barbearia foi configurada. Aproveite seus 30 dias de Plano PRO!",
        });
        queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
        navigate("/dashboard", { replace: true });
      } else if (data?.nextStep) {
        setStep(data.nextStep);
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
          <div className="flex items-center justify-center gap-2 max-w-[140px] mx-auto">
            {[1, 2].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-cyan-500" : "bg-slate-800"}`} />)}
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
              <Button onClick={() => manageBarbershopMutation.mutate(1)} disabled={!name.trim() || !slug.trim() || manageBarbershopMutation.isPending}>{manageBarbershopMutation.isPending && step === 1 ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/> Criando...</> : <>Próximo <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center">
              <h2 className="text-xl font-bold text-white">Tudo pronto para começar?</h2>
              <p className="text-slate-400 text-sm">
                Sua barbearia <strong className="text-white">{name}</strong> está configurada com horários padrão (Seg-Sex: 09-18h, Sáb: 09-14h).
                Você poderá ajustar serviços, equipe e horários dentro do Dashboard.
              </p>
              <Button onClick={() => manageBarbershopMutation.mutate(2)} disabled={manageBarbershopMutation.isPending} className="w-full">
                {manageBarbershopMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/> Finalizando...</> : <><Sparkles className="mr-2 h-4 w-4" />Finalizar e Ir ao Dashboard</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
