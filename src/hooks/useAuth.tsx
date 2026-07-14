// 1. Core React e Tipos
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

// 2. Supabase Client
import { supabase } from "@/integrations/supabase/client";

// 3. Tipos de Estado de Autenticação
interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isProfessional: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
}

// 4. Contexto Global de Autenticação
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Helper: check roles
const checkRole = async (userId: string, role: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
};

// 5. PROVIDER DE AUTENTICAÇÃO
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    isProfessional: false,
    loading: true,
  });

  const stableStateRef = useRef<AuthState>({ user: null, isAdmin: false, isProfessional: false, loading: true });
  const initializedRef = useRef(false);
  const isMountedRef = useRef(true);

  const updateAuthState = (updates: Partial<AuthState>) => {
    if (!isMountedRef.current) return;
    stableStateRef.current = { ...stableStateRef.current, ...updates };
    setAuthState(prevState => {
      const newState = { ...prevState, ...updates };
      return JSON.stringify(prevState) === JSON.stringify(newState) ? prevState : newState;
    });
  };

  const resolveRoles = async (userId: string) => {
    const [isAdmin, isProfessional] = await Promise.all([
      checkRole(userId, "admin"),
      checkRole(userId, "barber"), // Mantendo a role original do DB
    ]);
    return { isAdmin, isProfessional };
  };

  const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
    if (!isMountedRef.current) return;
    const currentUser = session?.user ?? null;

    console.info(`[Auth] Event: ${event}`, { hasSession: !!session, userId: currentUser?.id });

    // PASSWORD_RECOVERY: usuário clicou no link do e-mail de reset.
    // NÃO deslogar. Redirecionar imediatamente para tela segura.
    if (event === "PASSWORD_RECOVERY") {
      updateAuthState({ user: currentUser, loading: false });
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/reset-password")) {
        window.location.replace("/reset-password");
      }
      return;
    }

    if (
      (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
      stableStateRef.current.user?.id === currentUser?.id &&
      currentUser
    ) {
      if (stableStateRef.current.loading) updateAuthState({ loading: false });
      return;
    }

    switch (event) {
      case "INITIAL_SESSION":
      case "SIGNED_IN":
      case "TOKEN_REFRESHED":
      case "USER_UPDATED":
        if (currentUser) {
          const roles = await resolveRoles(currentUser.id);
          updateAuthState({ user: currentUser, ...roles, loading: false });
          initializedRef.current = true;
        } else {
          updateAuthState({ loading: false });
        }
        break;
      case "SIGNED_OUT":
        if (initializedRef.current) {
          updateAuthState({ user: null, isAdmin: false, isProfessional: false, loading: false });
        }
        break;
    }
  };

  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) { updateAuthState({ loading: false }); return; }

        const currentUser = session?.user ?? null;
        if (currentUser) {
          const roles = await resolveRoles(currentUser.id);
          updateAuthState({ user: currentUser, ...roles, loading: false });
        } else {
          updateAuthState({ loading: false });
        }

        initializedRef.current = true;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);
        authSubscription = subscription;
      } catch {
        updateAuthState({ loading: false });
      }
    };

    initializeAuth();
    return () => { isMountedRef.current = false; authSubscription?.unsubscribe(); };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      updateAuthState({ user: null, isAdmin: false, isProfessional: false, loading: false });
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/auth";
    } catch {
      updateAuthState({ user: null, isAdmin: false, isProfessional: false, loading: false });
      window.location.href = "/auth";
    }
  };

  const contextValue: AuthContextType = {
    user: authState.user,
    isAdmin: authState.isAdmin,
    isProfessional: authState.isProfessional,
    loading: authState.loading,
    signOut,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// 6. Hook de consumo
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return context;
};
