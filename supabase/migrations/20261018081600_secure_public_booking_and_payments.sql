DO $migration$
DECLARE
  _definition text;
  _marker text := '  IF _items IS NOT NULL THEN';
  _position integer;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_public_appointment(uuid,text,text,text,numeric,timestamp with time zone,text,uuid,text,uuid,jsonb)'::regprocedure
  ) INTO _definition;

  IF _definition IS NULL OR position('OR false' IN _definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected create_public_appointment definition; review booking conflict migration';
  END IF;

  _definition := replace(
    _definition,
    'a.status IN (''confirmed'', ''completed'')',
    'a.status IN (''scheduled'', ''confirmed'', ''completed'')'
  );
  _definition := replace(
    _definition,
    'OR false',
    'OR (a.status IN (''pending_payment'', ''pendente_pagamento'', ''pending'', ''pendente_sinal'') AND (a.expires_at IS NULL OR a.expires_at > NOW()))'
  );
  _position := strpos(_definition, _marker);
  IF _position = 0 THEN
    RAISE EXCEPTION 'Could not add booking serialization lock';
  END IF;
  _definition := overlay(
    _definition
    placing '  PERFORM pg_advisory_xact_lock(hashtextextended(_barbershop_id::text, 0));'
      || E'\n\n'
      || _marker
    from _position
    for length(_marker)
  );
  EXECUTE _definition;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.get_public_booking_slots(
  _barbershop_id uuid,
  _start_at timestamptz,
  _end_at timestamptz
)
RETURNS TABLE (
  id uuid,
  scheduled_at timestamptz,
  service_name text,
  status text,
  barber_id uuid,
  barber_name text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF _barbershop_id IS NULL OR _start_at IS NULL OR _end_at IS NULL
    OR _end_at <= _start_at OR _end_at > _start_at + interval '26 hours' THEN
    RAISE EXCEPTION 'Invalid public booking date range';
  END IF;

  RETURN QUERY
  SELECT a.id, a.scheduled_at, a.service_name, a.status,
         a.barber_id, a.barber_name, a.expires_at
    FROM public.appointments a
   WHERE a.barbershop_id = _barbershop_id
     AND a.scheduled_at >= _start_at
     AND a.scheduled_at <= _end_at
     AND a.status NOT IN ('cancelled', 'expired')
     AND NOT (
       a.status IN ('pending_payment', 'pendente_pagamento', 'pending', 'pendente_sinal')
       AND a.expires_at IS NOT NULL
       AND a.expires_at <= now()
     );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_booking_status(_appointment_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT jsonb_build_object('status', a.status, 'expires_at', a.expires_at)
    FROM public.appointments a
   WHERE a.id = _appointment_id
   LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.expire_public_booking(_appointment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _expired boolean;
BEGIN
  UPDATE public.appointments
     SET status = 'cancelled',
         payment_status = 'expired',
         updated_at = now()
   WHERE id = _appointment_id
     AND status IN ('pending_payment', 'pendente_pagamento', 'pending', 'pendente_sinal')
     AND payment_status IN ('pending', 'awaiting')
     AND expires_at IS NOT NULL
     AND expires_at <= now();
  _expired := FOUND;
  RETURN _expired;
END;
$function$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_expected_amount numeric(12,2);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_payments_external_reference
  ON public.appointment_payments (barbershop_id, external_reference)
  WHERE external_reference IS NOT NULL;

DROP POLICY IF EXISTS "Barbers register appointment payments" ON public.appointment_payments;
CREATE POLICY "Barbers register appointment payments"
  ON public.appointment_payments FOR INSERT
  WITH CHECK (
    public.check_is_barber_of_shop(barbershop_id)
    AND EXISTS (
      SELECT 1
        FROM public.appointments a
        JOIN public.barbers b
          ON b.barbershop_id = a.barbershop_id
         AND b.user_id = auth.uid()
         AND b.active = true
       WHERE a.id = appointment_id
         AND a.barbershop_id = appointment_payments.barbershop_id
         AND (a.barber_id = b.id OR (a.barber_id IS NULL AND a.barber_name = b.name))
    )
  );

DROP FUNCTION IF EXISTS public.confirm_infinitepay_payment(uuid, numeric);
CREATE OR REPLACE FUNCTION public.confirm_infinitepay_payment(
  _appointment_id uuid,
  _amount_paid numeric,
  _payment_reference text,
  _expected_amount numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _appointment public.appointments%ROWTYPE;
  _existing_paid numeric(12,2);
  _total_price numeric(12,2);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF _appointment_id IS NULL OR _amount_paid IS NULL OR _amount_paid <= 0
    OR NULLIF(btrim(_payment_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid payment confirmation';
  END IF;

  SELECT * INTO _appointment
    FROM public.appointments
   WHERE id = _appointment_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointment_payments
     WHERE barbershop_id = _appointment.barbershop_id
       AND external_reference = _payment_reference
  ) THEN
    RETURN;
  END IF;
  IF _appointment.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled appointment cannot be paid';
  END IF;
  IF _appointment.payment_status = 'paid' THEN
    RETURN;
  END IF;

  _total_price := round(COALESCE(_appointment.total_price, _appointment.price), 2);
  SELECT GREATEST(
    COALESCE(sum(amount), 0),
    COALESCE(_appointment.advance_payment_amount, 0),
    COALESCE(_appointment.amount_paid, 0)
  )
    INTO _existing_paid
    FROM public.appointment_payments
   WHERE appointment_id = _appointment.id
     AND barbershop_id = _appointment.barbershop_id
     AND status = 'confirmed';
  _existing_paid := round(_existing_paid, 2);
  IF _total_price IS NULL OR _total_price <= 0
    OR round(_existing_paid + _amount_paid, 2) > _total_price + 0.02 THEN
    RAISE EXCEPTION 'Confirmed payments exceed appointment total';
  END IF;

  IF _appointment.payment_expected_amount IS NOT NULL
    AND (_expected_amount IS NULL
      OR round(_appointment.payment_expected_amount, 2) <> round(_expected_amount, 2)) THEN
    RAISE EXCEPTION 'Payment charge is no longer current';
  END IF;
  IF _expected_amount IS NOT NULL
    AND abs(round(_expected_amount, 2) - round(_amount_paid, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Payment amount does not match charge amount';
  END IF;

  INSERT INTO public.appointment_payments (
    appointment_id, barbershop_id, amount, payment_method, status, external_reference, notes
  ) VALUES (
    _appointment.id, _appointment.barbershop_id, round(_amount_paid, 2),
    'pix', 'confirmed', _payment_reference, 'Pagamento confirmado pela InfinitePay'
  )
  ON CONFLICT (barbershop_id, external_reference)
    WHERE external_reference IS NOT NULL DO NOTHING;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  _amount_paid := round(_existing_paid + _amount_paid, 2);

  UPDATE public.appointments
     SET status = CASE
           WHEN _appointment.status IN ('scheduled', 'completed') THEN _appointment.status
           ELSE 'confirmed'
         END,
         payment_status = CASE
           WHEN _amount_paid >= _total_price - 0.02
             THEN 'paid'
           ELSE 'partial'
         END,
         payment_confirmed_at = now(),
         amount_paid = _amount_paid,
         payment_id = NULL,
         payment_expected_amount = NULL,
         pix_code = NULL
   WHERE id = _appointment.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_booking_slots(uuid,timestamptz,timestamptz) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.get_public_booking_status(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.expire_public_booking(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_booking_slots(uuid,timestamptz,timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_booking_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_public_booking(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_infinitepay_payment(uuid,numeric,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_infinitepay_payment(uuid,numeric,text,numeric) TO service_role;
