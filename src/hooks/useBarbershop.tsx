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
  plan_name?: string; // Adicionado para evitar furos de performance
  plan_status?: string;
}

// Criamos uma variável fora do hook para servir de cache na memória (RAM) do navegador
let memoryCache: Barbershop | null = null;

export const useBarbershop = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [barbershop, setBarbershop] = useState<Barbershop | null>(memoryCache);
  const [loading, setLoading] = useState(!memoryCache); // Só carrega se não houver cache

  const clearImpersonation = useCallback(() => {
    localStorage.removeItem("impersonate_barbershop_id");
    memoryCache = null; // Limpa o cache ao sair da impersonação
  }, []);

  const refetch = useCallback(async (forceSilent = false) => {
    // Se forceSilent for true, ele atualiza no fundo sem mostrar o "Carregando..."
    if (!forceSilent) setLoading(true);
    
    if (!user) {
      setBarbershop(null);
      setLoading(false);
      return;
    }

    try {
      const impersonateId = localStorage.getItem("impersonate_barbershop_id");
      
      // Buscamos a barbearia JÁ TRAZENDO o plano (saas_plans) para economizar requests
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
        
        memoryCache = formattedData; // Salva no cache global
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
    
    // Se o user deslogar, limpa tudo
    if (!user) {
      memoryCache = null;
      setBarbershop(null);
      setLoading(false);
      return;
    }

    // Só faz a requisição se não tivermos cache OU se o ID do user mudou
    if (!memoryCache || (memoryCache.owner_id !== user.id && !localStorage.getItem("impersonate_barbershop_id"))) {
      refetch();
    } else {
      setLoading(false);
    }
  }, [user, authLoading, refetch]);

  return { 
    barbershop, 
    loading: loading || authLoading, 
    user, 
    refetch, 
    clearImpersonation 
  };
};
