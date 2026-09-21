GRANT SELECT ON public.barber_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_services TO authenticated;
GRANT ALL ON public.barber_services TO service_role;

DROP POLICY IF EXISTS "Barbers can view own service links" ON public.barber_services;
CREATE POLICY "Barbers can view own service links"
ON public.barber_services FOR SELECT TO authenticated
USING (barbershop_id IN (SELECT b.barbershop_id FROM public.barbers b WHERE b.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all barber_services" ON public.barber_services;
CREATE POLICY "Admins can manage all barber_services"
ON public.barber_services FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));