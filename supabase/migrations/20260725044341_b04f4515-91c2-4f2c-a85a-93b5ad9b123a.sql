ALTER TABLE public.appointment_items REPLICA IDENTITY FULL;
ALTER TABLE public.cash_movements REPLICA IDENTITY FULL;
ALTER TABLE public.cash_registers REPLICA IDENTITY FULL;
ALTER TABLE public.appointment_payments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_registers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_payments;