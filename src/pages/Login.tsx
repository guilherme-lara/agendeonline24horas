import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Scissors, Mail, Lock, Loader2, Eye, EyeOff, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { barbershop, loading: shopLoading } = useBarbershop();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const submittingRef = useRef(false);

  // <-- LÓGICA DE REDIRECIONAMENTO BLINDADA -->
  useEffect(() => {
    if (authLoading || shopLoading) return;
    if (!user) return;

    const handleRedirect = () => {
      if (isAdmin) {
        if (location.pathname !== "/super-admin") navigate("/super-admin", { replace: true });
        return;
      }

      if (barbershop) {
        if (location.pathname !== "/dashboard") navigate("/dashboard", { replace: true });
      } else {
        // Se tem user mas não tem barbearia vinculada, vai para o Onboarding
        if (location.pathname !== "/onboarding") navigate("/onboarding", { replace: true });
      }
    };

    handleRedirect();
  }, [user, barbershop, isAdmin, authLoading, shopLoading, navigate, location.pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    
    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim()) return;
    if (isSignUp && !name.trim()) {
      toast({ title: "Campo obrigatório", description: "Por favor, informe seu nome.", variant: "destructive" });
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: name.trim() },
          },
        });

        if (error) {
          if (error.message.includes("rate limit")) {
            toast({ title: "Muitas tentativas", description: "Aguarde um momento antes de tentar novamente.", variant: "destructive" });
          } else {
            throw error;
          }
        } else {
          toast({ 
            title: "Conta criada com sucesso!", 
            description: "Enviamos um link de confirmação para o seu e-mail.",
          });
          setIsSignUp(false); // Volta para o login após criar conta
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          // Tradução amigável de erros comuns
          let msg = "E-mail ou senha incorretos.";
          if (error.message.includes("Invalid login credentials")) msg = "E-mail ou senha inválidos.";
          if (error.message.includes("Email not confirmed")) msg = "Por favor, confirme seu e-mail antes de entrar.";
          
          toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
        } else {
          toast({ title: "Bem-vindo de volta!" });
        }
      }
    } catch (err: any) {
      toast({
        title: "Ops!",
        description: err.message || "Não conseguimos completar a ação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gold-gradient shadow-gold transform hover:scale-105 transition-transform">
            <Scissors className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {isSignUp ? "AgendeOnline" : "Bem-vindo"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isSignUp ? "Crie sua conta administrativa" : "Acesse o painel da sua barbearia"}
          </p>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background border-border pl-10"
                  required
                />
              </div>
            )}
            
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background border-border pl-10"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background border-border pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading || authLoading}
              className="w-full gold-gradient text-primary-foreground font-bold hover:opacity-90 h-11"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
              ) : isSignUp ? "Cadastrar Agora" : "Acessar Painel"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Ou</span></div>
          </div>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-sm text-center text-muted-foreground hover:text-primary transition-colors"
          >
            {isSignUp ? "Já possui uma conta? Faça login" : "Ainda não tem conta? Comece aqui"}
          </button>
        </div>
        
        <p className="mt-8 text-center text-[10px] text-muted-foreground uppercase tracking-widest">
          AgendeOnline24Horas &copy; 2024
        </p>
      </div>
    </div>
  );
};

export default Login;
