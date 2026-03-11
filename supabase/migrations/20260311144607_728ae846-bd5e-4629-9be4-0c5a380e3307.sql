
-- Cron job para cancelar agendamentos Pix expirados a cada 5 minutos
SELECT cron.schedule(
  'cancel-expired-pix',
  '*/5 * * * *',
  $$SELECT public.cancel_expired_pix_appointments()$$
);
