import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Busca inicial (A única que liga o setLoading)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;

      if (currentUser) {
        setUser(currentUser);
        setLoading(false); // Já libera a UI enquanto checa Admin em background
        const admin = await checkAdmin(currentUser.id);
        if (isMounted) setIsAdmin(admin);
      } else {
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    });

    // 2. Escuta mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // SE FEZ LOGOUT EXPLÍCITO
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
        } 
        // SE FEZ LOGIN EXPLÍCITO
        else if (event === 'SIGNED_IN') {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            const admin = await checkAdmin(currentUser.id);
            if (isMounted) setIsAdmin(admin);
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
