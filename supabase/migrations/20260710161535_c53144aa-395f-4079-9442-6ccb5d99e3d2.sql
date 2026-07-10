DROP FUNCTION IF EXISTS public.create_public_appointment(uuid,text,text,text,numeric,timestamp with time zone,text,uuid,text,uuid,jsonb);

CREATE OR REPLACE FUNCTION public.create_public_appointment(_barbershop_id uuid, _client_name text, _client_phone text, _service_name text DEFAULT NULL::text, _price numeric DEFAULT 0, _scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _payment_method text DEFAULT 'pix_online'::text, _barber_id uuid DEFAULT NULL::uuid, _barber_name text DEFAULT NULL::text, _customer_id uuid DEFAULT NULL::uuid, _items jsonb DEFAULT NULL::jsonb)
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
  -- Blindagem: janela de horário de funcionamento (BRT)
  _bh_dow integer;
  _bh_open time;
  _bh_close time;
  _bh_closed boolean;
  _bh_found boolean;
  _slot_local timestamp;
  _slot_time time;
BEGIN
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

  -- ── Blindagem: só permite agendar dentro do Horário de Funcionamento (fuso BRT) ──
  _slot_local := _scheduled_at AT TIME ZONE 'America/Sao_Paulo';
  _bh_dow := EXTRACT(DOW FROM _slot_local)::int;
  _slot_time := _slot_local::time;

  SELECT is_closed, open_time, close_time, true
    INTO _bh_closed, _bh_open, _bh_close, _bh_found
    FROM public.business_hours
   WHERE barbershop_id = _barbershop_id AND day_of_week = _bh_dow
   LIMIT 1;

  IF _bh_found THEN
    IF COALESCE(_bh_closed, false) THEN
      RAISE EXCEPTION 'A clínica não atende neste dia.';
    END IF;
    IF _bh_open IS NOT NULL AND _slot_time < _bh_open THEN
      RAISE EXCEPTION 'Horário fora da janela de funcionamento da clínica.';
    END IF;
    IF _bh_close IS NOT NULL AND _slot_time >= _bh_close THEN
      RAISE EXCEPTION 'Horário fora da janela de funcionamento da clínica.';
    END IF;
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
  _expires_at := NOW() + interval '10 minutes';

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