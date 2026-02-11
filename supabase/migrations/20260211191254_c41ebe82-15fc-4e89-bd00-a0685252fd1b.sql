
-- 1. Barbershops table (SaaS tenants)
CREATE TABLE public.barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own barbershop"
ON public.barbershops FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Public can view barbershops"
ON public.barbershops FOR SELECT
USING (true);

-- 2. Add barbershop_id to profiles
ALTER TABLE public.profiles ADD COLUMN barbershop_id UUID REFERENCES public.barbershops(id);

-- 3. Appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT DEFAULT '',
  client_id UUID,
  service_name TEXT NOT NULL,
  barber_name TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Owners see their barbershop appointments
CREATE POLICY "Owners can manage barbershop appointments"
ON public.appointments FOR ALL
USING (
  barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
)
WITH CHECK (
  barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
);

-- Clients can see own appointments
CREATE POLICY "Clients can view own appointments"
ON public.appointments FOR SELECT
USING (client_id = auth.uid());

-- Anyone can insert appointments (public booking)
CREATE POLICY "Anyone can create appointments"
ON public.appointments FOR INSERT
WITH CHECK (true);

-- 4. SaaS Plans table
CREATE TABLE public.saas_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'essential',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own plan"
ON public.saas_plans FOR ALL
USING (
  barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
)
WITH CHECK (
  barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
);

-- Triggers for updated_at
CREATE TRIGGER update_barbershops_updated_at
BEFORE UPDATE ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
