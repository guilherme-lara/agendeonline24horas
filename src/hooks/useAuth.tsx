import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  };

useEffect(() => {
    // Busca a sessão inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      if (currentUser) {
        const admin = await checkAdmin(currentUser.id);
        setUser(currentUser);
        setIsAdmin(admin);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true); // 1. Trava o carregamento imediatamente!
        const currentUser = session?.user ?? null;

        if (currentUser) {
          const admin = await checkAdmin(currentUser.id);
          setUser(currentUser); // 2. Atualiza os dois estados juntos
          setIsAdmin(admin);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
        setLoading(false); // 3. Libera o carregamento
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setLoading(false);
    // Clear all local state to avoid stale data
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = "/auth";
  }, []);

  return { user, loading, isAdmin, signOut };
};
