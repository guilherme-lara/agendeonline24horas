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

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAdmin: false,
  });
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
          setState({
            user: currentUser,
            isAdmin: admin,
            loading: false,
          });
          initializedRef.current = true;
        }
      } else {
        if (isMounted) {
          setState({
            user: null,
            isAdmin: false,
            loading: false,
          });
          initializedRef.current = true;
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        const currentUser = session?.user ?? null;
        if (currentUser) {
          const admin = await checkAdmin(currentUser.id);
          if (isMounted) {
            setState({
              user: currentUser,
              isAdmin: admin,
              loading: false,
            });
          }
        }
      } else if (event === "TOKEN_REFRESHED") {
        // Ignorar TOKEN_REFRESHED se já houver usuário para evitar piscadas
        if (initializedRef.current && state.user) {
          return;
        }
        const currentUser = session?.user ?? null;
        if (currentUser) {
          const admin = await checkAdmin(currentUser.id);
          if (isMounted) {
            setState({
              user: currentUser,
              isAdmin: admin,
              loading: false,
            });
          }
        }
      }
      // IMPORTANTE:
      // - SIGNED_OUT não limpa o estado aqui.
      // - A limpeza total de sessão acontece apenas via signOut() explícito.
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      isAdmin: false,
      loading: false,
    });
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider value={{ user: state.user, loading: state.loading, isAdmin: state.isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
