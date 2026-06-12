import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Phone,
  Plus,
  Trash2,
  Camera,
  Stethoscope,
  Clock,
  CircleDollarSign,
  CheckCircle2,
  Rocket,
  Info,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";

/* ─────────────────────────── Máscaras utilitárias ─────────────────────────── */
const onlyDigits = (value: string) => value.replace(/\D/g, "");

const applyPhoneMask = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, "($1");
  if (d.length <= 7) return d.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

const applyCnpjMask = (value: string) => {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const applyCurrencyMask = (value: string) => {
  const d = onlyDigits(value);
  if (!d) return "";
  const number = Number(d) / 100;
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

// Converte máscara monetária -> número (ex: "R$ 50,00" -> 50)
const currencyToNumber = (value: string) => Number(onlyDigits(value)) / 100;

const generateSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ─────────────────────────── Schema de validação ─────────────────────────── */
const DURATION_OPTIONS = ["15", "30", "45", "60"];

const onboardingSchema = z.object({
  step1: z.object({
    name: z.string().trim().min(3, "Nome deve ter no mínimo 3 caracteres").max(120),
    cnpj: z
      .string()
      .refine((val) => onlyDigits(val).length === 14, "CNPJ inválido (14 dígitos)"),
    phone: z
      .string()
      .refine((val) => onlyDigits(val).length === 11, "Telefone inválido — (XX) XXXXX-XXXX"),
  }),
  step2: z.object({
    services: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Informe o nome do serviço").max(80),
          duration: z.string().refine((v) => DURATION_OPTIONS.includes(v), "Selecione a duração"),
          price: z.string().refine((v) => currencyToNumber(v) > 0, "Informe um preço válido"),
        }),
      )
      .min(1, "Cadastre pelo menos 1 serviço"),
  }),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const STEP_TITLES = [
  "Bem-vindo! Vamos dar vida à sua clínica.",
  "O que você oferece de melhor?",
  "Tudo pronto para decolar!",
];
const STEP_SUBTITLES = [
  "Precisamos de alguns dados básicos para o seu perfil público e emissão de recibos.",
  "Cadastre pelo menos um serviço para que seus clientes já possam começar a agendar.",
  "Confira o resumo abaixo. Ao confirmar, criaremos o seu painel de controle.",
];

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, isProfessional } = useAuth();
  const { clinic, loading: shopLoading } = useClinic();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const logoPreviewRef = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      step1: { name: "", cnpj: "", phone: "" },
      step2: { services: [{ name: "", duration: "30", price: "" }] },
    },
    mode: "onChange",
  });

  const { fields: serviceFields, append, remove } = useFieldArray({
    control: form.control,
    name: "step2.services",
  });

  useEffect(() => {
    if (authLoading || shopLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (isProfessional) {
      navigate("/barber/dashboard", { replace: true });
      return;
    }
    if (clinic?.id && clinic.setup_completed) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, isProfessional, clinic, authLoading, shopLoading, navigate]);

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    };
  }, []);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Envie uma imagem (PNG, JPG).", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 2MB.", variant: "destructive" });
      return;
    }
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    const nextUrl = URL.createObjectURL(file);
    logoPreviewRef.current = nextUrl;
    setLogoFile(file);
    setLogoPreview(nextUrl);
  };

  const handleNextStep1 = async () => {
    if (await form.trigger("step1")) setStep(2);
  };
  const handleNextStep2 = async () => {
    if (await form.trigger("step2")) setStep(3);
  };

  const saveOnboardingData = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { step1, step2 } = form.getValues();
      const finalSlug = generateSlug(step1.name);
      const trialEndDate = addDays(new Date(), 30).toISOString();

      const { data: shop, error: shopError } = await supabase
        .from("barbershops")
        .upsert(
          {
            owner_id: user?.id,
            name: step1.name.trim(),
            slug: finalSlug,
            phone: onlyDigits(step1.phone),
            settings: {
              cnpj_cpf: onlyDigits(step1.cnpj),
              onboarding_completed_at: new Date().toISOString(),
            },
            plan_name: "pro",
            plan_status: "trialing",
            trial_ends_at: trialEndDate,
            setup_completed: true,
          },
          { onConflict: "owner_id" },
        )
        .select()
        .single();

      if (shopError) {
        if (shopError.message.includes("slug")) throw new Error("Esta URL já está em uso. Ajuste o nome da clínica.");
        throw shopError;
      }

      await supabase.from("profiles").update({ barbershop_id: shop.id }).eq("user_id", user?.id);

      if (logoFile) {
        const rawExt = logoFile.name.includes(".") ? logoFile.name.split(".").pop() : "";
        const ext = (rawExt || logoFile.type.split("/").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${shop.id}/logo-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type, cacheControl: "3600" });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
          await supabase.from("barbershops").update({ logo_url: urlData.publicUrl }).eq("id", shop.id);
        }
      }

      const servicesToInsert = step2.services.map((service, index) => ({
        barbershop_id: shop.id,
        name: service.name.trim(),
        price: currencyToNumber(service.price),
        duration: Number(service.duration),
        active: true,
        sort_order: index,
        requires_advance_payment: false,
        advance_payment_value: 0,
        category_id: null,
        price_is_starting_at: false,
      }));

      const { error: servicesError } = await supabase.from("services").insert(servicesToInsert);
      if (servicesError) throw new Error(`Erro ao salvar os serviços: ${servicesError.message}`);

      const SEED_HOURS = [
        { day_of_week: 0, open_time: "09:00", close_time: "09:00", is_closed: true },
        { day_of_week: 1, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 2, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 3, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 4, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 5, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 6, open_time: "09:00", close_time: "14:00", is_closed: false },
      ].map((h) => ({ ...h, barbershop_id: shop.id }));
      await supabase.from("business_hours").upsert(SEED_HOURS, { onConflict: "barbershop_id, day_of_week" });

      toast({ title: "Boas-vindas ao time!", description: "Seu painel está pronto." });
      queryClient.invalidateQueries({ queryKey: ["current-clinic"] });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({
        title: "Erro ao finalizar onboarding",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
      setSaving(false);
    }
  };

  if (authLoading || shopLoading) {
    return (
      <div className="min-h-screen bg-sys-bg-base flex items-center justify-center px-6">
        <div className="rounded-3xl border border-sys-border bg-sys-surface px-8 py-6 shadow-card flex items-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-sys-brand-primary" />
          <p className="font-semibold text-sys-text-primary">Carregando…</p>
        </div>
      </div>
    );
  }

  const progress = (step / 3) * 100;
  const values = form.getValues();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-sys-bg-base px-4 py-10 md:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {/* Cabeçalho fixo com progresso */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-sys-text-muted">
              <span>Passo {step} de 3</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="mt-2 h-2 bg-sys-border" />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-sys-text-primary md:text-3xl">
              {STEP_TITLES[step - 1]}
            </h1>
            <p className="mt-1 text-sm text-sys-text-muted">{STEP_SUBTITLES[step - 1]}</p>
          </div>

          <div className="rounded-3xl border border-sys-border bg-sys-surface p-6 shadow-[var(--shadow-elev-3)] md:p-8">
            <Form {...form}>
              <form onSubmit={(e) => e.preventDefault()}>
                {/* ───── Passo 1 ───── */}
                {step === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <FormField
                      control={form.control}
                      name="step1.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sys-text-primary">
                            <Building2 className="h-4 w-4 text-sys-brand-primary" /> Nome da Clínica
                          </FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Clínica Sky Medical" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="step1.cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sys-text-primary">
                            CNPJ
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-sys-text-subtle" />
                              </TooltipTrigger>
                              <TooltipContent>Usado para emissão de recibos.</TooltipContent>
                            </Tooltip>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              inputMode="numeric"
                              placeholder="00.000.000/0001-00"
                              onChange={(e) => field.onChange(applyCnpjMask(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="step1.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sys-text-primary">
                            <Phone className="h-4 w-4 text-sys-brand-primary" /> Telefone / WhatsApp
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              inputMode="numeric"
                              placeholder="(11) 99999-9999"
                              onChange={(e) => field.onChange(applyPhoneMask(e.target.value))}
                            />
                          </FormControl>
                          <p className="text-sm text-sys-text-muted">
                            Este número aparecerá na sua página de agendamento para os seus clientes.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Upload de logo */}
                    <div className="space-y-2">
                      <Label className="text-sys-text-primary">Logo da Clínica</Label>
                      <div className="flex items-center gap-4 rounded-2xl border border-dashed border-sys-border bg-sys-bg-base p-4">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-sys-border bg-sys-surface flex items-center justify-center hover:border-sys-brand-primary transition-colors"
                        >
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                          ) : (
                            <Camera className="h-6 w-6 text-sys-text-subtle" />
                          )}
                        </button>
                        <div>
                          <p className="text-sm font-medium text-sys-text-primary">
                            {logoFile ? "Logo selecionada" : "Clique para enviar"}
                          </p>
                          <p className="text-sm text-sys-text-muted">Uma boa logo transmite confiança.</p>
                        </div>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoSelect}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="button" onClick={handleNextStep1}>
                        Continuar <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ───── Passo 2 ───── */}
                {step === 2 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    {serviceFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="rounded-2xl border border-sys-border bg-sys-bg-base p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="flex items-center gap-2 text-sm font-semibold text-sys-text-primary">
                            <Stethoscope className="h-4 w-4 text-sys-brand-primary" /> Serviço {index + 1}
                          </p>
                          {serviceFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-sys-status-danger"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <FormField
                          control={form.control}
                          name={`step2.services.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sys-text-primary">Nome do Serviço</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Ex: Consulta Avaliativa" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`step2.services.${index}.duration`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2 text-sys-text-primary">
                                  <Clock className="h-4 w-4 text-sys-brand-primary" /> Duração
                                </FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {DURATION_OPTIONS.map((d) => (
                                      <SelectItem key={d} value={d}>
                                        {d} min
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`step2.services.${index}.price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2 text-sys-text-primary">
                                  <CircleDollarSign className="h-4 w-4 text-sys-brand-primary" /> Preço
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    inputMode="numeric"
                                    placeholder="R$ 0,00"
                                    onChange={(e) => field.onChange(applyCurrencyMask(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => append({ name: "", duration: "30", price: "" })}
                    >
                      <Plus className="h-4 w-4" /> Adicionar outro serviço
                    </Button>

                    <div className="flex items-center justify-between pt-2">
                      <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                        <ArrowLeft className="h-4 w-4" /> Voltar
                      </Button>
                      <Button type="button" onClick={handleNextStep2}>
                        Salvar e Avançar <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ───── Passo 3 ───── */}
                {step === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="rounded-2xl border border-sys-border bg-sys-bg-base p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sys-text-muted">Clínica</p>
                      <div className="mt-3 flex items-center gap-3">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-12 w-12 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sys-surface border border-sys-border">
                            <Building2 className="h-5 w-5 text-sys-text-subtle" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-sys-text-primary">{values.step1.name}</p>
                          <p className="text-sm text-sys-text-muted">{values.step1.phone}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-sys-border bg-sys-bg-base p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sys-text-muted">
                        Serviços cadastrados
                      </p>
                      <ul className="mt-3 space-y-2">
                        {values.step2.services.map((s, i) => (
                          <li key={i} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-sys-text-primary">
                              <CheckCircle2 className="h-4 w-4 text-sys-status-success" /> {s.name}
                              <span className="text-sys-text-muted">· {s.duration} min</span>
                            </span>
                            <span className="font-semibold text-sys-text-primary">{s.price}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Button type="button" variant="ghost" disabled={saving} onClick={() => setStep(2)}>
                        <ArrowLeft className="h-4 w-4" /> Voltar
                      </Button>
                      <Button type="button" onClick={saveOnboardingData} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Configurando…
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4" /> Ir para o meu Dashboard
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Onboarding;
