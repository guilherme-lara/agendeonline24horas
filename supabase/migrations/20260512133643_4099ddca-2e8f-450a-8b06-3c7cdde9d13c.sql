
-- =============================================================
-- 1. BARBERSHOPS: remove public access to base table; create safe view
-- =============================================================
DROP POLICY IF EXISTS "Public can view barbershops limited" ON public.barbershops;
DROP POLICY IF EXISTS "Public can view barbershops" ON public.barbershops;

CREATE OR REPLACE VIEW public.barbershops_public
WITH (security_invoker = on) AS
SELECT 
  id, 
  name, 
  slug, 
  address, 
  logo_url, 
  phone,
  (settings->>'infinitepay_tag')::text AS infinitepay_tag,
  (settings->>'pix_static_qr_url')::text AS pix_static_qr_url,
  (settings->>'pix_beneficiary')::text AS pix_beneficiary,
  (settings->>'confirmation_message_template')::text AS confirmation_message_template
FROM public.barbershops;

GRANT SELECT ON public.barbershops_public TO anon, authenticated;

-- Allow public to look up a barbershop by slug WITHOUT settings/cnpj exposure.
-- Since Postgres RLS is row-level, we keep base table closed to anon.
-- The view above is the only way for anon to read barbershop data.

-- =============================================================
-- 2. APPOINTMENTS: drop broad public SELECT; expose only safe columns
-- =============================================================
DROP POLICY IF EXISTS "Public can read appointments for conflict check" ON public.appointments;
DROP POLICY IF EXISTS "Public can read appointments limited" ON public.appointments;
DROP POLICY IF EXISTS "Anon can view appointment slots for availability" ON public.appointments;

CREATE OR REPLACE VIEW public.appointments_public
WITH (security_invoker = on) AS
SELECT
  id,
  barbershop_id,
  scheduled_at,
  service_name,
  status,
  barber_id,
  barber_name,
  created_at,
  expires_at
FROM public.appointments
WHERE status NOT IN ('cancelled', 'expired');

GRANT SELECT ON public.appointments_public TO anon, authenticated;

-- =============================================================
-- 3. CUSTOMERS: remove publicly readable/writable policies
-- =============================================================
DROP POLICY IF EXISTS "Public can search customers by phone" ON public.customers;
DROP POLICY IF EXISTS "Public can update own customer record" ON public.customers;
DROP POLICY IF EXISTS "Public can register as customer" ON public.customers;
DROP POLICY IF EXISTS "Permitir Leitura Pública de Clientes" ON public.customers;
DROP POLICY IF EXISTS "Permitir Update Público de Clientes" ON public.customers;
DROP POLICY IF EXISTS "Permitir Inserção Pública de Clientes" ON public.customers;

-- Replacement: secure RPC used by public booking to find-or-create a customer.
CREATE OR REPLACE FUNCTION public.find_or_create_public_customer(
  _barbershop_id uuid,
  _phone text,
  _name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _phone_digits text := regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g');
  _safe_name text := substr(coalesce(trim(_name), ''), 1, 100);
BEGIN
  IF _barbershop_id IS NULL THEN
    RAISE EXCEPTION 'barbershop_id required';
  END IF;
  IF length(_phone_digits) < 10 OR length(_phone_digits) > 11 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF length(_safe_name) < 2 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;

  SELECT id INTO _id
    FROM public.customers
   WHERE barbershop_id = _barbershop_id
     AND phone = _phone_digits
   LIMIT 1;

  IF _id IS NOT NULL THEN
    UPDATE public.customers
       SET name = _safe_name,
           last_seen = now()
     WHERE id = _id;
    RETURN _id;
  END IF;

  INSERT INTO public.customers (barbershop_id, phone, name, last_seen)
  VALUES (_barbershop_id, _phone_digits, _safe_name, now())
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_public_customer(uuid, text, text) TO anon, authenticated;

-- =============================================================
-- 4. BARBERS: drop broken auth.role()-only policies
-- =============================================================
DROP POLICY IF EXISTS "Users can insert their own barbers" ON public.barbers;
DROP POLICY IF EXISTS "Users can update their own barbers" ON public.barbers;
DROP POLICY IF EXISTS "Users can delete their own barbers" ON public.barbers;
-- Remaining "Owners can manage own barbers" policy already enforces ownership.

-- =============================================================
-- 5. BARBER_SERVICES: enable RLS (policies already exist)
-- =============================================================
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 6. STORAGE LOGOS: enforce ownership on UPDATE/DELETE
-- =============================================================
DROP POLICY IF EXISTS "Authenticated users can update own logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;

CREATE POLICY "Owners can upload logos to own barbershop"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.barbershops WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update logos of own barbershop"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.barbershops WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete logos of own barbershop"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.barbershops WHERE owner_id = auth.uid()
  )
);

