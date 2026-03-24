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
  
  const { user, loading: authLoading, isAdmin, isBarber } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });

  // Se o cara JÁ TIVER LOGADO e tentar acessar a tela de login pela URL, tira ele de lá
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        navigate("/super-admin", { replace: true });
      } else if (isBarber) {
        navigate("/barber/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, isAdmin, isBarber, authLoading, navigate]);

  // --- MUTAÇÃO: LOGIN / CADASTRO COM ROTEAMENTO IMPERATIVO (FORÇADO) ---
  const authMutation = useMutation({
    mutationFn: async () => {
      const email = formData.email.trim();
      const password = formData.password.trim();

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: formData.name.trim() },
          },
        });
        if (error) throw error;
        return { type: 'signup', data };
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { type: 'login', data };
      }
    },
    onSuccess: async (res) => {
      // 1. Limpa qualquer lixo de memória de outro usuário que logou antes
      queryClient.clear();

      if (res.type === 'signup') {
        toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o acesso." });
        setIsSignUp(false);
        return;
      }

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

        // Barbeiro → Dashboard do Barbeiro
        if (roleSet.has("barber")) {
          window.location.href = "/barber/dashboard";
          return;
        }

        // Dono → Dashboard ou Onboarding
        const { data: shopData } = await supabase
          .from("barbershops")
          .select("id")
          .eq("owner_id", loggedUser.id)
          .maybeSingle();

        if (shopData) {
          window.location.href = "/dashboard";
        } else {
          window.location.href = "/onboarding";
        }

      } catch (error) {
        toast({ title: "Erro no roteamento", description: "Tente recarregar a página.", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      let msg = "Falha na autenticação. Verifique os dados.";
      if (err.message.includes("rate limit")) msg = "Muitas tentativas. Aguarde um pouco.";
      if (err.message.includes("Invalid login")) msg = "E-mail ou senha incorretos.";
      
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    authMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      
      {/* BACKGROUND SUTIL E ELEGANTE */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/80 to-zinc-950" />
      
      {/* LUZ DE FUNDO PREMIUM (DOURADO SUAVE) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-900/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-[420px] z-10 animate-in fade-in zoom-in-[0.98] duration-700">
        
        {/* HEADER / LOGO */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-8 relative">
            <div className="relative h-24 w-24 mx-auto flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 shadow-2xl">
              <Scissors className="h-10 w-10 text-amber-500/80" />
            </div>
          </div>
          <h1 className="text-4xl font-normal text-white tracking-tight font-display mb-3">
            {isSignUp ? "Criar Conta" : "Bem-vindo de volta."}
          </h1>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-[0.2em]">
            Acesso Restrito ao Sistema
          </p>
        </div>

        {/* CARD DO FORMULÁRIO */}
        <div className="bg-zinc-900/60 border border-zinc-800/50 p-8 sm:p-10 rounded-3xl backdrop-blur-2xl shadow-2xl shadow-black/50 relative">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {isSignUp && (
              <div className="space-y-2 animate-in slide-in-from-top-4 duration-500">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Proprietário</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-zinc-950/50 border-zinc-800/50 pl-12 h-14 rounded-2xl text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 transition-all"
                    required
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">E-mail</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-amber-500/80 transition-colors" />
                  <Input
                    type="email"
                    placeholder="contato@barbearia.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-zinc-950/50 border-zinc-800/50 pl-12 h-14 rounded-2xl text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 transition-all"
                    required
                  />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-end ml-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Senha</label>
                  {!isSignUp && (
                    <button type="button" className="text-[10px] font-semibold text-zinc-500 hover:text-amber-500 transition-colors">
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-amber-500/80 transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="bg-zinc-950/50 border-zinc-800/50 pl-12 pr-12 h-14 rounded-2xl text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
            </div>

            <Button
              type="submit"
              disabled={authMutation.isPending || authLoading}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold h-14 rounded-2xl shadow-xl transition-all active:scale-[0.98] group mt-8"
            >
              {authMutation.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin text-zinc-500" /> Autenticando...</>
              ) : (
                <>{isSignUp ? "Solicitar Acesso" : "Entrar no Sistema"} <ArrowRight className="ml-2 h-4 w-4 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all" /></>
              )}
            </Button>
          </form>

          {/* DIVISOR */}
          <div className="relative mt-10 mb-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-800/80"></span></div>
            <div className="relative flex justify-center text-[9px] uppercase font-bold">
              <span className="bg-zinc-900 px-4 text-zinc-600 tracking-[0.3em]">Ou</span>
            </div>
          </div>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            {isSignUp ? "Já possui uma conta? Entrar" : "Nova barbearia? Criar uma conta"}
          </button>
        </div>
        
        {/* FOOTER */}
        <div className="mt-12 flex flex-col items-center justify-center gap-3">
            <ShieldCheck className="h-5 w-5 text-zinc-700" />
            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-[0.2em] text-center">
              Ambiente Criptografado <br/>
              <span className="opacity-50 mt-1 block">&copy; Guilherme Lara 2026</span>
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
