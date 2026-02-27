CREATE OR REPLACE FUNCTION public.create_public_appointment(
  _barbershop_id uuid,
  _client_name text,
  _client_phone text,
  _service_name text,
  _price numeric,
  _scheduled_at timestamp with time zone,
  _payment_method text DEFAULT 'pix_online'::text
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
  _requires_advance boolean;
BEGIN
  -- Get service duration and advance payment info
  SELECT duration, COALESCE(requires_advance_payment, false)
  INTO _duration, _requires_advance
  FROM public.services
  WHERE barbershop_id = _barbershop_id AND name = _service_name AND active = true
  LIMIT 1;

  IF _duration IS NULL THEN _duration := 30; END IF;
  IF _requires_advance IS NULL THEN _requires_advance := false; END IF;

  -- Check for conflicts
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

  -- Determine status based on advance payment requirement
  IF _requires_advance THEN
    _status := 'pendente_sinal';
    _pay_status := 'pending';
  ELSIF _payment_method = 'local' THEN
    _status := 'pending';
    _pay_status := 'pending_local';
  ELSE
    _status := 'pending';
    _pay_status := 'pending';
  END IF;

  INSERT INTO public.appointments (barbershop_id, client_name, client_phone, service_name, price, scheduled_at, payment_method, payment_status, status)
  VALUES (_barbershop_id, _client_name, _client_phone, _service_name, _price, _scheduled_at, _payment_method, _pay_status, _status)
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$