-- =============================================================
-- 7. ADMIN_GET_USER_EMAILS: early-exit authorization
-- =============================================================
DROP FUNCTION IF EXISTS public.admin_get_user_emails();

CREATE OR REPLACE FUNCTION public.admin_get_user_emails()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email::text
  FROM auth.users au;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_emails() TO authenticated;

-- =============================================================
-- 8. SEARCH PATH HARDENING for remaining functions
-- =============================================================
ALTER FUNCTION public.auto_grant_pro_trial() SET search_path = public;
ALTER FUNCTION public.get_customers_with_stats(uuid) SET search_path = public;

-- =============================================================
-- 9. CREATE_PUBLIC_APPOINTMENT input validation
--    (apply to the multi-item overload that PublicBooking calls)
-- =============================================================
CREATE OR REPLACE FUNCTION public.create_public_appointment(
  _barbershop_id uuid,
  _client_name text,
  _client_phone text,
  _service_name text DEFAULT NULL::text,
  _price numeric DEFAULT 0,
  _scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _payment_method text DEFAULT 'pix_online'::text,
  _barber_id uuid DEFAULT NULL::uuid,
  _barber_name text DEFAULT NULL::text,
  _customer_id uuid DEFAULT NULL::uuid,
  _items jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
  _duration integer;
  _conflict_count integer;
  _pay_status text;
  _status text;
  _advance_value numeric := 0;
  _expires_at timestamp with time zone;
  _total_price numeric := 0;
  _item jsonb;
  _item_name text;
  _item_price numeric;
  _item_duration integer;
  _item_barber_id uuid;
  _item_barber_name text;
  _item_is_product boolean;
  _phone_digits text;
BEGIN
  -- ===== INPUT VALIDATION =====
  IF _barbershop_id IS NULL THEN
    RAISE EXCEPTION 'barbershop_id é obrigatório';
  END IF;
  IF _client_name IS NULL OR length(trim(_client_name)) < 2 OR length(_client_name) > 100 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  _phone_digits := regexp_replace(coalesce(_client_phone, ''), '[^0-9]', '', 'g');
  IF length(_phone_digits) < 10 OR length(_phone_digits) > 11 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF _scheduled_at IS NULL OR _scheduled_at < (now() - interval '5 minutes') OR _scheduled_at > (now() + interval '1 year') THEN
    RAISE EXCEPTION 'Data de agendamento inválida';
  END IF;
  IF _payment_method IS NOT NULL AND _payment_method NOT IN ('pix_online','pix_static','pix_infinitepay','local','card') THEN
    RAISE EXCEPTION 'Método de pagamento inválido';
  END IF;

  IF _items IS NOT NULL THEN
    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
      _item_name := _item->>'name';
      _item_price := ((_item->>'price')::numeric);
      _item_duration := COALESCE((_item->>'duration')::integer, 30);
      _item_barber_id := (_item->>'barber_id')::uuid;
      _item_barber_name := _item->>'barber_name';
      _item_is_product := COALESCE((_item->>'product_type')::boolean, false);

      _total_price := _total_price + _item_price;

      IF NOT _item_is_product AND _scheduled_at IS NOT NULL THEN
        SELECT duration, COALESCE(advance_payment_value, 0)
        INTO _duration, _advance_value
        FROM public.services
        WHERE barbershop_id = _barbershop_id AND name = _item_name AND active = true
        LIMIT 1;

        IF _duration IS NULL THEN _duration := _item_duration; END IF;

        SELECT COUNT(*) INTO _conflict_count
        FROM public.appointments a
        WHERE a.barbershop_id = _barbershop_id
          AND a.status NOT IN ('cancelled', 'expired')
          AND (
            a.status IN ('confirmed', 'completed')
            OR (a.status IN ('pending_payment', 'pendente_pagamento', 'pending', 'pendente_sinal')
                AND (a.expires_at IS NULL OR a.expires_at > NOW()))
          )
          AND (
            (_item_barber_id IS NOT NULL AND a.barber_id = _item_barber_id)
            OR (_item_barber_id IS NULL AND _item_barber_name IS NOT NULL AND a.barber_name = _item_barber_name)
          )
          AND a.scheduled_at < (_scheduled_at + (_duration + 10) * interval '1 minute')
          AND (a.scheduled_at + COALESCE(
            (SELECT s.duration FROM public.services s WHERE s.barbershop_id = a.barbershop_id AND s.name = a.service_name AND s.active = true LIMIT 1),
            30
          ) * interval '1 minute' + interval '10 minutes') > _scheduled_at;

        IF _conflict_count > 0 THEN
          RAISE EXCEPTION 'Horário indisponível. Já existe um agendamento neste período.';
        END IF;
      END IF;
    END LOOP;

    _item := _items->0;
    _item_name := _item->>'name';
    SELECT COALESCE(advance_payment_value, 0)
    INTO _advance_value
    FROM public.services
    WHERE barbershop_id = _barbershop_id AND name = _item_name AND active = true
    LIMIT 1;

    _duration := 0;
    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
      _item_is_product := COALESCE((_item->>'product_type')::boolean, false);
      IF NOT _item_is_product THEN
        _item_duration := COALESCE((_item->>'duration')::integer, 30);
        _duration := _duration + _item_duration;
      END IF;
    END LOOP;

  ELSE
    SELECT duration, COALESCE(advance_payment_value, 0)
    INTO _duration, _advance_value
    FROM public.services
    WHERE barbershop_id = _barbershop_id AND name = _service_name AND active = true
    LIMIT 1;

    IF _duration IS NULL THEN _duration := 30; END IF;
    IF _advance_value IS NULL THEN _advance_value := 0; END IF;
    _total_price := _price;

    SELECT COUNT(*) INTO _conflict_count
    FROM public.appointments a
    WHERE a.barbershop_id = _barbershop_id
      AND a.status NOT IN ('cancelled', 'expired')
      AND (
        a.status IN ('confirmed', 'completed')
        OR (a.status IN ('pending_payment', 'pendente_pagamento', 'pending', 'pendente_sinal')
            AND (a.expires_at IS NULL OR a.expires_at > NOW()))
      )
      AND (
        (_barber_id IS NOT NULL AND a.barber_id = _barber_id)
        OR (_barber_id IS NULL AND _barber_name IS NOT NULL AND a.barber_name = _barber_name)
      )
      AND a.scheduled_at < (_scheduled_at + (_duration + 10) * interval '1 minute')
      AND (a.scheduled_at + COALESCE(
        (SELECT s.duration FROM public.services s WHERE s.barbershop_id = a.barbershop_id AND s.name = a.service_name AND s.active = true LIMIT 1),
        30
      ) * interval '1 minute' + interval '10 minutes') > _scheduled_at;

    IF _conflict_count > 0 THEN
      RAISE EXCEPTION 'Horário indisponível. Já existe um agendamento neste período.';
    END IF;
  END IF;

  _status := 'pending_payment';
  _pay_status := 'pending';
  _expires_at := NOW() + interval '3 minutes';

  IF _payment_method = 'local' THEN
    _status := 'confirmed';
    _pay_status := 'pending_local';
    _expires_at := NULL;
  END IF;

  IF _items IS NOT NULL THEN
    _service_name := (_items->0)->>'name';
    _price := _total_price;
  END IF;

  INSERT INTO public.appointments (
    barbershop_id, client_name, client_phone, service_name, price, total_price,
    scheduled_at, payment_method, payment_status, status,
    barber_id, barber_name, customer_id, expires_at,
    has_signal, signal_value
  )
  VALUES (
    _barbershop_id, trim(_client_name), _phone_digits,
    COALESCE(_service_name, 'multi-serviço'), _price, _total_price,
    _scheduled_at, _payment_method, _pay_status, _status,
    _barber_id, _barber_name, _customer_id, _expires_at,
    (_advance_value > 0), _advance_value
  )
  RETURNING id INTO _id;

  IF _items IS NOT NULL THEN
    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
      _item_name := _item->>'name';
      _item_price := ((_item->>'price')::numeric);
      _item_duration := COALESCE((_item->>'duration')::integer, 30);
      _item_barber_id := CASE WHEN _item ? 'barber_id' AND _item->>'barber_id' IS NOT NULL THEN (_item->>'barber_id')::uuid ELSE _barber_id END;
      _item_barber_name := CASE WHEN _item ? 'barber_name' AND _item->>'barber_name' IS NOT NULL THEN _item->>'barber_name' ELSE _barber_name END;
      _item_is_product := COALESCE((_item->>'product_type')::boolean, false);

      INSERT INTO public.appointment_items (
        appointment_id, service_name, price, duration,
        barber_id, barber_name, product_type
      ) VALUES (
        _id, _item_name, _item_price, _item_duration,
        _item_barber_id, _item_barber_name, _item_is_product
      );
    END LOOP;
  ELSE
    INSERT INTO public.appointment_items (
      appointment_id, service_name, price, duration,
      barber_id, barber_name
    ) VALUES (
      _id, _service_name, _price, _duration,
      _barber_id, _barber_name
    );
  END IF;

  RETURN _id;
END;
$function$;
