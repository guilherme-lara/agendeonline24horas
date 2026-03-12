import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Tipos de Barbearia
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
  trial_ends_at?: string;
}

// Hook de Barbearia - ARQUITETURA DE NÍVEL ENTERPRISE
export const useBarbershop = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Estado estável para proteção contra flickering
  const stableDataRef = useRef<Barbershop | null>(null);

  // ID de impersonação (apenas para admins)
  const impersonateId = isAdmin ? localStorage.getItem("impersonate_barbershop_id") : null;

  // Query Key robusta - inclui todos os fatores que afetam o resultado
  const queryKey = ["current-barbershop", user?.id, impersonateId];

  // Query principal com lógica de stale-while-revalidate
  const {
    data: barbershop,
    isLoading,
    isFetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<Barbershop | null> => {
      if (!user?.id) {
        console.warn("[useBarbershop] Nenhum usuário autenticado");
        return null;
      }

      try {
        // CORREÇÃO: Encadeamento correto da query do Supabase
        let baseQuery = supabase
          .from("barbershops")
          .select("*, saas_plans(plan_name, status)");

        if (impersonateId && isAdmin) {
          // Modo impersonação - busca barbearia específica
          baseQuery = baseQuery.eq("id", impersonateId);
        } else {
          // Modo normal - busca barbearia do proprietário
          baseQuery = baseQuery.eq("owner_id", user.id);
        }

        const { data, error } = await baseQuery.maybeSingle();

        if (error) {
          console.error("[useBarbershop] Erro na query:", error);
          throw new Error(`Falha ao buscar barbearia: ${error.message}`);
        }

        if (!data) {
          console.warn("[useBarbershop] Nenhuma barbearia encontrada");
          return null;
        }

        // Processa dados da barbearia
        const processedBarbershop: Barbershop = {
          ...data,
          plan_name: data.saas_plans?.[0]?.plan_name || "essential",
          plan_status: data.saas_plans?.[0]?.status || "active",
        };

        // Atualiza estado estável
        stableDataRef.current = processedBarbershop;

        return processedBarbershop;

      } catch (error) {
        console.error("[useBarbershop] Erro na busca:", error);
        throw error;
      }
    },
    enabled: !!user?.id, // Só executa se houver usuário
    staleTime: 5 * 60 * 1000, // 5 minutos - herda do global
    gcTime: 10 * 60 * 1000, // 10 minutos - mantém em cache
    refetchOnWindowFocus: true, // Herda do global
    refetchOnReconnect: true, // Herda do global
    retry: (failureCount, error: any) => {
      // Retry limitado para erros não-autorização
      if (failureCount >= 3) return false;
      if (error?.message?.includes("JWT")) return false; // Não retry auth errors
      return true;
    },
  });

  // LÓGICA CRÍTICA: isLoading && !data
  // - Só mostra loading na PRIMEIRA carga
  // - Após primeira carga, mantém dados antigos (stale-while-revalidate)
  // - Se já tem dados no cache, NUNCA volta para loading
  const isInitialLoading = isLoading && !barbershop && !stableDataRef.current;

  // Função para limpar impersonação
  const clearImpersonation = useCallback(async () => {
    if (!isAdmin) return;

    try {
      localStorage.removeItem("impersonate_barbershop_id");

      // Invalida queries relacionadas
      await queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
      await queryClient.invalidateQueries({ queryKey: ["barbershops"] });

      // Redirect forçado para dashboard
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("[useBarbershop] Erro ao limpar impersonação:", error);
    }
  }, [queryClient, isAdmin]);

  // Função para forçar refresh
  const refreshBarbershop = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error("[useBarbershop] Erro ao atualizar:", error);
    }
  }, [refetch]);

  // Retorno otimizado - apenas valores necessários
  return {
    // Dados principais
    barbershop: barbershop || stableDataRef.current || null,

    // Estados de loading - LÓGICA CRÍTICA
    loading: isInitialLoading, // Só true na primeira carga
    isFetching, // Para mostrar indicadores de refresh
    isError,

    // Metadados
    error,
    user,
    isImpersonating: !!impersonateId,

    // Ações
    refetch: refreshBarbershop,
    clearImpersonation,
  };
};