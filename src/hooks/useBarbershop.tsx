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

  const { data: barbershop, isLoading, refetch, isPlaceholderData } = useQuery({
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
    staleTime: 1000 * 60 * 5, // Considera o dado "quente" por 5 minutos
    gcTime: 1000 * 60 * 60, // Mantém no lixo por 1 hora antes de deletar
    retry: 2, // Se a internet oscilar, tenta 2 vezes antes de dar erro
    refetchOnWindowFocus: true, // A MÁGICA: Revalida tudo quando você volta para a aba
  });

  const clearImpersonation = useCallback(async () => {
    localStorage.removeItem("impersonate_barbershop_id");
    // Limpamos o cache global e forçamos recarregamento para o dono real
    await queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
    window.location.href = "/dashboard";
  }, [queryClient]);

  return { 
    barbershop: barbershop || null, 
    loading: isLoading || authLoading, 
    user, 
    refetch, 
    clearImpersonation,
    isUpdating: isPlaceholderData // Útil para mostrar um loader pequeno e discreto no canto
  };
};
