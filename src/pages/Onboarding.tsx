import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Clock,
  CircleDollarSign,
  CheckCircle2,
  Info,
  Tags,
  ShieldCheck,
  Sparkles,
  CalendarClock,
  Store,
  UploadCloud,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { addDays } from "date-fns";

/* ─────────────────────────── Máscaras (funções puras) ─────────────────────────── */
const onlyDigits = (value: string) => value.replace(/\D/g, "");

const applyPhoneMask = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, "($1");
  if (d.length <= 7) return d.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

// Documento universal: aplica CPF (até 11 dígitos) ou CNPJ (até 14).
const applyDocMask = (value: string) => {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
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
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const currencyToNumber = (value: string) => Number(onlyDigits(value)) / 100;

const generateSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ─────────────────────────── Schema de validação ─────────────────────────── */
const DURATION_OPTIONS = ["15", "30", "45", "60", "90", "120"];

const onboardingSchema = z.object({
  step1: z.object({
    name: z
      .string()
      .trim()
      .min(3, "Informe o nome do seu negócio (mín. 3 caracteres)")
      .max(120),
    doc: z
      .string()
      .refine(
        (val) => [11, 14].includes(onlyDigits(val).length),
        "Informe um CPF (11) ou CNPJ (14) válido",
      ),
    phone: z
      .string()
      .refine(
        (val) => onlyDigits(val).length === 11,
        "Telefone inválido — (XX) XXXXX-XXXX",
      ),
  }),
  step2: z.object({
    services: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Informe o nome do serviço").max(80),
          duration: z
            .string()
            .refine((v) => DURATION_OPTIONS.includes(v), "Selecione a duração"),
          price: z
            .string()
            .refine((v) => currencyToNumber(v) > 0, "Informe um preço válido"),
          category: z.string().optional(),
        }),
      )
      .min(1, "Cadastre pelo menos 1 serviço"),
  }),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

type DayHour = {
  day_of_week: number;
  label: string;
  enabled: boolean;
  open_time: string;
  close_time: string;
};

const DEFAULT_HOURS: DayHour[] = [
  { day_of_week: 1, label: "Segunda-feira", enabled: true, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 2, label: "Terça-feira", enabled: true, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 3, label: "Quarta-feira", enabled: true, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 4, label: "Quinta-feira", enabled: true, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 5, label: "Sexta-feira", enabled: true, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 6, label: "Sábado", enabled: true, open_time: "09:00", close_time: "14:00" },
  { day_of_week: 0, label: "Domingo", enabled: false, open_time: "09:00", close_time: "13:00" },
];

const TOTAL_STEPS = 4;
const STEP_META = [
  {
    icon: Store,
    title: "Bem-vindo! Qual o nome do seu negócio?",
    subtitle:
      "Estes dados serão usados para sua página de agendamento pública e emissão de comprovantes.",
  },
  {
    icon: Sparkles,
    title: "Vamos adicionar o seu primeiro serviço",
    subtitle:
      "O que seus clientes costumam agendar? Não se preocupe, você poderá adicionar mais depois.",
  },
  {
    icon: CalendarClock,
    title: "Quando você está de portas abertas?",
    subtitle: "Defina seu horário padrão para liberar sua agenda online.",
  },
  {
    icon: ShieldCheck,
    title: "Último passo: Segurança",
    subtitle:
      "Enviamos um código de 6 dígitos para o seu e-mail para validar seu acesso.",
  },
];

