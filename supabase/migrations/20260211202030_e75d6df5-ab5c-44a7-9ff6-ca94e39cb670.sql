
-- Fix: Drop restrictive policies and recreate as permissive for public SELECT
DROP POLICY IF EXISTS "Public can view barbershops" ON public.barbershops;
CREATE POLICY "Public can view barbershops"
  ON public.barbershops
  FOR SELECT
  USING (true);

-- Also fix appointments: ensure public can read for the booking page conflict check
DROP POLICY IF EXISTS "Public can read appointments for conflict check" ON public.appointments;
CREATE POLICY "Public can read appointments for conflict check"
  ON public.appointments
  FOR SELECT
  USING (true);
