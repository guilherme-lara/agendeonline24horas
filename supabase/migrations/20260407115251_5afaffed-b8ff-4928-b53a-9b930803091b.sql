
CREATE OR REPLACE FUNCTION public.create_public_appointment(
  _barbershop_id uuid,
  _client_name text,
  _client_phone text,
  _service_name text,
  _price numeric,
  _scheduled_at timestamp with time zone,
  _payment_method text DEFAULT 'pix_online'::text,
  _barber_id uuid DEFAULT NULL,
  _barber_name text DEFAULT NULL,
  _customer_id uuid DEFAULT NULL
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
  _advance_value numeric;
  _expires_at timestamp with time zone;
BEGIN
  SELECT duration, COALESCE(advance_payment_value, 0)
  INTO _duration, _advance_value
  FROM public.services
  WHERE barbershop_id = _barbershop_id AND name = _service_name AND active = true
  LIMIT 1;

  IF _duration IS NULL THEN _duration := 30; END IF;
  IF _advance_value IS NULL THEN _advance_value := 0; END IF;

  SELECT COUNT(*) INTO _conflict_count
  FROM public.appointments
  WHERE barbershop_id = _barbershop_id
    AND status NOT IN ('cancelled', 'expired')
    AND (
      status IN ('confirmed', 'completed')
      OR (status IN ('pending_payment', 'pendente_pagamento', 'pending', 'pendente_sinal')
          AND (expires_at IS NULL OR expires_at > NOW()))
    )
    AND (
      (_barber_id IS NOT NULL AND barber_id = _barber_id)
      OR (_barber_id IS NULL AND _barber_name IS NOT NULL AND barber_name = _barber_name)
    )
    AND scheduled_at < (_scheduled_at + (_duration + 10) * interval '1 minute')
    AND (scheduled_at + COALESCE(
      (SELECT s.duration FROM public.services s WHERE s.barbershop_id = _barbershop_id AND s.name = appointments.service_name AND s.active = true LIMIT 1),
      30
    ) * interval '1 minute' + interval '10 minutes') > _scheduled_at;

  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'Horário indisponível. Já existe um agendamento neste período.';
  END IF;

  _status := 'pending_payment';
  _pay_status := 'pending';
  _expires_at := NOW() + interval '3 minutes';

  IF _payment_method = 'local' THEN
    _status := 'confirmed';
    _pay_status := 'pending_local';
    _expires_at := NULL;
  END IF;

  INSERT INTO public.appointments (
    barbershop_id, client_name, client_phone, service_name, price, total_price,
    scheduled_at, payment_method, payment_status, status,
    barber_id, barber_name, customer_id, expires_at,
    has_signal, signal_value
  )
  VALUES (
    _barbershop_id, _client_name, _client_phone, _service_name, _price, _price,
    _scheduled_at, _payment_method, _pay_status, _status,
    _barber_id, _barber_name, _customer_id, _expires_at,
    (_advance_value > 0), _advance_value
  )
  RETURNING id INTO _id;
  
  RETURN _id;
END;
$function$;
