
-- Admin can view all saas_plans
CREATE POLICY "Admins can view all saas_plans"
ON public.saas_plans FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can update all saas_plans
CREATE POLICY "Admins can update all saas_plans"
ON public.saas_plans FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all appointments
CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can update all appointments
CREATE POLICY "Admins can update all appointments"
ON public.appointments FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add price column to saas_plans for MRR calculation
ALTER TABLE public.saas_plans ADD COLUMN price NUMERIC(10,2) NOT NULL DEFAULT 97.00;
