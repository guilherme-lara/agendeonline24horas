import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback } from "react";

export interface Barbershop {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  phone: string;
  address: string;
  settings: Record<string, any>;
  created_at: string;
  plan_name: string;
  plan_status: string;
  setup_completed?: boolean;
}

export const useBarbershop = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Pegamos o ID de impersonação para usar como chave de cache
  const impersonateId = localStorage.getItem("impersonate_barbershop_id");

  const { data: barbershop, isLoading, isFetching, refetch, isError } = useQuery({
    // A chave da query garante que o cache mude se o user ou a impersonação mudar
    queryKey: ["current-barbershop", user?.id, impersonateId],
    queryFn: async (): Promise<Barbershop | null> => {
      if (!user) return null;

      // 1. Antes de buscar, validamos se a sessão ainda existe para evitar erro 400
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("Sessão expirada no useBarbershop. Forçando logout.");
        return null;
      }

      let query = supabase
        .from("barbershops")
        .select("*, saas_plans(plan_name, status)");

      if (impersonateId && isAdmin) {
        query = query.eq("id", impersonateId);
      } else {
        query = query.eq("owner_id", user.id);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.error("Erro na busca do banco:", error);
        throw error;
      }

      if (data) {
        return {
          ...data,
          plan_name: data.saas_plans?.[0]?.plan_name || "essential",
          plan_status: data.saas_plans?.[0]?.status || "active"
        } as Barbershop;
      }
      return null;
    },
    // CONFIGURAÇÕES DE RESILIÊNCIA:
    enabled: !!user && !authLoading, // Só busca se houver usuário logado
    staleTime: 1000 * 60 * 2, // Dados "quentes" por 2 minutos
    gcTime: 1000 * 60 * 10, // Cache vivo por 10 minutos
    retry: 1, // 1 retry apenas — evita loops
    refetchOnWindowFocus: true, // Revalida protegido pelo staleTime
  });

  const clearImpersonation = useCallback(async () => {
    localStorage.removeItem("impersonate_barbershop_id");
    // Limpamos o cache global e forçamos recarregamento para o dono real
    await queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
    window.location.href = "/dashboard";
  }, [queryClient]);

  return { 
    barbershop: barbershop || null, 
    // REGRA 2: loading = true APENAS na primeira carga real (sem dados no cache)
    loading: (isLoading && !barbershop) || authLoading, 
    user, 
    refetch, 
    clearImpersonation,
    isFetching, // Background sync indicator (discreto)
    isError,
  };
};
