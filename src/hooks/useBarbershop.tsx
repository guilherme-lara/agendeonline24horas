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
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const impersonateId = localStorage.getItem("impersonate_barbershop_id");

  const { data: barbershop, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ["current-barbershop", user?.id, impersonateId],
    queryFn: async (): Promise<Barbershop | null> => {
      if (!user) return null;

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
    enabled: !!user,
    // Herda tudo do global (App.tsx). ZERO overrides locais.
  });

  const clearImpersonation = useCallback(async () => {
    localStorage.removeItem("impersonate_barbershop_id");
    await queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
    window.location.href = "/dashboard";
  }, [queryClient]);

  return { 
    barbershop: barbershop || null, 
    loading: isLoading && !barbershop, 
    user, 
    refetch, 
    clearImpersonation,
    isFetching,
    isError,
  };
};
