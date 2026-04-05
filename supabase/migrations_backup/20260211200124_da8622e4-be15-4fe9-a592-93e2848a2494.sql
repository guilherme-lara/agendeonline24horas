
-- 1. Remove the insecure public insert policy on appointments
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;

-- 2. Create a security definer function for public booking inserts
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
BEGIN
  INSERT INTO public.appointments (barbershop_id, client_name, client_phone, service_name, price, scheduled_at)
  VALUES (_barbershop_id, _client_name, _client_phone, _service_name, _price, _scheduled_at)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- 3. Create a public view for barbershops that hides sensitive fields
CREATE OR REPLACE VIEW public.barbershops_public
WITH (security_invoker = on)
AS SELECT id, name, slug, address FROM public.barbershops;

-- 4. Grant anon/authenticated access to the view
GRANT SELECT ON public.barbershops_public TO anon, authenticated;