const VALUE_POINTS = [
  "Agenda online 24h, sem ligações nem mensagens manuais.",
  "Página pública profissional com sua marca e seus serviços.",
  "Pagamentos, lembretes e relatórios em um só lugar.",
];

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, isProfessional } = useAuth();
  const { clinic, loading: shopLoading } = useClinic();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const logoPreviewRef = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [hours, setHours] = useState<DayHour[]>(DEFAULT_HOURS);

  // OTP
  const [otp, setOtp] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      step1: { name: "", doc: "", phone: "" },
      step2: { services: [{ name: "", duration: "30", price: "", category: "" }] },
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

  // Timer de reenvio de código
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const setLogo = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Formato inválido", { description: "Envie uma imagem (PNG, JPG)." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "O tamanho máximo é 2MB." });
      return;
    }
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    const nextUrl = URL.createObjectURL(file);
    logoPreviewRef.current = nextUrl;
    setLogoFile(file);
    setLogoPreview(nextUrl);
  }, []);

  const handleLogoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setLogo(file);
    },
    [setLogo],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) setLogo(file);
    },
    [setLogo],
  );

  const handleAddCategory = useCallback(() => {
    const name = newCategory.trim();
    if (name.length < 2) return;
    setCategories((prev) =>
      prev.some((c) => c.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name],
    );
    setNewCategory("");
  }, [newCategory]);

  const updateHour = useCallback(
    (day: number, patch: Partial<DayHour>) => {
      setHours((prev) =>
        prev.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)),
      );
    },
    [],
  );

  const goNext = useCallback(async () => {
    if (step === 1) {
      if (await form.trigger("step1")) setStep(2);
      return;
    }
    if (step === 2) {
      if (await form.trigger("step2")) setStep(3);
      return;
    }
    if (step === 3) {
      if (!hours.some((h) => h.enabled)) {
        toast.error("Defina pelo menos um dia de atendimento.");
        return;
      }
      setStep(4);
    }
  }, [step, form, hours]);

  const sendCode = useCallback(async () => {
    if (!user?.email || sendingCode || resendTimer > 0) return;
    setSendingCode(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setCodeSent(true);
      setResendTimer(45);
      toast.success("Código enviado!", { description: `Verifique o e-mail ${user.email}.` });
    } catch (err: any) {
      toast.error("Não foi possível enviar o código", {
        description: err?.message || "Tente novamente em instantes.",
      });
    } finally {
      setSendingCode(false);
    }
  }, [user?.email, sendingCode, resendTimer]);

  // Envia o código automaticamente ao chegar no passo de segurança
  useEffect(() => {
    if (step === 4 && !codeSent && user?.email) {
      sendCode();
    }
  }, [step, codeSent, user?.email, sendCode]);

  const persistOnboarding = useCallback(async () => {
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
            cnpj_cpf: onlyDigits(step1.doc),
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
      if (shopError.message.includes("slug"))
        throw new Error("Esta URL já está em uso. Ajuste o nome do seu negócio.");
      throw shopError;
    }

    await supabase.from("profiles").update({ barbershop_id: shop.id }).eq("user_id", user?.id);

    // Logo
    if (logoFile) {
      const rawExt = logoFile.name.includes(".") ? logoFile.name.split(".").pop() : "";
      const ext = (rawExt || logoFile.type.split("/").pop() || "png")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const path = `${shop.id}/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type, cacheControl: "3600" });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
        await supabase.from("barbershops").update({ logo_url: urlData.publicUrl }).eq("id", shop.id);
      }
    }

    // Categorias (criadas em memória durante o onboarding)
    const usedCategories = Array.from(
      new Set(
        step2.services
          .map((s) => (s.category || "").trim())
          .filter((c) => c.length > 0),
      ),
    );
    const categoryMap = new Map<string, string>();
    if (usedCategories.length > 0) {
      const { data: insertedCats } = await supabase
        .from("categories")
        .insert(usedCategories.map((name) => ({ barbershop_id: shop.id, name, active: true })))
        .select("id, name");
      (insertedCats || []).forEach((c) => categoryMap.set(c.name.toLowerCase(), c.id));
    }

    // Serviços
    const servicesToInsert = step2.services.map((service, index) => ({
      barbershop_id: shop.id,
      name: service.name.trim(),
      price: currencyToNumber(service.price),
      duration: Number(service.duration),
      active: true,
      sort_order: index,
      requires_advance_payment: false,
      advance_payment_value: 0,
      category_id: service.category
        ? categoryMap.get(service.category.trim().toLowerCase()) ?? null
        : null,
      price_is_starting_at: false,
    }));
    const { error: servicesError } = await supabase.from("services").insert(servicesToInsert);
    if (servicesError) throw new Error(`Erro ao salvar os serviços: ${servicesError.message}`);

    // Horários de atendimento
    const hoursToSave = hours.map((h) => ({
      barbershop_id: shop.id,
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: !h.enabled,
    }));
    await supabase
      .from("business_hours")
      .upsert(hoursToSave, { onConflict: "barbershop_id, day_of_week" });

    queryClient.invalidateQueries({ queryKey: ["current-clinic"] });
  }, [form, user?.id, logoFile, hours, queryClient]);

  const verifyAndFinish = useCallback(async () => {
    if (saving || otp.length !== 6 || !user?.email) return;
    setSaving(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: user.email,
        token: otp,
        type: "email",
      });
      if (otpError) throw new Error("Código inválido ou expirado. Tente novamente.");

      await persistOnboarding();

      toast.success("Tudo pronto!", { description: "Seu painel foi criado com sucesso." });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast.error("Não foi possível finalizar", {
        description: err?.message || "Tente novamente.",
      });
      setSaving(false);
    }
  }, [saving, otp, user?.email, persistOnboarding, navigate]);

  const progress = useMemo(() => (step / TOTAL_STEPS) * 100, [step]);
  const meta = STEP_META[step - 1];
  const values = form.getValues();

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-sys-bg-base lg:grid lg:grid-cols-[1fr_1.15fr]">
        {/* ─────────── Painel esquerdo (valor / marca) ─────────── */}
        <aside
          className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between"
          style={{
            background:
              "linear-gradient(150deg, hsl(var(--sys-brand-primary)) 0%, hsl(var(--sys-brand-primary-hover)) 60%, hsl(var(--sys-status-info, var(--sys-brand-primary))) 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "radial-gradient(at 20% 10%, hsl(var(--sys-brand-on-primary) / 0.18) 0, transparent 45%), radial-gradient(at 90% 90%, hsl(var(--sys-brand-on-primary) / 0.12) 0, transparent 50%)",
            }}
          />
          <div className="relative flex items-center gap-2 text-sys-brand-on-primary">
            <Building2 className="h-6 w-6" />
            <span className="text-lg font-semibold tracking-tight">TBFlow</span>
          </div>

          <div className="relative max-w-md">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight text-sys-brand-on-primary">
              Gestão inteligente para o seu negócio.
            </h2>
            <p className="mt-4 text-base text-sys-brand-on-primary/80">
              Em poucos minutos seu espaço estará pronto para receber agendamentos
              online, com a cara da sua marca.
            </p>

            <ul className="mt-8 space-y-4">
              {VALUE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sys-brand-on-primary/90">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <span className="text-sm">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-sys-brand-on-primary/70">
            Teste Pro gratuito por 30 dias · Sem cartão de crédito.
          </p>
        </aside>

        {/* ─────────── Painel direito (formulário / stepper) ─────────── */}
        <main className="flex min-h-screen items-center justify-center px-4 py-10 md:px-8">
          <div className="w-full max-w-xl">
            {/* Progresso */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs font-semibold text-sys-text-muted">
                <span>Passo {step} de {TOTAL_STEPS}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="mt-2 h-2 bg-sys-border" />
              <div className="mt-6 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sys-brand-primary-soft text-sys-brand-primary">
                  <meta.icon className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-sys-text-primary">
                    {meta.title}
                  </h1>
                  <p className="mt-1 text-sm text-sys-text-muted">{meta.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-sys-border bg-sys-surface p-6 shadow-[var(--shadow-elev-3)] md:p-8">
              <Form {...form}>
                <form onSubmit={(e) => e.preventDefault()}>
                  {/* ───── Passo 1: Identidade ───── */}
                  {step === 1 && (
                    <div
                      key="step-1"
                      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
                    >
                      <FormField
                        control={form.control}
                        name="step1.name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-sys-text-primary">
                              <Building2 className="h-4 w-4 text-sys-brand-primary" /> Nome da Empresa
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: Studio Aurora" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="step1.doc"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-sys-text-primary">
                              CNPJ / CPF
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" className="text-sys-text-subtle">
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Usado apenas para faturamento e recibos.
                                </TooltipContent>
                              </Tooltip>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                inputMode="numeric"
                                placeholder="000.000.000-00"
                                onChange={(e) => field.onChange(applyDocMask(e.target.value))}
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
                              Seus clientes verão este número ao agendar.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Upload de logo (drag & drop) */}
                      <div className="space-y-2">
                        <Label className="text-sys-text-primary">Logo do seu negócio</Label>
                        <div
                          onClick={() => logoInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                          }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={handleDrop}
                          className={`flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition-colors ${
                            dragOver
                              ? "border-sys-brand-primary bg-sys-brand-primary-soft"
                              : "border-sys-border bg-sys-bg-base hover:border-sys-brand-primary"
                          }`}
                        >
                          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-sys-border bg-sys-surface">
                            {logoPreview ? (
                              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                              <Camera className="h-6 w-6 text-sys-text-subtle" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <UploadCloud className="h-5 w-5 text-sys-brand-primary" />
                            <div>
                              <p className="text-sm font-medium text-sys-text-primary">
                                {logoFile ? "Logo selecionada" : "Arraste ou clique para enviar"}
                              </p>
                              <p className="text-sm text-sys-text-muted">PNG ou JPG · até 2MB.</p>
                            </div>
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
                        <Button type="button" onClick={goNext}>
                          Continuar <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ───── Passo 2: Serviços ───── */}
                  {step === 2 && (
                    <div
                      key="step-2"
                      className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300"
                    >
                      {serviceFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="space-y-4 rounded-2xl border border-sys-border bg-sys-bg-base p-5"
                        >
                          <div className="flex items-center justify-between">
                            <p className="flex items-center gap-2 text-sm font-semibold text-sys-text-primary">
                              <Sparkles className="h-4 w-4 text-sys-brand-primary" /> Serviço {index + 1}
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
                                  <Input {...field} placeholder="Ex: Consultoria inicial" />
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

                          {/* Categoria + criação inline */}
                          <FormField
                            control={form.control}
                            name={`step2.services.${index}.category`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2 text-sys-text-primary">
                                  <Tags className="h-4 w-4 text-sys-brand-primary" /> Categoria
                                  <span className="text-xs font-normal text-sys-text-muted">(opcional)</span>
                                </FormLabel>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={field.value || ""}
                                    onValueChange={field.onChange}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Sem categoria" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {categories.length === 0 && (
                                        <div className="px-2 py-1.5 text-sm text-sys-text-muted">
                                          Nenhuma categoria ainda
                                        </div>
                                      )}
                                      {categories.map((c) => (
                                        <SelectItem key={c} value={c}>
                                          {c}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button type="button" variant="outline" size="icon" className="shrink-0">
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-64 space-y-3">
                                      <p className="text-sm font-medium text-sys-text-primary">
                                        Nova categoria
                                      </p>
                                      <Input
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        placeholder="Ex: Estética"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddCategory();
                                          }
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="w-full"
                                        onClick={handleAddCategory}
                                      >
                                        Adicionar
                                      </Button>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => append({ name: "", duration: "30", price: "", category: "" })}
                      >
                        <Plus className="h-4 w-4" /> Adicionar outro serviço
                      </Button>

                      <div className="flex items-center justify-between pt-2">
                        <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                          <ArrowLeft className="h-4 w-4" /> Voltar
                        </Button>
                        <Button type="button" onClick={goNext}>
                          Continuar <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ───── Passo 3: Horários ───── */}
                  {step === 3 && (
                    <div
                      key="step-3"
                      className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300"
                    >
                      {hours.map((h) => (
                        <div
                          key={h.day_of_week}
                          className="flex flex-wrap items-center gap-3 rounded-2xl border border-sys-border bg-sys-bg-base p-4"
                        >
                          <div className="flex w-40 items-center gap-3">
                            <Switch
                              checked={h.enabled}
                              onCheckedChange={(v) => updateHour(h.day_of_week, { enabled: v })}
                            />
                            <span
                              className={`text-sm font-medium ${
                                h.enabled ? "text-sys-text-primary" : "text-sys-text-muted"
                              }`}
                            >
                              {h.label}
                            </span>
                          </div>

                          {h.enabled ? (
                            <div className="ml-auto flex items-center gap-2">
                              <Input
                                type="time"
                                value={h.open_time}
                                onChange={(e) => updateHour(h.day_of_week, { open_time: e.target.value })}
                                className="w-28"
                              />
                              <span className="text-sys-text-muted">às</span>
                              <Input
                                type="time"
                                value={h.close_time}
                                onChange={(e) => updateHour(h.day_of_week, { close_time: e.target.value })}
                                className="w-28"
                              />
                            </div>
                          ) : (
                            <span className="ml-auto text-sm text-sys-text-muted">Fechado</span>
                          )}
                        </div>
                      ))}

                      <div className="flex items-center justify-between pt-2">
                        <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                          <ArrowLeft className="h-4 w-4" /> Voltar
                        </Button>
                        <Button type="button" onClick={goNext}>
                          Continuar <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ───── Passo 4: Segurança (OTP) ───── */}
                  {step === 4 && (
                    <div
                      key="step-4"
                      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
                    >
                      <div className="rounded-2xl border border-sys-border bg-sys-bg-base p-5 text-center">
                        <p className="text-sm text-sys-text-muted">
                          Código enviado para
                        </p>
                        <p className="font-semibold text-sys-text-primary">{user?.email}</p>
                      </div>

                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>

                      <div className="text-center">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          disabled={resendTimer > 0 || sendingCode}
                          onClick={sendCode}
                        >
                          {sendingCode ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
                            </>
                          ) : resendTimer > 0 ? (
                            `Reenviar código em ${resendTimer}s`
                          ) : (
                            "Reenviar código"
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <Button type="button" variant="ghost" disabled={saving} onClick={() => setStep(3)}>
                          <ArrowLeft className="h-4 w-4" /> Voltar
                        </Button>
                        <Button
                          type="button"
                          onClick={verifyAndFinish}
                          disabled={saving || otp.length !== 6}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Configurando…
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-4 w-4" /> Validar e finalizar
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Resumo rápido */}
                      <div className="rounded-2xl border border-sys-border bg-sys-bg-base p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-sys-text-muted">
                          Resumo
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-sys-border bg-sys-surface">
                              <Building2 className="h-4 w-4 text-sys-text-subtle" />
                            </div>
                          )}
                          <div className="text-sm">
                            <p className="font-semibold text-sys-text-primary">{values.step1.name}</p>
                            <p className="text-sys-text-muted">
                              {values.step2.services.length} serviço(s) ·{" "}
                              {hours.filter((h) => h.enabled).length} dia(s) de atendimento
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </Form>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default Onboarding;
