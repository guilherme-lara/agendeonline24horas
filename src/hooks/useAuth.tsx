import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const initializedRef = useRef(false);

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

    // Busca inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      
      if (currentUser) {
        const admin = await checkAdmin(currentUser.id);
        if (isMounted) {
          setIsAdmin(admin);
          setUser(currentUser);
          setLoading(false);
          initializedRef.current = true;
        }
      } else {
        if (isMounted) {
          setUser(null);
          setLoading(false);
          initializedRef.current = true;
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      } else if (event === 'SIGNED_IN') {
        const currentUser = session?.user ?? null;
        if (currentUser) {
          const admin = await checkAdmin(currentUser.id);
          if (isMounted) {
            setIsAdmin(admin);
            setUser(currentUser);
            setLoading(false);
          }
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // SILENCIOSA: Atualiza o user sem resetar loading
        // Isso impede que a troca de aba congele a interface
        if (session?.user && isMounted) {
          setUser(session.user);
          // Nunca setLoading(true) aqui - os dados já estão na tela
        }
      }
      // INITIAL_SESSION é tratado pelo getSession acima
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

export const useAuth = () => useContext(AuthContext);
