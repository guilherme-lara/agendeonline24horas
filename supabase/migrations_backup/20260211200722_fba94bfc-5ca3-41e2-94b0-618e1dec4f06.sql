
-- Services table for each barbershop
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  duration integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Public can view active services for booking
CREATE POLICY "Public can view active services"
  ON public.services FOR SELECT
  USING (active = true);

-- Owners manage their own services
CREATE POLICY "Owners can manage own services"
  ON public.services FOR ALL
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

-- Admins can view all
CREATE POLICY "Admins can view all services"
  ON public.services FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Business hours table
CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '18:00',
  is_closed boolean NOT NULL DEFAULT false,
  UNIQUE (barbershop_id, day_of_week)
);

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- Public can view business hours for booking
CREATE POLICY "Public can view business hours"
  ON public.business_hours FOR SELECT
  USING (true);

-- Owners manage their own hours
CREATE POLICY "Owners can manage own hours"
  ON public.business_hours FOR ALL
  USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

-- Update the create_public_appointment function to check for conflicts
CREATE OR REPLACE FUNCTION public.create_public_appointment(
  _barbershop_id uuid,
  _client_name text,
  _client_phone text,
  _service_name text,
  _price numeric,
  _scheduled_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _duration integer;
  _conflict_count integer;
BEGIN
  -- Get service duration (default 30 if not found)
  SELECT duration INTO _duration FROM public.services
    WHERE barbershop_id = _barbershop_id AND name = _service_name AND active = true
    LIMIT 1;
  IF _duration IS NULL THEN _duration := 30; END IF;

  -- Check for conflicts: existing appointments that overlap with the new one
  -- Buffer time of 10 minutes between services
  SELECT COUNT(*) INTO _conflict_count
  FROM public.appointments
  WHERE barbershop_id = _barbershop_id
    AND status NOT IN ('cancelled')
    AND scheduled_at < (_scheduled_at + (_duration + 10) * interval '1 minute')
    AND (scheduled_at + COALESCE(
      (SELECT s.duration FROM public.services s WHERE s.barbershop_id = _barbershop_id AND s.name = appointments.service_name AND s.active = true LIMIT 1),
      30
    ) * interval '1 minute' + interval '10 minutes') > _scheduled_at;

  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'Horário indisponível. Já existe um agendamento neste período.';
  END IF;

  INSERT INTO public.appointments (barbershop_id, client_name, client_phone, service_name, price, scheduled_at)
  VALUES (_barbershop_id, _client_name, _client_phone, _service_name, _price, _scheduled_at)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
