-- FIX: Add barber_services table with proper RLS policies
-- This table was created manually via dashboard without migration or RLS policies
-- causing 42501 errors on insert.

CREATE TABLE IF NOT EXISTS public.barber_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  commission_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (barber_id, service_id)
);

ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

-- Owner/tenant-based RLS: can only manage their own barber_services
CREATE POLICY "Owners can manage own barber_services"
  ON public.barber_services
  FOR ALL
  TO authenticated
  USING (
    barbershop_id IN (
      SELECT id FROM public.barbershops WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    barbershop_id IN (
      SELECT id FROM public.barbershops WHERE owner_id = auth.uid()
    )
  );

-- Admins get full access (for impersonation)
CREATE POLICY "Admins can manage all barber_services"
  ON public.barber_services
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
