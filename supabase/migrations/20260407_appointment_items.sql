
-- ==========================================
-- Appointment Items Table
-- ==========================================
create table if not exists public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  service_name text not null,
  price numeric not null,
  duration integer not null,
  barber_id uuid,
  barber_name text,
  product_type boolean default false,
  created_at timestamptz default now()
);

alter table public.appointment_items enable row level security;

-- Policy: anon can read items (needed for cart display post-booking)
create policy "Anon can read appointment items"
  on public.appointment_items for select
  to anon
  using (true);

-- ==========================================
-- Update create_public_appointment to accept _items jsonb
-- ==========================================

CREATE OR REPLACE FUNCTION public.create_public_appointment(
  _barbershop_id uuid,
  _client_name text,
  _client_phone text,
  _service_name text DEFAULT NULL,
  _price numeric DEFAULT 0,
  _scheduled_at timestamp with time zone DEFAULT NULL,
  _payment_method text DEFAULT 'pix_online'::text,
  _barber_id uuid DEFAULT NULL,
  _barber_name text DEFAULT NULL,
  _customer_id uuid DEFAULT NULL,
  _items jsonb DEFAULT NULL
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
  _item_category_id uuid;
BEGIN
  -- If multiple items are provided, calculate total price and check conflicts
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

      -- Check slot conflicts only for services (not products)
      IF NOT _item_is_product AND _scheduled_at IS NOT NULL AND _barbershop_id IS NOT NULL THEN
        -- Get duration from services table
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

    -- Use first service price for advance value calculation
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
    -- Legacy single-service mode
    SELECT duration, COALESCE(advance_payment_value, 0)
    INTO _duration, _advance_value
    FROM public.services
    WHERE barbershop_id = _barbershop_id AND name = _service_name AND active = true
    LIMIT 1;

    IF _duration IS NULL THEN _duration := 30; END IF;
    IF _advance_value IS NULL THEN _advance_value := 0; END IF;
    _total_price := _price;

    -- Conflict check for single service
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

  -- Use first service name for the main appointment record
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
    _barbershop_id, _client_name, _client_phone,
    COALESCE(_service_name, 'multi-serviço'), _price, _total_price,
    _scheduled_at, _payment_method, _pay_status, _status,
    _barber_id, _barber_name, _customer_id, _expires_at,
    (_advance_value > 0), _advance_value
  )
  RETURNING id INTO _id;

  -- Insert appointment items if provided
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
    -- Legacy single service — still create an item record
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
