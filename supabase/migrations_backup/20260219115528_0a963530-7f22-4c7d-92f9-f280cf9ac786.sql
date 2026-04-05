
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_appointments_barbershop_id ON public.appointments (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_barbershop_status ON public.appointments (barbershop_id, status);
CREATE INDEX IF NOT EXISTS idx_barbers_barbershop_id ON public.barbers (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_active ON public.barbers (barbershop_id, active);
CREATE INDEX IF NOT EXISTS idx_services_barbershop_id ON public.services (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_barbershop_id ON public.inventory (barbershop_id);
