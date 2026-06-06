-- ============================================================
-- 1. PUBLIC-SAFE VIEWS (expose only non-sensitive columns)
-- ============================================================

-- Barbers: only id, name, avatar_url (no email/phone)
CREATE OR REPLACE VIEW public.barbers_public AS
  SELECT id, barbershop_id, name, avatar_url, active
  FROM public.barbers
  WHERE active = true;

GRANT SELECT ON public.barbers_public TO anon, authenticated;

-- Barber-services: associations only (no commission_pct)
CREATE OR REPLACE VIEW public.barber_services_public AS
  SELECT id, barbershop_id, barber_id, service_id
  FROM public.barber_services;

GRANT SELECT ON public.barber_services_public TO anon, authenticated;

-- Inventory: only public-facing sale fields (no cost_price)
CREATE OR REPLACE VIEW public.inventory_public AS
  SELECT id, barbershop_id, name, sell_price, quantity, active
  FROM public.inventory
  WHERE active = true;

GRANT SELECT ON public.inventory_public TO anon, authenticated;

-- ============================================================
-- 2. REMOVE OVER-PERMISSIVE PUBLIC POLICIES ON BASE TABLES
-- ============================================================

DROP POLICY IF EXISTS "Public can view barbers limited" ON public.barbers;

DROP POLICY IF EXISTS "Public can view barber services" ON public.barber_services;
DROP POLICY IF EXISTS "Public_Select" ON public.barber_services;

DROP POLICY IF EXISTS "Public can view inventory" ON public.inventory;

DROP POLICY IF EXISTS "Anon can read appointment items" ON public.appointment_items;

-- ============================================================
-- 3. SAAS_PLANS: owners read-only (no self-upgrade)
-- ============================================================

DROP POLICY IF EXISTS "Owners can manage own plan" ON public.saas_plans;

CREATE POLICY "Owners can view own plan"
ON public.saas_plans
FOR SELECT
USING (barbershop_id IN (
  SELECT barbershops.id FROM public.barbershops WHERE barbershops.owner_id = auth.uid()
));

-- ============================================================
-- 4. STORAGE: scope barber-photos mutations by barbershop ownership/membership
-- ============================================================

DROP POLICY IF EXISTS "Authenticated upload barber photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update barber photos" ON storage.objects;

CREATE POLICY "Tenant members upload barber photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barber-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.barbershops WHERE owner_id = auth.uid()
      UNION
      SELECT barbershop_id::text FROM public.barbers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Tenant members update barber photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barber-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.barbershops WHERE owner_id = auth.uid()
      UNION
      SELECT barbershop_id::text FROM public.barbers WHERE user_id = auth.uid()
    )
  )
);