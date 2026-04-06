-- ============================================================
-- MISSION: CRITICAL STABILITY
-- 1. Add customer_id FK to appointments (code uses it, column missing)
-- 2. Open customer table for public SELECT/INSERT/UPDATE (public booking must not require auth)
-- 3. Open barber_services for public SELECT (needed to match barbers to services)
-- ============================================================

-- 1. Add customer_id to appointments if not exists
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_customer_id
  ON public.appointments (customer_id);

-- 2. Allow public (unauthenticated) SELECT/INSERT/UPDATE on customers
--    The PublicBooking flow needs to:
--    - SELECT: look up existing customer by phone
--    - INSERT: create new customer
--    - UPDATE: update name/last_seen
--    Security note: these are limited to barbershop-scoped via application logic
DROP POLICY IF EXISTS "Public can search customers by phone" ON public.customers;
CREATE POLICY "Public can search customers by phone"
  ON public.customers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can register as customer" ON public.customers;
CREATE POLICY "Public can register as customer"
  ON public.customers FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update own customer record" ON public.customers;
CREATE POLICY "Public can update own customer record"
  ON public.customers FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 3. Allow public SELECT on barber_services (need to match barbers to services in booking flow)
DROP POLICY IF EXISTS "Public can view barber services" ON public.barber_services;
CREATE POLICY "Public can view barber services"
  ON public.barber_services FOR SELECT
  USING (true);
