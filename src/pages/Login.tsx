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
  
  const { user, loading: authLoading, isAdmin } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });

  // Se o cara JÁ TIVER LOGADO e tentar acessar a tela de login pela URL, tira ele de lá
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        navigate("/super-admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

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
        // 2. O GPS MANUAL: Descobre quem é o cara direto na fonte (Banco de Dados)
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", loggedUser.id)
          .eq("role", "admin")
          .maybeSingle();

        // É O SUPER ADMIN? Redireciona na hora e morre a execução aqui.
        if (roleData) {
          window.location.href = "/super-admin";
          return;
        }

        // NÃO É O ADMIN. Vamos ver se ele já configurou a barbearia.
        const { data: shopData } = await supabase
          .from("barbershops")
          .select("id")
          .eq("owner_id", loggedUser.id)
          .maybeSingle();

        if (shopData) {
          // Tem barbearia -> Painel Normal
          window.location.href = "/dashboard";
        } else {
          // Não tem barbearia -> Fazer Onboarding
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
    <div className="min-h-screen bg-[#0b1224] flex items-center justify-center px-6 relative overflow-hidden">
      {/* EFEITOS DE FUNDO */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <div className="mx-auto mb-6 relative group">
            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl group-hover:bg-cyan-500/40 transition-all rounded-full" />
            <div className="relative h-20 w-20 mx-auto flex items-center justify-center rounded-[2rem] bg-slate-900 border border-slate-800 shadow-2xl transition-transform group-hover:scale-110">
              <Scissors className="h-10 w-10 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            {isSignUp ? "Agende" : "System"}<span className="text-cyan-500">Online</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-bold uppercase tracking-widest">
            Plataforma SaaS para Barbearias
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <Input
                    placeholder="Como quer ser chamado?"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-950 border-slate-800 pl-11 h-12 text-white focus-visible:ring-cyan-500/50"
                    required
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">E-mail de Acesso</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <Input
                    type="email"
                    placeholder="seu@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-slate-950 border-slate-800 pl-11 h-12 text-white focus-visible:ring-cyan-500/50"
                    required
                  />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Sua Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="bg-slate-950 border-slate-800 pl-11 pr-11 h-12 text-white focus-visible:ring-cyan-500/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-cyan-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
            </div>

            <Button
              type="submit"
              disabled={authMutation.isPending || authLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-cyan-900/20 transition-all active:scale-95 group"
            >
              {authMutation.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Autenticando...</>
              ) : (
                <>{isSignUp ? "Criar Minha Conta" : "Entrar no Painel"} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" /></>
              )}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-800"></span></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-[#0b1224] px-4 text-slate-600 tracking-[0.3em]">Ou</span></div>
          </div>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors uppercase tracking-widest"
          >
            {isSignUp ? "Já tem acesso? Faça Login" : "Novo por aqui? Criar Barbeira"}
          </button>
        </div>
        
        <div className="mt-12 flex items-center justify-center gap-2 opacity-40">
            <ShieldCheck className="h-3 w-3 text-slate-500" />
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
              Ambiente Seguro &bull; Guilherme Lara Ecosystem 2026
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
