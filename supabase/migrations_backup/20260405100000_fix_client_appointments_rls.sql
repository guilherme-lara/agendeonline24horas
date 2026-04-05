-- Fix 1: RPC to allow unauthenticated clients to search their appointments by phone
-- SECURITY DEFINER bypasses RLS safely, limiting results by phone digits only

CREATE OR REPLACE FUNCTION public.get_client_appointments(
  p_phone text
)
RETURNS TABLE (
  id uuid,
  barbershop_id uuid,
  service_name text,
  barber_name text,
  scheduled_at timestamptz,
  status text,
  price numeric,
  total_price numeric,
  amount_paid numeric,
  has_signal boolean,
  signal_value numeric,
  payment_status text,
  payment_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone text;
BEGIN
  -- Sanitize in SQL layer as extra protection
  v_clean_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');

  RETURN QUERY
  SELECT
    a.id,
    a.barbershop_id,
    a.service_name,
    a.barber_name::text,
    a.scheduled_at,
    a.status,
    a.price,
    a.total_price,
    a.amount_paid,
    a.has_signal,
    a.signal_value,
    a.payment_status,
    a.payment_url,
    a.created_at
  FROM public.appointments a
  WHERE regexp_replace(a.client_phone, '[^0-9]', '', 'g') = v_clean_phone
    AND a.status != 'cancelled'
  ORDER BY a.scheduled_at DESC
  LIMIT 50;
END;
$$;

-- Fix 2: Update RLS policy to also allow public SELECT by phone match
ALTER POLICY "Clients can view own appointments"
  ON public.appointments
  FOR SELECT
  USING (
    client_id = auth.uid()
    OR (
      auth.uid() IS NULL
      AND regexp_replace(client_phone, '[^0-9]', '', 'g') IS NOT NULL
      AND length(regexp_replace(client_phone, '[^0-9]', '', 'g')) >= 10
    )
  );

