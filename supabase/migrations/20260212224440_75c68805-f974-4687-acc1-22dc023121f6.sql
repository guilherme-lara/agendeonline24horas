
-- 1. Add payment_confirmed_at to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz DEFAULT NULL;

-- 2. Add setup_completed to barbershops
ALTER TABLE public.barbershops 
ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_barbershops_slug ON public.barbershops (slug);
CREATE INDEX IF NOT EXISTS idx_appointments_barbershop_id ON public.appointments (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_payment_id ON public.appointments (payment_id);
CREATE INDEX IF NOT EXISTS idx_services_barbershop_id ON public.services (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_barbershop_id ON public.barbers (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_business_hours_barbershop_id ON public.business_hours (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_barbershop_id ON public.inventory (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_barbershop_id ON public.stock_movements (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_saas_plans_barbershop_id ON public.saas_plans (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- 4. Auto-cancel expired unpaid Pix appointments (10 min timeout)
-- Using a pg_cron-compatible function that can be called manually or scheduled
CREATE OR REPLACE FUNCTION public.cancel_expired_pix_appointments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cancelled_count integer;
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled', payment_status = 'expired'
  WHERE status = 'pending'
    AND payment_method = 'pix_online'
    AND payment_status IN ('pending', 'awaiting')
    AND created_at < (now() - interval '10 minutes')
    AND (payment_confirmed_at IS NULL);
  
  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$;

-- 5. Mark existing barbershops with services as setup_completed
UPDATE public.barbershops 
SET setup_completed = true 
WHERE id IN (SELECT DISTINCT barbershop_id FROM public.services WHERE active = true);

-- 6. Enable realtime for appointments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
