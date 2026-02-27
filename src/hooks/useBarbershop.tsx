import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Barbershop {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  phone: string;
  address: string;
  settings: Record<string, any>;
  created_at: string;
}

export const useBarbershop = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [loading, setLoading] = useState(true);

  const clearImpersonation = useCallback(() => {
    localStorage.removeItem("impersonate_barbershop_id");
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    
    if (!user) {
      setBarbershop(null);
      setLoading(false);
      return;
    }

    try {
      const impersonateId = localStorage.getItem("impersonate_barbershop_id");
      if (impersonateId && isAdmin) {
        const { data, error } = await supabase
          .from("barbershops")
          .select("*")
          .eq("id", impersonateId)
          .maybeSingle();
        
        if (error) throw error;

        if (data) {
          setBarbershop(data as Barbershop);
          return; 
        }
      }

      const { data, error } = await supabase
        .from("barbershops")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error) throw error;

      setBarbershop(data as Barbershop | null);

    } catch (err) {
      console.error("Erro silencioso ao buscar barbearia (ignorado):", err);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setBarbershop(null);
      setLoading(false);
      return;
    }
    refetch();
  }, [user, authLoading, refetch]);

  return { barbershop, loading: loading || authLoading, user, refetch, clearImpersonation };
};
