import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Só fica true no carregamento inicial da página
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdmin = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    } catch {
      return false; // Se der erro de rede, não trava tudo
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Busca inicial ao carregar a página (A única que deve ter loading)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      
      if (currentUser) {
        const admin = await checkAdmin(currentUser.id);
        if (isMounted) {
          setUser(currentUser);
          setIsAdmin(admin);
        }
      } else {
        if (isMounted) setUser(null);
      }
      if (isMounted) setLoading(false);
    });

    // 2. Escuta mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        // O VILÃO DA ABA ESTÁ AQUI! 
        // O Supabase dispara "TOKEN_REFRESHED" sozinho quando você volta pra aba.
        // Se ignorarmos ele aqui, o sistema NUNCA MAIS trava ao trocar de guia.
        
        if (event === 'SIGNED_IN') {
          const currentUser = session?.user ?? null;
          if (currentUser) {
            const admin = await checkAdmin(currentUser.id);
            if (isMounted) {
              setUser(currentUser);
              setIsAdmin(admin);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setUser(null);
            setIsAdmin(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setLoading(false);
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = "/auth";
  }, []);

  return { user, loading, isAdmin, signOut };
};
