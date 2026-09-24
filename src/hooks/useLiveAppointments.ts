import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook de Realtime para agendamentos.
 * Escuta INSERT, UPDATE e DELETE na tabela appointments filtrado por barbershop_id.
 * Quando detecta mudança, invalida silenciosamente a query — sem loading local.
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

    const appointmentsChannel = supabase
      .channel(`live-appointments-${barbershopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${barbershopId}`,
        },
        (payload) => { 
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
          queryClient.invalidateQueries({ queryKey: ["daily-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });

          if (payload.eventType === 'INSERT') {
            const newAppt = payload.new as any;
            
            try {
              const audio = new Audio('/notification.mp3');
              audio.play().catch(() => console.log('Audio autoplay blocked'));
            } catch (e) {
              console.log('Error playing audio', e);
            }

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
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
    };
  }, [barbershopId, queryClient]);
};
