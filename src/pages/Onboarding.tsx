import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Scissors, Loader2, ArrowRight, ArrowLeft, Clock, 
  Plus, Trash2, Check, Users, AlertCircle, Building2, Globe, Sparkles 
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// ID da barbearia criada no Step 1 (persistido no estado do componente)
// Usado para atualizar nos Steps 2, 3 e 4

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, isBarber } = useAuth();
  const { barbershop, loading: shopLoading } = useBarbershop() as any;
  const { toast } = useToast();

  // --- ESTADOS DO FORMULÁRIO ---
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultCommission, setDefaultCommission] = useState("30");
  const [hours, setHours] = useState(
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      open_time: "09:00",
      close_time: "19:00",
      is_closed: i === 0,
    })),
  );
  const [services, setServices] = useState([
    { name: "Corte Degradê", price: "50", duration: "40" },
  ]);
  const [firstBarberName, setFirstBarberName] = useState("");
  // ID da barbearia criada no Step 1 — usado para update nos Steps 2, 3 e 4
  const [createdBarbershopId, setCreatedBarbershopId] = useState<string | null>(null);

  // --- REDIRECIONAMENTO DE SEGURANÇA ---
  useEffect(() => {
    if (authLoading || shopLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    // Barbeiros NUNCA devem ver o Onboarding
    if (isBarber) {
      navigate("/barber/dashboard", { replace: true });
      return;
    }
    if (barbershop?.setup_completed) {
      navigate("/dashboard", { replace: true });
      return;
    }
  }, [user, isBarber, barbershop, authLoading, shopLoading, navigate]);

  // --- MUTAÇÃO STEP 1: CRIAR BARBEARIA (ANTI-GHOST) ---
  // Cria o registro antecipadamente com setup_completed: false
  // Evita "lojas fantasma" se o usuário desistir no meio do onboarding
  const createBarbershopMutation = useMutation({
    mutationFn: async () => {
      const finalSlug =
        slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const { data: shop, error: shopError } = await supabase
        .from("barbershops")
        .upsert(
          {
            owner_id: user?.id,
            name: name.trim(),
            slug: finalSlug,
            setup_completed: false,
          },
          { onConflict: "owner_id" },
        )
        .select()
        .single();

      if (shopError) {
        if (shopError.message.includes("slug"))
          throw new Error("Esta URL já está em uso por outra barbearia.");
        throw shopError;
      }

      // Vincula o perfil do usuário à barbearia
      await supabase
        .from("profiles")
        .update({ barbershop_id: shop.id })
        .eq("user_id", user?.id);

      // --- CONCESSÃO AUTOMÁTICA DO TRIAL PRO (30 DIAS) ---
      if (!shop.trial_used) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabase
          .from("saas_plans")
          .upsert(
            {
              barbershop_id: shop.id,
              plan_name: "pro",
              status: "active",
              expires_at: expiresAt.toISOString(),
            },
            { onConflict: "barbershop_id" }
          );

        await supabase
          .from("barbershops")
          .update({ trial_used: true })
          .eq("id", shop.id);
      }

      return shop;
    },
    onSuccess: (shop) => {
      setCreatedBarbershopId(shop.id);
      setStep(2);
    },
    onError: (err: any) => {
      toast({
        title: "Falha ao criar barbearia",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // --- MUTAÇÃO STEP 4: FINALIZAR ECOSSISTEMA DA BARBEARIA ---
  // Atualiza a barbearia existente (criada no Step 1) com todos os dados
  // Marca setup_completed: true apenas no final
  const createMutation = useMutation({
    mutationFn: async () => {
      const shopId = createdBarbershopId;
      if (!shopId) throw new Error("Barbearia não foi criada. Reinicie o processo.");

      // 1. Atualizar Barbearia com dados restantes e marcar como completa
      const { data: shop, error: shopError } = await supabase
        .from("barbershops")
        .update({
          phone: phone.trim(),
          default_commission: parseFloat(defaultCommission) || 0,
          setup_completed: true,
        })
        .eq("id", shopId)
        .select()
        .single();

      if (shopError) throw shopError;

      // 2. Operações Paralelas (Performance Industrial)
      const operations: Promise<any>[] = [
        (supabase
          .from("business_hours")
          .insert(hours.map((h) => ({ ...h, barbershop_id: shop.id }))) as unknown as Promise<any>),
        (supabase.from("services").insert(
          services
            .filter((s) => s.name.trim())
            .map((s, i) => ({
              barbershop_id: shop.id,
              name: s.name.trim(),
              price: parseFloat(s.price) || 0,
              duration: parseInt(s.duration) || 30,
              sort_order: i,
            })),
        ) as unknown as Promise<any>),
      ];

      await Promise.all(operations);

      // 4. Primeiro Profissional
      if (firstBarberName.trim()) {
        await supabase.from("barbers").insert({
          barbershop_id: shop.id,
          name: firstBarberName.trim(),
          commission_pct: parseFloat(defaultCommission) || 0,
        });
      }

      return shop;
    },
    onSuccess: () => {
      // Invalida o cache para que o hook useBarbershop carregue a nova loja na hora
      queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
      toast({
        title: "Boas-vindas ao time!",
        description: "Sua barbearia foi configurada com sucesso.",
      });
      navigate("/dashboard", { replace: true });
    },
    onError: (err: any) => {
      toast({
        title: "Falha na configuração",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const generateSlug = (val: string) =>
    val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  if (authLoading || shopLoading)
    return (
      <div className="min-h-screen bg-[#0b1224] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] animate-pulse">
          Sincronizando Ambiente...
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0b1224] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* BACKGROUND ELEMENTS */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full -z-10" />

      <div className="w-full max-w-xl">
        {/* PROGRESS INDICATOR */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-6 relative group inline-block">
            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
            <div className="relative h-20 w-20 flex items-center justify-center rounded-[2rem] bg-slate-900 border border-slate-800 shadow-2xl">
              <Scissors className="h-10 w-10 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-4">
            Seja bem-vindo!
          </h1>

          <div className="flex items-center justify-center gap-2 max-w-[200px] mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "bg-slate-800"}`}
              />
            ))}
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-6">
            Etapa {step} de 4
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl relative">
          {/* STEP 1: IDENTIDADE */}
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Building2 className="h-3 w-3" /> Nome do seu Negócio
                </label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(generateSlug(e.target.value));
                  }}
                  placeholder="Ex: Barber Shop Premium"
                  className="bg-slate-950 border-slate-800 h-14 text-white text-lg font-bold focus-visible:ring-cyan-500/50"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Globe className="h-3 w-3" /> Sua URL Exclusiva
                </label>
                <div className="flex items-center rounded-2xl border border-slate-800 bg-slate-950 px-4 focus-within:ring-2 focus-within:ring-cyan-500/50 transition-all">
                  <span className="text-xs font-mono text-slate-600">
                    agende.online/
                  </span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                    className="flex-1 bg-transparent border-none py-4 px-1 text-sm text-cyan-400 font-bold outline-none"
                    placeholder="nome-da-barbearia"
                  />
                </div>
              </div>
              <Button
                onClick={() => createBarbershopMutation.mutate()}
                disabled={!name.trim() || !slug.trim() || createBarbershopMutation.isPending}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-cyan-900/20 active:scale-95 transition-all"
              >
                {createBarbershopMutation.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Criando...</>
                ) : (
                  <>Próximo Passo <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </div>
          )}

          {/* STEP 2: HORÁRIOS */}
          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-6">
                <Clock className="h-6 w-6 text-cyan-400" />
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Horários de Funcionamento
                </h2>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {hours.map((h, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${h.is_closed ? "bg-slate-950/40 border-slate-900 opacity-50" : "bg-slate-950 border-slate-800"}`}
                  >
                    <span className="text-xs font-black text-slate-400 w-12 uppercase">
                      {DAYS[i].slice(0, 3)}
                    </span>
                    {!h.is_closed ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={h.open_time}
                          onChange={(e) =>
                            setHours((prev) =>
                              prev.map((item, idx) =>
                                idx === i
                                  ? { ...item, open_time: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="bg-slate-900 text-xs p-2 rounded-lg border border-slate-800 text-white"
                        />
                        <span className="text-[10px] font-bold text-slate-700">
                          ATÉ
                        </span>
                        <input
                          type="time"
                          value={h.close_time}
                          onChange={(e) =>
                            setHours((prev) =>
                              prev.map((item, idx) =>
                                idx === i
                                  ? { ...item, close_time: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="bg-slate-900 text-xs p-2 rounded-lg border border-slate-800 text-white"
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                        Fechado para descanso
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setHours((prev) =>
                          prev.map((item, idx) =>
                            idx === i
                              ? { ...item, is_closed: !item.is_closed }
                              : item,
                          ),
                        )
                      }
                      className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border ${h.is_closed ? "border-cyan-500/30 text-cyan-400" : "border-red-500/30 text-red-500"}`}
                    >
                      {h.is_closed ? "Abrir" : "Fechar"}
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="h-14 text-slate-500 font-bold rounded-2xl"
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-xl shadow-cyan-900/20"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: TIME E REGRAS */}
          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-6 w-6 text-cyan-400" />
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Time de Especialistas
                </h2>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Nome do Barbeiro Principal
                  </label>
                  <Input
                    value={firstBarberName}
                    onChange={(e) => setFirstBarberName(e.target.value)}
                    placeholder="Ex: Roberto 'The Barber'"
                    className="bg-slate-950 border-slate-800 h-14 text-white focus-visible:ring-cyan-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Comissão Padrão (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={defaultCommission}
                      onChange={(e) => setDefaultCommission(e.target.value)}
                      className="bg-slate-950 border-slate-800 h-14 text-white focus-visible:ring-cyan-500/50 pr-12 font-mono"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-600">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium italic flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" /> Isso pode ser alterado
                    por profissional depois.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="h-14 text-slate-500 font-bold rounded-2xl"
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  className="h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-xl shadow-cyan-900/20"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: SERVIÇOS */}
          {step === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Produtos & Serviços
                </h2>
                <Button
                  variant="outline"
                  onClick={() =>
                    setServices((prev) => [
                      ...prev,
                      { name: "", price: "30", duration: "30" },
                    ])
                  }
                  className="h-9 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/5 rounded-xl font-bold"
                >
                  <Plus className="h-4 w-4 mr-2" /> Novo
                </Button>
              </div>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {services.map((s, i) => (
                  <div
                    key={i}
                    className="group relative p-4 rounded-2xl border border-slate-800 bg-slate-950/50 space-y-4 hover:border-slate-700 transition-all"
                  >
                    <Input
                      value={s.name}
                      onChange={(e) =>
                        setServices((prev) =>
                          prev.map((item, idx) =>
                            idx === i
                              ? { ...item, name: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Nome do serviço"
                      className="bg-transparent border-none p-0 h-auto text-white font-bold text-lg placeholder:text-slate-800 focus-visible:ring-0"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                          Valor
                        </span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-xs">
                            R$
                          </span>
                          <Input
                            type="number"
                            value={s.price}
                            onChange={(e) =>
                              setServices((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? { ...item, price: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="bg-slate-900 border-slate-800 pl-9 h-10 text-xs text-white"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                          Tempo
                        </span>
                        <div className="relative">
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-[10px]">
                            MIN
                          </span>
                          <Input
                            type="number"
                            value={s.duration}
                            onChange={(e) =>
                              setServices((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? { ...item, duration: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="bg-slate-900 border-slate-800 h-10 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                    {services.length > 1 && (
                      <button
                        onClick={() =>
                          setServices((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <Button
                  variant="ghost"
                  onClick={() => setStep(3)}
                  className="h-14 text-slate-500 font-bold rounded-2xl"
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !name.trim()}
                  className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" /> Finalizar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-10 font-bold uppercase tracking-[0.4em]">
          Ambiente Criptografado &bull; Guilherme Lara Ecosystem 2026
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
