import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

// 1. Cria o Contexto Global (A Única Fonte da Verdade)
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// 2. O Provider que vai proteger a aplicação
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAdmin = async (userId: string) => {
      try {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
        return !!data;
      } catch {
        return false;
      }
    };

    // Busca inicial ao carregar a página
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        const admin = await checkAdmin(currentUser.id);
        if (isMounted) setIsAdmin(admin);
      }
      setLoading(false);
    });

    // Escuta as mudanças do Supabase blindado contra "falsos logouts"
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      } else if (event === 'SIGNED_IN') {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const admin = await checkAdmin(currentUser.id);
          if (isMounted) setIsAdmin(admin);
        }
      }
      // NOTA MENTAL: TOKEN_REFRESHED é ignorado aqui para não piscar a UI em trocas de aba
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setLoading(false);
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. Exporta o hook mantendo a compatibilidade com o resto do sistema
export const useAuth = () => useContext(AuthContext);
