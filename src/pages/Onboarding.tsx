import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors, Loader2, ArrowRight, ArrowLeft, Clock, Plus, Trash2, Check, Users, AlertCircle } from "lucide-react";
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
  is_closed: i === 0, // Domingo fechado por padrão
}));

const defaultServices: ServiceDraft[] = [
  { name: "Corte Degradê", price: "50", duration: "40" },
  { name: "Barba Completa", price: "35", duration: "30" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { barbershop, loading: shopLoading, refetch } = useBarbershop();
  const { toast } = useToast();
  const isSubmitting = useRef(false);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultCommission, setDefaultCommission] = useState("30");
  const [hours, setHours] = useState<HourDraft[]>(defaultHours);
  const [services, setServices] = useState<ServiceDraft[]>(defaultServices);
  const [loading, setLoading] = useState(false);
  const [firstBarberName, setFirstBarberName] = useState("");

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
    if (services.length >= 15) return;
    setServices((prev) => [...prev, { name: "", price: "30", duration: "30" }]);
  };

  const removeService = (idx: number) => {
    if (services.length <= 1) return;
    setServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (isSubmitting.current || !user || !name.trim()) return;
    
    const validServices = services.filter((s) => s.name.trim());
    if (validServices.length === 0) {
      toast({ title: "Quase lá!", description: "Adicione pelo menos um serviço para continuar.", variant: "destructive" });
      return;
    }

    isSubmitting.current = true;
    setLoading(true);

    try {
      const finalSlug = slug.trim() || generateSlug(name);

      // Verificação de segurança: Slug duplicado
      const { data: existing } = await supabase
        .from("barbershops").select("id").eq("slug", finalSlug).maybeSingle();
      
      if (existing) {
        setStep(1);
        toast({ title: "URL Indisponível", description: "Este nome já está em uso. Tente outro.", variant: "destructive" });
        setLoading(false);
        isSubmitting.current = false;
        return;
      }

      // 1. Criar a Barbearia
      const { data: shop, error: shopError } = await supabase
        .from("barbershops")
        .insert({ 
          owner_id: user.id, 
          name: name.trim(), 
          slug: finalSlug, 
          phone: phone.trim(), 
          default_commission: parseFloat(defaultCommission) || 0, 
          setup_completed: true 
        })
        .select().single();

      if (shopError) throw shopError;

      // 2. Atualizar perfil do usuário
      await supabase.from("profiles").update({ barbershop_id: shop.id }).eq("user_id", user.id);

      // 3. Vincular Plano SaaS inicial
      await supabase.from("saas_plans").insert({ barbershop_id: shop.id, plan_name: "essential" });

      // 4. Inserir Horários (Bulk Insert)
      const hoursPayload = hours.map((h) => ({
        barbershop_id: shop.id,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      }));
      await supabase.from("business_hours").insert(hoursPayload);

      // 5. Inserir Serviços (Bulk Insert)
      const servicesPayload = validServices.map((s, i) => ({
        barbershop_id: shop.id,
        name: s.name.trim(),
        price: parseFloat(s.price) || 0,
        duration: parseInt(s.duration) || 30,
        sort_order: i,
      }));
      await supabase.from("services").insert(servicesPayload);

      // 6. Criar o primeiro Barbeiro (se informado)
      if (firstBarberName.trim()) {
        await supabase.from("barbers").insert({
          barbershop_id: shop.id,
          name: firstBarberName.trim(),
          commission_pct: parseFloat(defaultCommission) || 0,
        });
      }

      await refetch();
      toast({ title: "Sucesso!", description: "Sua barbearia está pronta para decolar." });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro na configuração", description: err.message || "Erro ao salvar dados.", variant: "destructive" });
      isSubmitting.current = false;
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || shopLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Preparando seu ambiente...</p>
      </div>
    );
  }

  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Header de Progresso */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gold-gradient shadow-lg">
            <Scissors className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Configuração Inicial</h1>
          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 w-8 rounded-full transition-all duration-500 ${i < step ? "gold-gradient" : "bg-muted"}`} 
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 uppercase tracking-[0.2em]">
            Passo {step} de {totalSteps}
          </p>
        </div>

        <div className="bg-card border border-border p-6 sm:p-8 rounded-2xl shadow-xl">
          {/* Passo 1: Identidade */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da sua Barbearia</label>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Barber Shop Premium"
                  className="h-12"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL de Agendamento</label>
                <div className="flex items-center rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <span className="pl-3 text-xs font-mono text-muted-foreground">app/</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                    className="flex-1 bg-transparent border-none p-3 text-sm outline-none"
                    placeholder="nome-da-barbearia"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Este será o link que você enviará para seus clientes.</p>
              </div>
              <Button
                onClick={() => setStep(2)}
                disabled={!name.trim() || !slug.trim()}
                className="w-full gold-gradient text-primary-foreground font-bold h-12"
              >
                Próximo Passo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Passo 2: Horários */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold font-display">Quando você abre?</h2>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {hours.map((h, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${h.is_closed ? "bg-muted/30 border-dashed" : "bg-background border-border"}`}>
                    <span className="text-sm font-bold w-12">{DAYS[i].slice(0, 3)}</span>
                    <div className="flex items-center gap-2">
                      {!h.is_closed ? (
                        <div className="flex items-center gap-1">
                          <input type="time" value={h.open_time} onChange={(e) => updateHour(i, "open_time", e.target.value)} className="bg-secondary text-xs p-1 rounded border" />
                          <span className="text-[10px] text-muted-foreground">às</span>
                          <input type="time" value={h.close_time} onChange={(e) => updateHour(i, "close_time", e.target.value)} className="bg-secondary text-xs p-1 rounded border" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Fechado o dia todo</span>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => updateHour(i, "is_closed", !h.is_closed)}
                        className={`text-[10px] h-7 ${h.is_closed ? "text-primary" : "text-destructive"}`}
                      >
                        {h.is_closed ? "Abrir" : "Fechar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="h-12 font-semibold">Voltar</Button>
                <Button onClick={() => setStep(3)} className="gold-gradient text-primary-foreground font-bold h-12">Continuar</Button>
              </div>
            </div>
          )}

          {/* Passo 3: Equipe */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold font-display">Quem é o Barbeiro?</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Barbeiro Principal</label>
                  <Input
                    value={firstBarberName}
                    onChange={(e) => setFirstBarberName(e.target.value)}
                    placeholder="Pode ser o seu próprio nome"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Comissão Padrão (%)</label>
                  <Input
                    type="number"
                    value={defaultCommission}
                    onChange={(e) => setDefaultCommission(e.target.value)}
                    className="h-12"
                  />
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Você pode ajustar isso por serviço depois.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="h-12 font-semibold">Voltar</Button>
                <Button onClick={() => setStep(4)} className="gold-gradient text-primary-foreground font-bold h-12">Continuar</Button>
              </div>
            </div>
          )}

          {/* Passo 4: Serviços */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold font-display">Serviços e Preços</h2>
                <Button variant="outline" size="sm" onClick={addService} className="h-8 text-xs border-primary text-primary hover:bg-primary/10">
                  <Plus className="h-3 w-3 mr-1" /> Novo
                </Button>
              </div>
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
                {services.map((s, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 relative group">
                    <Input
                      value={s.name}
                      onChange={(e) => updateService(i, "name", e.target.value)}
                      placeholder="Nome do serviço"
                      className="bg-background h-10 font-medium"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          value={s.price}
                          onChange={(e) => updateService(i, "price", e.target.value)}
                          className="pl-8 h-9 text-xs"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">min</span>
                        <Input
                          type="number"
                          value={s.duration}
                          onChange={(e) => updateService(i, "duration", e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                    {services.length > 1 && (
                      <button 
                        onClick={() => removeService(i)} 
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-6">
                <Button variant="outline" onClick={() => setStep(3)} className="h-12 font-semibold">Voltar</Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="gold-gradient text-primary-foreground font-bold h-12"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="mr-2 h-5 w-5" /> Finalizar</>}
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <p className="text-center text-[10px] text-muted-foreground mt-8 uppercase tracking-widest">
          Ambiente Seguro &bull; Configuração Rápida
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
