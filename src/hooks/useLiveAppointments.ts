import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook de Realtime Global
 * Escuta INSERT, UPDATE e DELETE nas tabelas appointments e customers
 * filtrado por barbershop_id para manter a UI 100% atualizada sem reload.
 */
export const useLiveAppointments = (barbershopId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!barbershopId) return;

    // Canal unificado para a clínica
    const channel = supabase.channel(`live-barbershop-${barbershopId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${barbershopId}`,
        },
        (payload) => {
          // Invalida TODAS as chaves de queries relacionadas a appointments
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          queryClient.invalidateQueries({ queryKey: ["team-monitor-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["daily-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["barber-appointments"] });
          
          if (payload.eventType === 'INSERT') {
            const newAppt = payload.new as any;
            try {
              const audio = new Audio('/notification.mp3');
              audio.play().catch(() => {});
            } catch (e) {}

            const clientName = newAppt.client_name || 'Cliente';
            const serviceName = newAppt.service_name || 'Serviço';
            const time = newAppt.scheduled_at 
              ? new Date(newAppt.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
              : '';
            
            toast.success(`Novo Agendamento: ${clientName} para ${serviceName} às ${time}`, {
              duration: 8000,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: `barbershop_id=eq.${barbershopId}`,
        },
        (payload) => {
          // Invalida a lista de clientes para a UI de Carteira atualizar imediatamente
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          queryClient.invalidateQueries({ queryKey: ["birthdays"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbershopId, queryClient]);
};
