import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Scissors,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Globe,
  Upload,
  BadgeCheck,
  CheckCircle2,
  Phone,
  Mail,
  Plus,
  Trash2,
  Info,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { formatPhone, formatCnpj } from "@/lib/utils";
import { addDays } from "date-fns";

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const generateSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const onboardingSchema = z.object({
  step1: z.object({
    name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
    email: z.string().email("E-mail inválido"),
    cnpj: z.string().refine((val) => onlyDigits(val).length === 14, {
      message: "CNPJ inválido (deve conter 14 dígitos)",
    }),
    phone: z.string().refine((val) => onlyDigits(val).length === 11, {
      message: "Telefone/WhatsApp inválido (deve conter 11 dígitos com DDD)",
    }),
  }),
  step2: z.object({
    services: z
      .array(
        z.object({
          name: z.string().min(2, "Nome do serviço é obrigatório"),
          price: z.string().refine((val) => Number(val) > 0, "Preço inválido"),
          duration: z
            .string()
            .refine((val) => Number(val) >= 5, "Duração mínima de 5 min"),
        }),
      )
      .min(2, "Cadastre no mínimo 2 serviços"),
  }),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, isProfessional } = useAuth();
  const { clinic, loading: shopLoading } = useClinic();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const logoPreviewRef = useRef<string | null>(null);

  const [otpValue, setOtpValue] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      step1: {
        name: "",
        email: "",
        cnpj: "",
        phone: "",
      },
      step2: {
        services: [
          { name: "", price: "", duration: "30" },
          { name: "", price: "", duration: "30" },
        ],
      },
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
    
    // Pre-fill email from user
    if (user.email && !form.getValues("step1.email")) {
      form.setValue("step1.email", user.email);
    }
    
    if (clinic?.id) {
      if (clinic.setup_completed) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, isProfessional, clinic, authLoading, shopLoading, navigate, form]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleLogoSelect = (file?: File) => {
    if (logoPreviewRef.current) {
      URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = null;
    }
    if (!file) {
      setLogoFile(null);
      setLogoPreview("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    logoPreviewRef.current = nextUrl;
    setLogoFile(file);
    setLogoPreview(nextUrl);
  };

  const handleNextStep1 = async () => {
    const isValid = await form.trigger("step1");
    if (isValid) setStep(2);
  };

  const handleNextStep2 = async () => {
    const isValid = await form.trigger("step2");
    if (isValid) {
      setStep(3);
      sendOtp();
    }
  };

  const sendOtp = async () => {
    setIsSendingOtp(true);
    const email = form.getValues("step1.email");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      toast({
        title: "Código enviado!",
        description: `Verifique a caixa de entrada de ${email}`,
      });
      setResendTimer(60);
    } catch (err: any) {
      toast({
        title: "Erro ao enviar código",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyAndSave = async (otpStr: string) => {
    setIsVerifyingOtp(true);
    const email = form.getValues("step1.email");
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: otpStr,
        type: "email",
      });

      if (otpError) {
        throw new Error("Código inválido ou expirado. Tente novamente.");
      }

      await saveOnboardingData();

    } catch (err: any) {
      toast({
        title: "Erro na verificação",
        description: err.message,
        variant: "destructive",
      });
      setIsVerifyingOtp(false);
    }
  };

  const saveOnboardingData = async () => {
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
            phone: step1.phone.trim(),
            settings: {
              cnpj_cpf: onlyDigits(step1.cnpj),
              onboarding_email: step1.email.trim(),
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
          throw new Error("Esta URL já está em uso.");
        throw shopError;
      }

      await supabase
        .from("profiles")
        .update({ barbershop_id: shop.id })
        .eq("user_id", user?.id);

      if (logoFile) {
        if (!logoFile.type.startsWith("image/")) {
          throw new Error("Envie uma imagem válida para a logo da clínica.");
        }
        if (logoFile.size > 2 * 1024 * 1024) {
          throw new Error("A logo deve ter no máximo 2MB.");
        }

        const rawExt = logoFile.name.includes(".")
          ? logoFile.name.split(".").pop()
          : "";
        const ext = (rawExt || logoFile.type.split("/").pop() || "png")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const path = `${shop.id}/logo-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(path, logoFile, {
            upsert: true,
            contentType: logoFile.type,
            cacheControl: "3600",
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("logos")
            .getPublicUrl(path);
          await supabase
            .from("barbershops")
            .update({ logo_url: urlData.publicUrl })
            .eq("id", shop.id);
        }
      }

      const servicesToInsert = step2.services.map((service, index) => ({
        barbershop_id: shop.id,
        name: service.name.trim(),
        price: Number(service.price),
        duration: Number(service.duration),
        active: true,
        sort_order: index,
        requires_advance_payment: false,
        advance_payment_value: 0,
        category_id: null,
        price_is_starting_at: false,
      }));

      const { error: servicesError } = await supabase
        .from("services")
        .insert(servicesToInsert);

      if (servicesError) {
        throw new Error(`Erro ao salvar os serviços: ${servicesError.message}`);
      }

      const SEED_HOURS = [
        { day_of_week: 0, open_time: "09:00", close_time: "09:00", is_closed: true },
        { day_of_week: 1, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 2, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 3, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 4, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 5, open_time: "09:00", close_time: "18:00", is_closed: false },
        { day_of_week: 6, open_time: "09:00", close_time: "14:00", is_closed: false },
      ].map(h => ({ ...h, barbershop_id: shop.id }));

      await supabase.from("business_hours").upsert(SEED_HOURS, { onConflict: "barbershop_id, day_of_week" });

      toast({
        title: "Boas-vindas ao time!",
        description: "Seu estabelecimento foi configurado.",
      });
      queryClient.invalidateQueries({ queryKey: ["current-clinic"] });
      navigate("/dashboard", { replace: true });

    } catch (err: any) {
      toast({
        title: "Erro ao finalizar onboarding",
        description: err.message,
        variant: "destructive",
      });
      setIsVerifyingOtp(false);
    }
  };

  const stepMeta = [
    {
      id: 1,
      title: "Dados da clínica",
      description: "Nome, documento, contato e logo.",
    },
    {
      id: 2,
      title: "Primeiros serviços",
      description: "Cadastre pelo menos 2 serviços.",
    },
    {
      id: 3,
      title: "Verificação",
      description: "Confirme seu e-mail via OTP.",
    },
  ];

  if (authLoading || shopLoading) {
    return (
      <div className="min-h-screen bg-sys-bg-base bg-mesh flex items-center justify-center px-6">
        <div className="rounded-3xl border border-sys-border bg-sys-surface px-8 py-6 shadow-card flex items-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-sys-brand-primary" />
          <div>
            <p className="font-semibold text-sys-text-primary">Carregando</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sys-bg-base bg-mesh px-4 py-10 md:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sys-border bg-sys-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sys-text-muted shadow-card">
            <BadgeCheck className="h-4 w-4 text-sys-brand-primary" />
            Onboarding white-glove
          </div>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Scissors className="h-9 w-9 text-sys-brand-primary" />
            <h1 className="text-3xl font-semibold tracking-tight text-sys-text-primary md:text-4xl">
              Seja bem-vindo ao TBFlow
            </h1>
          </div>
        </div>

        <div className="mb-8 grid gap-3 md:grid-cols-3">
          {stepMeta.map((item) => {
            const active = step === item.id;
            const completed = step > item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 shadow-card transition-all ${
                  active
                    ? "border-sys-brand-primary bg-sys-surface"
                    : completed
                    ? "border-sys-brand-primary/40 bg-sys-surface/80"
                    : "border-sys-border bg-sys-surface"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      active
                        ? "bg-sys-brand-primary text-sys-brand-on-primary"
                        : completed
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-sys-bg-base text-sys-text-muted"
                    }`}
                  >
                    {completed ? <CheckCircle2 className="h-4 w-4" /> : item.id}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-sys-text-primary">
                      {item.title}
                    </p>
                    <p className="text-xs text-sys-text-muted">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-sys-border bg-sys-surface shadow-[var(--shadow-elev-3)]">
          <Form {...form}>
            <form className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]" onSubmit={(e) => e.preventDefault()}>
              <div className="border-b border-sys-border bg-sys-bg-base p-6 lg:border-b-0 lg:border-r lg:p-8">
                <div className="rounded-3xl border border-sys-border bg-sys-surface p-6 shadow-card">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sys-text-muted">
                    Passo atual
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-sys-text-primary">
                    {stepMeta[step - 1]?.title}
                  </h2>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-sys-border bg-sys-bg-base p-4">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-sys-brand-primary" />
                      <div>
                        <p className="text-sm font-semibold text-sys-text-primary">
                          Sequência guiada
                        </p>
                        <p className="text-xs text-sys-text-muted">
                          Cada etapa valida apenas o que é necessário.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 lg:p-10">
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="grid gap-5 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="step1.name"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-sys-text-muted">
                              <Building2 className="h-4 w-4" /> Nome da clínica
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Ex: Clínica TBFlow"
                                className="h-12 border-sys-border bg-sys-bg-base text-sys-text-primary placeholder:text-sys-text-subtle"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="step1.email"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-sys-text-muted">
                              <Mail className="h-4 w-4" /> E-mail
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="voce@clinica.com"
                                className="h-12 border-sys-border bg-sys-bg-base text-sys-text-primary placeholder:text-sys-text-subtle"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="step1.cnpj"
                        render={({ field: { onChange, value, ...field } }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-sys-text-muted">
                              <Globe className="h-4 w-4" /> CNPJ
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={value}
                                onChange={(e) => {
                                  const formatted = formatCnpj(e.target.value);
                                  onChange(formatted);
                                }}
                                placeholder="00.000.000/0000-00"
                                inputMode="numeric"
                                maxLength={18}
                                className="h-12 border-sys-border bg-sys-bg-base font-mono text-sys-text-primary placeholder:text-sys-text-subtle"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="step1.phone"
                        render={({ field: { onChange, value, ...field } }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-sys-text-muted">
                              <Phone className="h-4 w-4" /> Telefone / WhatsApp
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={value}
                                onChange={(e) => {
                                  const formatted = formatPhone(e.target.value);
                                  onChange(formatted);
                                }}
                                placeholder="(11) 99999-9999"
                                inputMode="tel"
                                maxLength={15}
                                className="h-12 border-sys-border bg-sys-bg-base font-mono text-sys-text-primary placeholder:text-sys-text-subtle"
                              />
                            </FormControl>
                            <p className="text-[11px] text-sys-text-muted mt-1">
                              Usaremos este número em breve para notificações e segurança via WhatsApp.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3 md:col-span-2">
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-sys-text-muted">
                          <Upload className="h-4 w-4" /> Upload de logo
                        </label>
                        <div className="flex flex-col gap-4 rounded-3xl border border-dashed border-sys-border bg-sys-bg-base p-4 md:flex-row md:items-center">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-sys-border bg-sys-surface shadow-card">
                            {logoPreview ? (
                              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                              <BadgeCheck className="h-6 w-6 text-sys-text-subtle" />
                            )}
                          </div>
                          <div>
                            <input
                              id="logo-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleLogoSelect(e.target.files?.[0] || undefined)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById("logo-upload")?.click()}
                              className="h-11 border-sys-border bg-sys-surface text-sys-text-primary"
                            >
                              Selecionar logo
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={handleNextStep1}
                        className="h-12 bg-sys-brand-primary text-sys-brand-on-primary hover:bg-[hsl(var(--sys-brand-primary-hover))]"
                      >
                        Continuar <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    {serviceFields.map((field, index) => (
                      <div key={field.id} className="rounded-3xl border border-sys-border bg-sys-bg-base p-4 shadow-card">
                        <div className="mb-4 flex justify-between">
                          <p className="font-semibold text-sys-text-primary">Serviço {index + 1}</p>
                          {serviceFields.length > 2 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                              <Trash2 className="h-4 w-4 text-sys-status-danger" />
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-4 md:grid-cols-[1.5fr_0.7fr_0.7fr]">
                          <FormField
                            control={form.control}
                            name={`step2.services.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] text-sys-text-muted">NOME</FormLabel>
                                <FormControl>
                                  <Input {...field} className="border-sys-border bg-sys-surface text-sys-text-primary" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`step2.services.${index}.price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] text-sys-text-muted">PREÇO</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" step="0.01" className="border-sys-border bg-sys-surface text-sys-text-primary" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`step2.services.${index}.duration`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] text-sys-text-muted">DURAÇÃO (min)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" step="5" className="border-sys-border bg-sys-surface text-sys-text-primary" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex justify-between items-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => append({ name: "", price: "", duration: "30" })}
                        className="border-sys-border text-sys-text-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Adicionar serviço
                      </Button>
                      
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                        <Button
                          type="button"
                          onClick={handleNextStep2}
                          disabled={isSendingOtp}
                          className="bg-sys-brand-primary text-sys-brand-on-primary"
                        >
                          Continuar <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-semibold text-sys-text-primary">Verifique seu e-mail</h2>
                      <p className="text-sm text-sys-text-muted mt-2">
                        Enviamos um código de 6 dígitos para <br />
                        <strong>{form.getValues("step1.email")}</strong>
                      </p>
                    </div>

                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otpValue}
                        onChange={(val) => {
                          setOtpValue(val);
                          if (val.length === 6) {
                            verifyAndSave(val);
                          }
                        }}
                        disabled={isVerifyingOtp}
                      >
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

                    <div className="flex flex-col items-center gap-4 mt-6">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={resendTimer > 0 || isSendingOtp}
                        onClick={sendOtp}
                        className="text-sys-text-muted hover:text-sys-text-primary"
                      >
                        {isSendingOtp ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {resendTimer > 0 ? `Reenviar código em ${resendTimer}s` : "Reenviar código"}
                      </Button>

                      {isVerifyingOtp && (
                        <p className="text-sm text-sys-brand-primary flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando e salvando...
                        </p>
                      )}
                      
                      <div className="flex w-full justify-between mt-4">
                        <Button type="button" variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
