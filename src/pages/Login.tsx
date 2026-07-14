import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Scissors, Mail, Lock, Loader2, Eye, EyeOff, User, ArrowRight, ShieldCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { user, loading: authLoading, isAdmin, isProfessional } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  // Se o cara JÁ TIVER LOGADO e tentar acessar a tela de login pela URL, tira ele de lá
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        navigate("/super-admin", { replace: true });
      } else if (isProfessional) {
        navigate("/barber/dashboard", { replace: true });
      } else {
        navigate("/dashboard/caixa", { replace: true });
      }
    }
  }, [user, isAdmin, isProfessional, authLoading, navigate]);

  // --- MUTAÇÃO: LOGIN / CADASTRO COM ROTEAMENTO IMPERATIVO (FORÇADO) ---
  const authMutation = useMutation({
    mutationFn: async () => {
      const email = formData.email.trim();
      const password = formData.password.trim();

      if (isSignUp) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/onboarding`,
              data: { name: formData.name.trim() },
            },
          });
          if (error) throw error;
          return { type: "signup" as const, data };
        } catch (err: any) {
          throw err;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        return { type: "login" as const, data };
      }
    },
    onSuccess: async (res) => {
      if (res.type === "signup") {
        // NÃO limpar cache aqui — usuário ainda pode precisar navegar
        // Se confirmação de e-mail está ativa, sessão vem null
        const needsConfirm = !res.data.session;
        toast({
          title: needsConfirm ? "Confirme seu e-mail para continuar." : "Conta criada!",
          description: needsConfirm
            ? "Enviamos um link de confirmação para o seu e-mail."
            : "Redirecionando para o onboarding...",
        });
        if (!needsConfirm) {
          window.location.href = "/onboarding";
        } else {
          setIsSignUp(false);
        }
        return;
      }

      // Login: limpa cache de usuário anterior APÓS a autenticação estar consolidada
      queryClient.clear();
      toast({ title: "Acesso autorizado. Carregando painel..." });

      const loggedUser = res.data.user;
      if (!loggedUser) return;

      try {
        // Descobre o role do usuário
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", loggedUser.id);

        const roleSet = new Set((roles || []).map((r: any) => r.role));

        // Admin → Super Admin
        if (roleSet.has("admin")) {
          window.location.href = "/super-admin";
          return;
        }

        // Profissional → Dashboard Caixa
        if (roleSet.has("barber")) {
          window.location.href = "/dashboard/caixa";
          return;
        }

        // Dono → Dashboard ou Onboarding
        const { data: shopData } = await supabase
          .from("barbershops")
          .select("id")
          .eq("owner_id", loggedUser.id)
          .maybeSingle();

        if (shopData) {
          window.location.href = "/dashboard/caixa";
        } else {
          window.location.href = "/onboarding";
        }
      } catch (error) {
        toast({
          title: "Erro no roteamento",
          description: "Tente recarregar a página.",
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      const raw = String(err?.message || "").toLowerCase();
      let msg = "Falha na autenticação. Verifique os dados.";

      if (raw.includes("already registered") || raw.includes("already exists") || raw.includes("user already")) {
        msg = "Este e-mail já está cadastrado.";
      } else if (raw.includes("password") && (raw.includes("6 characters") || raw.includes("weak") || raw.includes("short"))) {
        msg = "A senha precisa ter pelo menos 6 caracteres.";
      } else if (raw.includes("email not confirmed") || raw.includes("confirm")) {
        msg = "Confirme seu e-mail para continuar.";
      } else if (raw.includes("invalid login") || raw.includes("invalid credentials")) {
        msg = "E-mail ou senha incorretos.";
      } else if (raw.includes("rate limit") || raw.includes("too many")) {
        msg = "Muitas tentativas. Aguarde alguns minutos.";
      } else if (raw.includes("network") || raw.includes("failed to fetch")) {
        msg = "Sem conexão. Verifique sua internet.";
      }

      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const handleForgotPassword = async () => {
    const email = formData.email.trim();
    if (!email) {
      toast({ title: "Informe seu e-mail", description: "Digite o e-mail cadastrado antes.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
    } catch (err: any) {
      toast({ title: "Não foi possível enviar", description: err?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    authMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* BACKGROUND SUTIL E ELEGANTE */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-[0.05] mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 via-slate-50/80 to-slate-50" />

      {/* LUZ DE FUNDO PREMIUM */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-[420px] z-10 animate-in fade-in zoom-in-[0.98] duration-700">
        {/* HEADER / LOGO */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-8 relative">
            <div className="relative h-24 w-24 mx-auto flex items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-xl">
              <Scissors className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-normal text-foreground tracking-tight font-display mb-3">
            {isSignUp ? "Criar Conta" : "Bem-vindo de volta."}
          </h1>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.2em]">
            Acesso Restrito ao Sistema
          </p>
        </div>

        {/* CARD DO FORMULÁRIO */}
        <div className="bg-white border border-slate-200 p-8 sm:p-10 rounded-3xl shadow-xl relative">
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <div className="space-y-2 animate-in slide-in-from-top-4 duration-500">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                  Proprietário
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="bg-slate-50 border-slate-200 pl-12 h-14 rounded-2xl text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                E-mail
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="email"
                  placeholder="contato@meunegocio.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="bg-slate-50 border-slate-200 pl-12 h-14 rounded-2xl text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end ml-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Senha
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="bg-slate-50 border-slate-200 pl-12 pr-12 h-14 rounded-2xl text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={authMutation.isPending || authLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-14 rounded-2xl shadow-xl transition-all active:scale-[0.98] group mt-8"
            >
              {authMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                  Autenticando...
                </>
              ) : (
                <>
                  {isSignUp ? "Solicitar Acesso" : "Entrar no Sistema"}{" "}
                  <ArrowRight className="ml-2 h-4 w-4 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                </>
              )}
            </Button>
          </form>

          {/* DIVISOR */}
          <div className="relative mt-10 mb-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200"></span>
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-bold">
              <span className="bg-white px-4 text-muted-foreground tracking-[0.3em]">
                Ou
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            {isSignUp
              ? "Já possui uma conta? Entrar"
              : "Novo estabelecimento? Criar uma conta"}
          </button>
        </div>

        {/* FOOTER */}
        <div className="mt-12 flex flex-col items-center justify-center gap-3">
          <ShieldCheck className="h-5 w-5 text-slate-300" />
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] text-center">
            Ambiente Criptografado <br />
            <span className="opacity-50 mt-1 block">
              &copy; Guilherme Lara 2026
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;