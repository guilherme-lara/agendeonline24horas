import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook de Realtime para agendamentos.
 * Escuta INSERT, UPDATE e DELETE na tabela appointments filtrado por barbershop_id.
 * Quando detecta mudança, invalida silenciosamente a query — sem loading local.
 */
export const useLiveAppointments = (barbershopId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!barbershopId) return;

    const channel = supabase
      .channel(`live-appointments-${barbershopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${barbershopId}`,
        },
        () => {
          // Invalidação silenciosa — TanStack Query faz refetch em background
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          queryClient.invalidateQueries({ queryKey: ["daily-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbershopId, queryClient]);
};
