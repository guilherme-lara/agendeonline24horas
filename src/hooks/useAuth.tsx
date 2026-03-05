// 1. Core React e Tipos
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

// 2. Supabase Client
import { supabase } from "@/integrations/supabase/client";

// 3. Tipos de Estado de Autenticação
interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
}

// 4. Contexto Global de Autenticação
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// 5. PROVIDER DE AUTENTICAÇÃO - ARQUITETURA DE NÍVEL ENTERPRISE
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Estado React - apenas para re-renders controlados
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    loading: true,
  });

  // Refs para proteção contra flickering - ESTADO ESTÁVEL
  const stableStateRef = useRef<AuthState>({
    user: null,
    isAdmin: false,
    loading: true,
  });

  const initializedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Função auxiliar para verificar se usuário é admin
  const checkAdminStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        console.warn("[AuthProvider] Erro ao verificar admin:", error.message);
        return false;
      }

      return !!data;
    } catch (error) {
      console.warn("[AuthProvider] Falha na verificação de admin:", error);
      return false;
    }
  };

  // Função para atualizar estado de forma ATÔMICA e PROTEGIDA
  const updateAuthState = (updates: Partial<AuthState>) => {
    if (!isMountedRef.current) return;

    // Atualiza o estado estável primeiro (proteção contra flickering)
    stableStateRef.current = { ...stableStateRef.current, ...updates };

    // Só atualiza React state se houver mudança REAL
    setAuthState(prevState => {
      const newState = { ...prevState, ...updates };
      // Evita re-render se o estado for idêntico
      return JSON.stringify(prevState) === JSON.stringify(newState) ? prevState : newState;
    });
  };

  // Handler para eventos de mudança de auth - PROTEGIDO contra flickering
  const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
    if (!isMountedRef.current) return;

    console.log(`[AuthProvider] Auth event: ${event}`, { hasSession: !!session });

    const currentUser = session?.user ?? null;
    if (
      (event === "INITIAL_SESSION" || event === "SIGNED_IN") &&
      stableStateRef.current.user?.id === currentUser?.id
    ) {
      console.log("[AuthProvider] 🛡️ Ignorando recarga falsa da aba. Mantendo cache.");
      if (stableStateRef.current.loading) {
        updateAuthState({ loading: false });
      }
      return;
    }

    // LÓGICA DE STALE-WHILE-REVALIDATE para auth state
    switch (event) {
      case "INITIAL_SESSION": // <-- Adicionamos isso aqui para cobrir a primeira carga oficial
      case "SIGNED_IN":
      case "USER_UPDATED":
        if (currentUser) {
          // Mantém estado anterior enquanto valida (stale-while-revalidate)
          const isAdmin = await checkAdminStatus(currentUser.id);
          updateAuthState({
            user: currentUser,
            isAdmin,
            loading: false,
          });
          initializedRef.current = true;
        } else {
          updateAuthState({ loading: false });
        }
        break;

      case "TOKEN_REFRESHED":
        // IGNORADO COMPLETAMENTE - evita qualquer flickering
        // O token foi renovado em background, mas não muda o estado do usuário
        return;

      case "SIGNED_OUT":
        // Limpeza controlada - só quando explicitamente solicitado
        if (initializedRef.current) {
          updateAuthState({
            user: null,
            isAdmin: false,
            loading: false,
          });
        }
        break;

      default:
        // Outros eventos - mantém estado atual
        break;
    }
  };

  // SETUP INICIAL - Uma única vez por montagem
  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      try {
        // Busca sessão inicial
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn("[AuthProvider] Erro ao buscar sessão inicial:", error.message);
          updateAuthState({ loading: false });
          return;
        }

        const currentUser = session?.user ?? null;

        if (currentUser) {
          const isAdmin = await checkAdminStatus(currentUser.id);
          updateAuthState({
            user: currentUser,
            isAdmin,
            loading: false,
          });
        } else {
          updateAuthState({ loading: false });
        }

        initializedRef.current = true;

        // Inscreve para mudanças futuras - APENAS UMA VEZ
        const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);
        authSubscription = subscription;

      } catch (error) {
        console.error("[AuthProvider] Erro na inicialização:", error);
        updateAuthState({ loading: false });
      }
    };

    initializeAuth();

    // Cleanup
    return () => {
      isMountedRef.current = false;
      authSubscription?.unsubscribe();
    };
  }, []); // Array de dependências vazio - executa apenas uma vez

  // Função de logout - Limpeza total e controlada
  const signOut = async () => {
    try {
      await supabase.auth.signOut();

      // Limpeza forçada de estado
      updateAuthState({
        user: null,
        isAdmin: false,
        loading: false,
      });

      // Limpeza de storage
      localStorage.clear();
      sessionStorage.clear();

      // Redirect forçado
      window.location.href = "/auth";
    } catch (error) {
      console.error("[AuthProvider] Erro no logout:", error);
      // Mesmo com erro, força limpeza
      updateAuthState({
        user: null,
        isAdmin: false,
        loading: false,
      });
      window.location.href = "/auth";
    }
  };

  // Valor do contexto - sempre consistente
  const contextValue: AuthContextType = {
    user: authState.user,
    isAdmin: authState.isAdmin,
    loading: authState.loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// 6. Hook de consumo - Type-safe e otimizado
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }

  return context;
};