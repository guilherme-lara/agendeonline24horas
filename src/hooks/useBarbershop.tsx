import { useEffect, useState, useCallback, useRef } from "react";
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

// Cache global em memória para persistir entre trocas de abas/rotas
let memoryCache: Barbershop | null = null;

export const useBarbershop = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [barbershop, setBarbershop] = useState<Barbershop | null>(memoryCache);
  const [loading, setLoading] = useState(!memoryCache);
  
  // Ref para evitar refetch desnecessário se já estiver buscando
  const isFetching = useRef(false);

  const clearImpersonation = useCallback(async () => {
    localStorage.removeItem("impersonate_barbershop_id");
    memoryCache = null;
    setBarbershop(null);
    // Forçamos um refetch para voltar aos dados do dono real
    window.location.reload(); // Forma mais segura de limpar todos os estados de impersonação
  }, []);

  const refetch = useCallback(async (forceSilent = false) => {
    if (isFetching.current) return;
    
    if (!forceSilent && !memoryCache) setLoading(true);
    isFetching.current = true;
    
    if (!user) {
      setBarbershop(null);
      setLoading(false);
      isFetching.current = false;
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
        
        memoryCache = formattedData;
        setBarbershop(formattedData);
      } else {
        setBarbershop(null);
      }
    } catch (err) {
      console.error("Erro useBarbershop:", err);
    } finally {
      setLoading(false);
      isFetching.current = false;
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

    // Lógica de carga inicial
    if (!memoryCache) {
      refetch();
    } else {
      setLoading(false);
      // Se o cache existe mas o owner_id é diferente (e não é admin), limpa
      if (memoryCache.owner_id !== user.id && !localStorage.getItem("impersonate_barbershop_id") && !isAdmin) {
        memoryCache = null;
        refetch();
      }
    }

    // Sincronização ao voltar para a aba
    const handleFocus = () => {
      if (user) refetch(true);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, authLoading, refetch, isAdmin]);

  return { 
    barbershop, 
    loading: loading || authLoading, 
    user, 
    refetch, 
    clearImpersonation 
  };
};
