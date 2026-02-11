import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors, Loader2, ArrowRight, ArrowLeft, Clock, Plus, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface ServiceDraft {
  name: string;
  price: string;
  duration: string;
}

interface HourDraft {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const defaultHours: HourDraft[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  open_time: "09:00",
  close_time: "19:00",
  is_closed: i === 0, // Sunday closed
}));

const defaultServices: ServiceDraft[] = [
  { name: "Corte Degradê", price: "50", duration: "40" },
  { name: "Barba Completa", price: "35", duration: "30" },
  { name: "Corte + Barba", price: "75", duration: "60" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { barbershop, loading: shopLoading, refetch } = useBarbershop();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState<HourDraft[]>(defaultHours);
  const [services, setServices] = useState<ServiceDraft[]>(defaultServices);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || shopLoading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    if (barbershop) { navigate("/dashboard", { replace: true }); return; }
  }, [user, barbershop, authLoading, shopLoading, navigate]);

  const generateSlug = (val: string) =>
    val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(generateSlug(val));
  };

  const updateHour = (idx: number, field: keyof HourDraft, value: any) => {
    setHours((prev) => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  };

  const updateService = (idx: number, field: keyof ServiceDraft, value: string) => {
    setServices((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addService = () => {
    if (services.length >= 10) return;
    setServices((prev) => [...prev, { name: "", price: "30", duration: "30" }]);
  };

  const removeService = (idx: number) => {
    if (services.length <= 1) return;
    setServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!user || !name.trim() || !slug.trim()) return;
    const validServices = services.filter((s) => s.name.trim());
    if (validServices.length === 0) {
      toast({ title: "Erro", description: "Cadastre pelo menos 1 serviço.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const finalSlug = generateSlug(slug);

      const { data: existing } = await supabase
        .from("barbershops").select("id").eq("slug", finalSlug).maybeSingle();
      if (existing) {
        toast({ title: "Slug já em uso", description: "Escolha outro nome para a URL.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // 1. Create barbershop
      const { data: shop, error } = await supabase
        .from("barbershops")
        .insert({ owner_id: user.id, name: name.trim(), slug: finalSlug, phone: phone.trim() })
        .select().single();
      if (error) throw error;

      // 2. Link profile
      await supabase.from("profiles").update({ barbershop_id: shop.id }).eq("user_id", user.id);

      // 3. Create SaaS plan
      await supabase.from("saas_plans").insert({ barbershop_id: shop.id, plan_name: "essential" });

      // 4. Insert business hours
      const hoursPayload = hours.map((h) => ({
        barbershop_id: shop.id,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      }));
      await supabase.from("business_hours").insert(hoursPayload);

      // 5. Insert services
      const servicesPayload = validServices.map((s, i) => ({
        barbershop_id: shop.id,
        name: s.name.trim(),
        price: parseFloat(s.price) || 0,
        duration: parseInt(s.duration) || 30,
        sort_order: i,
      }));
      await supabase.from("services").insert(servicesPayload);

      await refetch();
      toast({ title: "Barbearia criada!", description: "Tudo configurado. Bem-vindo ao TechBarber." });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || shopLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalSteps = 3;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gold-gradient shadow-gold">
            <Scissors className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">Configure sua Barbearia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passo {step} de {totalSteps}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < step ? "gold-gradient" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic info */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Nome da Barbearia</label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Barbearia do Guilherme"
                className="bg-card border-border"
                required
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">URL do Agendamento</label>
              <div className="flex items-center rounded-md border border-border bg-card overflow-hidden">
                <span className="px-3 text-xs text-muted-foreground bg-secondary border-r border-border py-2.5">/book/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                  required
                  maxLength={60}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">WhatsApp (opcional)</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="bg-card border-border"
                maxLength={20}
              />
            </div>
            <Button
              onClick={() => setStep(2)}
              disabled={!name.trim() || !slug.trim()}
              className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90 py-6"
            >
              Próximo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Business Hours */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Horário de Funcionamento</h2>
            </div>
            <div className="space-y-2">
              {hours.map((h, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                    h.is_closed ? "border-border bg-secondary/50 opacity-60" : "border-border bg-card"
                  }`}
                >
                  <span className="text-sm font-medium w-16 shrink-0">{DAYS[i].slice(0, 3)}</span>
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={!h.is_closed}
                      onChange={(e) => updateHour(i, "is_closed", !e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-xs text-muted-foreground">Aberto</span>
                  </label>
                  {!h.is_closed && (
                    <div className="flex items-center gap-1 ml-auto">
                      <input
                        type="time"
                        value={h.open_time}
                        onChange={(e) => updateHour(i, "open_time", e.target.value)}
                        className="bg-secondary text-sm rounded px-2 py-1 border border-border"
                      />
                      <span className="text-xs text-muted-foreground">às</span>
                      <input
                        type="time"
                        value={h.close_time}
                        onChange={(e) => updateHour(i, "close_time", e.target.value)}
                        className="bg-secondary text-sm rounded px-2 py-1 border border-border"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Services */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg font-bold">Seus Serviços</h2>
              <Button variant="outline" size="sm" onClick={addService} disabled={services.length >= 10}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-3">
              {services.map((s, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Serviço {i + 1}</span>
                    {services.length > 1 && (
                      <button onClick={() => removeService(i)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Input
                    value={s.name}
                    onChange={(e) => updateService(i, "name", e.target.value)}
                    placeholder="Nome do serviço"
                    className="bg-secondary border-border"
                    maxLength={100}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Preço (R$)</label>
                      <Input
                        type="number"
                        value={s.price}
                        onChange={(e) => updateService(i, "price", e.target.value)}
                        className="bg-secondary border-border"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Duração (min)</label>
                      <Input
                        type="number"
                        value={s.duration}
                        onChange={(e) => updateService(i, "duration", e.target.value)}
                        className="bg-secondary border-border"
                        min="5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || services.filter((s) => s.name.trim()).length === 0}
                className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" /> Finalizar</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
