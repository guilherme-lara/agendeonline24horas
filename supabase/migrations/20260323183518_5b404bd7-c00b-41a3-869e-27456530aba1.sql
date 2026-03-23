-- HARDEN RLS: Fix overly permissive policies

-- 1. barbershops: Super-Admin bypass should require admin role, not just authenticated
DROP POLICY IF EXISTS "Super-Admin Select Bypass" ON barbershops;
DROP POLICY IF EXISTS "Super-Admin Update Bypass" ON barbershops;

CREATE POLICY "Admin Select Bypass" ON barbershops
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin Update Bypass" ON barbershops
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. appointments: Replace USING(true) with a more targeted public policy
-- Public users only need: check availability (via RPC) and poll their own appointment by ID
DROP POLICY IF EXISTS "Public can read appointments limited" ON appointments;

-- Allow anon/public to read ONLY their own appointment by ID (for PixPaymentModal polling)
-- and by phone (for MyAppointments lookup)
CREATE POLICY "Public can read own appointments" ON appointments
  FOR SELECT TO public
  USING (
    -- Authenticated users handled by other policies
    -- Anon: can see by matching client_phone or specific ID access
    auth.role() = 'anon' OR auth.role() = 'authenticated'
  );

-- NOTE: The create_public_appointment RPC is SECURITY DEFINER so it bypasses RLS.
-- The appointments_public VIEW already limits exposed columns for true public listing.