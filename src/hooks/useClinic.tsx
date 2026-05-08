import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Tipos de Clínica
export interface Clinic {
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

// Hook de Clínica - ARQUITETURA DE NÍVEL ENTERPRISE
export const useClinic = () => {
  const { user, isAdmin, isProfessional } = useAuth();
  const queryClient = useQueryClient();

  // Estado estável para proteção contra flickering
  const stableDataRef = useRef<Clinic | null>(null);

  // ID de impersonação (apenas para admins)
  const impersonateId = isAdmin
    ? localStorage.getItem("impersonate_barbershop_id")
    : null;

  // Estado local pro professionalId (ID do profissional na tabela barbers)
  const professionalIdRef = useRef<string | null>(null);

  // Query Key robusta - inclui todos os fatores que afetam o resultado
  const queryKey = ["current-clinic", user?.id, impersonateId];

  // Query principal com lógica de stale-while-revalidate
  const {
    data: clinic,
    isLoading,
    isFetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<Clinic | null> => {
      if (!user?.id) {
        console.warn("[useClinic] Nenhum usuário autenticado");
        return null;
      }

      try {
        let clinicId: string | null = null;

        // Se for profissional, busca o barbershop_id e id pela tabela barbers
        if (isProfessional && !impersonateId) {
          const { data: professionalData, error: professionalError } = await supabase
            .from("barbers")
            .select("id, barbershop_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (professionalError) {
            console.error(
              "[useClinic] Erro ao buscar profissional:",
              professionalError,
            );
          }
          clinicId = professionalData?.barbershop_id || null;
          professionalIdRef.current = professionalData?.id || null;
        }

        // CORREÇÃO: Encadeamento correto da query do Supabase
        let baseQuery = supabase
          .from("barbershops")
          .select("*, saas_plans(plan_name, status)");

        if (impersonateId && isAdmin) {
          // Modo impersonação - busca clínica específica
          baseQuery = baseQuery.eq("id", impersonateId);
        } else if (isProfessional && clinicId) {
          // Modo profissional - busca clínica vinculada
          baseQuery = baseQuery.eq("id", clinicId);
        } else {
          // Modo normal - busca clínica do proprietário
          baseQuery = baseQuery.eq("owner_id", user.id);
        }

        const { data, error } = await baseQuery.maybeSingle();

        if (error) {
          console.error("[useClinic] Erro na query:", error);
          throw new Error(`Falha ao buscar clínica: ${error.message}`);
        }

        if (!data) {
          console.warn("[useClinic] Nenhuma clínica encontrada");
          return null;
        }

        // Processa dados da clínica
        // saas_plans pode vir como objeto (1:1 via unique constraint) ou array
        const rawPlans = data.saas_plans;
        let activePlan: any = null;
        if (Array.isArray(rawPlans)) {
          activePlan = rawPlans.find((p: any) => p.status === "active") || null;
        } else if (rawPlans && typeof rawPlans === "object") {
          activePlan = (rawPlans as any).status === "active" ? rawPlans : null;
        }

        // Check if active plan is expired
        let planStatus = activePlan?.status || "none";
        if (
          activePlan?.expires_at &&
          new Date(activePlan.expires_at) < new Date()
        ) {
          planStatus = "expired";
        }

        const processedClinic: Clinic = {
          ...data,
          plan_name: activePlan?.plan_name || "trial",
          plan_status: planStatus,
          trial_ends_at: data.trial_ends_at,
        };

        // Atualiza estado estável
        stableDataRef.current = processedClinic;

        return processedClinic;
      } catch (error) {
        console.error("[useClinic] Erro na busca:", error);
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
  // - Se a query retornou null (usuário novo), loading = false imediatamente
  const isInitialLoading = isLoading && !clinic && !stableDataRef.current;

  // Função para limpar impersonação
  const clearImpersonation = useCallback(async () => {
    if (!isAdmin) return;

    try {
      localStorage.removeItem("impersonate_barbershop_id");

      // Invalida queries relacionadas
      await queryClient.invalidateQueries({ queryKey: ["current-clinic"] });
      await queryClient.invalidateQueries({ queryKey: ["barbershops"] }); // Mantendo a ref pro DB

      // Redirect forçado para dashboard
      window.location.href = "/dashboard/caixa";
    } catch (error) {
      console.error("[useClinic] Erro ao limpar impersonação:", error);
    }
  }, [queryClient, isAdmin]);

  // Função para forçar refresh
  const refreshClinic = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error("[useClinic] Erro ao atualizar:", error);
    }
  }, [refetch]);

  // Retorno otimizado - apenas valores necessários
  return {
    // Dados principais
    clinic: clinic || stableDataRef.current || null,
    professionalId: professionalIdRef.current,

    // Estados de loading - LÓGICA CRÍTICA
    loading: isInitialLoading, // Só true na primeira carga
    isFetching, // Para mostrar indicadores de refresh
    isError,

    // Metadados
    error,
    user,
    isImpersonating: !!impersonateId,

    // Ações
    refetch: refreshClinic,
    clearImpersonation,
  };
};
