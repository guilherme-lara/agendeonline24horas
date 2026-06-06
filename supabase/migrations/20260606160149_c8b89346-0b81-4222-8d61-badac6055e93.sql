-- Remove the SECURITY DEFINER views (replaced by column-level privileges)
DROP VIEW IF EXISTS public.barbers_public;
DROP VIEW IF EXISTS public.barber_services_public;
DROP VIEW IF EXISTS public.inventory_public;

-- ===== BARBERS: anon limited to safe columns =====
REVOKE SELECT ON public.barbers FROM anon;
GRANT SELECT (id, barbershop_id, name, avatar_url, active) ON public.barbers TO anon;

CREATE POLICY "Anon can view active barbers"
ON public.barbers
FOR SELECT
TO anon
USING (active = true);

-- ===== BARBER_SERVICES: anon limited to associations (no commission) =====
REVOKE SELECT ON public.barber_services FROM anon;
GRANT SELECT (id, barbershop_id, barber_id, service_id) ON public.barber_services TO anon;

CREATE POLICY "Anon can view barber service links"
ON public.barber_services
FOR SELECT
TO anon
USING (true);

-- ===== INVENTORY: anon limited to public sale fields (no cost_price) =====
REVOKE SELECT ON public.inventory FROM anon;
GRANT SELECT (id, barbershop_id, name, sell_price, quantity, active) ON public.inventory TO anon;

CREATE POLICY "Anon can view active inventory"
ON public.inventory
FOR SELECT
TO anon
USING (active = true);