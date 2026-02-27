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
  plan_name?: string;
  plan_status?: string;
  setup_completed?: boolean;
}

// Cache global em memória
let memoryCache: Barbershop | null = null;

export const useBarbershop = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [barbershop, setBarbershop] = useState<Barbershop | null>(memoryCache);
  const [loading, setLoading] = useState(!memoryCache);

  const clearImpersonation = useCallback(() => {
    localStorage.removeItem("impersonate_barbershop_id");
    memoryCache = null;
    setBarbershop(null);
  }, []);

  const refetch = useCallback(async (forceSilent = false) => {
    if (!forceSilent && !memoryCache) setLoading(true);
    
    if (!user) {
      setBarbershop(null);
      setLoading(false);
      return;
    }

    try {
      const impersonateId = localStorage.getItem("impersonate_barbershop_id");
      
      let query = supabase
        .from("barbershops")
        .select("*, saas_plans(plan_name, status)");

      if (impersonateId && isAdmin) {
        query = query.eq("id", impersonateId);
      } else {
        query = query.eq("owner_id", user.id);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;

      if (data) {
        const formattedData: Barbershop = {
          ...data,
          plan_name: data.saas_plans?.[0]?.plan_name || "essential",
          plan_status: data.saas_plans?.[0]?.status || "active"
        };
        
        // Atualiza a referência global e o estado local
        memoryCache = formattedData;
        setBarbershop(formattedData);
      }
    } catch (err) {
      console.error("Erro useBarbershop:", err);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      memoryCache = null;
      setBarbershop(null);
      setLoading(false);
      return;
    }

    // Se não tem cache, busca. Se tem, sincroniza silenciosamente.
    if (!memoryCache) {
      refetch();
    } else {
      setLoading(false);
      // Sincronização em background para garantir que o plano/dados mudaram
      refetch(true); 
    }

    // MÁGICA PARA O SISTEMA REDONDO:
    // Revalida os dados sempre que o usuário volta para a aba do navegador
    const handleFocus = () => refetch(true);
    window.addEventListener("focus", handleFocus);
    
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, authLoading, refetch]);

  return { 
    barbershop, 
    loading: loading || authLoading, 
    user, 
    refetch, 
    clearImpersonation 
  };
};
