-- CRITICAL BUG FIXES
-- 1. Add last_seen to customers table (PublicBooking uses it)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- 2. Add barber_id column to appointments table
--    (Previously we only had barber_name string, causing filtering bugs)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS barber_id uuid REFERENCES public.barbers(id);

-- 3. Fix auto-cancel function: match 'pendente_pagamento' status and 'pix' payment_method
--    Also schedule it via pg_cron
CREATE OR REPLACE FUNCTION public.cancel_expired_pix_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled',
      payment_status = 'expired',
      updated_at = now()
  WHERE status IN ('pending', 'pendente_pagamento', 'pendente_sinal')
    AND payment_method IN ('pix', 'pix_online', 'pix_infinitepay', 'pix_static')
    AND payment_status IN ('pending', 'awaiting')
    AND created_at < now() - interval '15 minutes'
    AND payment_confirmed_at IS NULL;

  -- Log how many were cancelled (useful for monitoring)
  RAISE NOTICE 'Cancelled expired PIX appointments: %', SQL%ROWCOUNT;
END;
$function$;

-- Schedule auto-cancel every 5 minutes via pg_cron
-- This requires the pg_cron extension to be enabled in Supabase
DO $$
BEGIN
  -- Try to schedule; ignore if already exists
  BEGIN
    PERFORM cron.schedule(
      'cancel-expired-pix',
      '*/5 * * * *',
      'SELECT public.cancel_expired_pix_appointments()'
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_cron may not be enabled; log silently
    RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
  END;
END;
$$;

-- 4. Improve create_public_appointment RPC with advisory lock against race conditions
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
  _lock_key bigint;
BEGIN
  -- Get service duration and advance payment info
  SELECT duration, COALESCE(requires_advance_payment, false)
  INTO _duration, _requires_advance
  FROM public.services
  WHERE barbershop_id = _barbershop_id AND name = _service_name AND active = true
  LIMIT 1;

  IF _duration IS NULL THEN _duration := 30; END IF;
  IF _requires_advance IS NULL THEN _requires_advance := false; END IF;

  -- Advisory lock: prevent concurrent bookings at the same barbershop
  -- Use a hash of the barbershop_id as the lock key
  _lock_key := ('x' || substring(md5(_barbershop_id::text), 1, 16))::bigint;
  PERFORM pg_advisory_xact_lock(_lock_key);

  -- Re-check for conflicts AFTER acquiring the lock
  SELECT COUNT(*) INTO _conflict_count
  FROM public.appointments
  WHERE barbershop_id = _barbershop_id
    AND status NOT IN ('cancelled', 'expired')
    AND scheduled_at < (_scheduled_at + (_duration + 10) * interval '1 minute')
    AND (scheduled_at + COALESCE(
      (SELECT s.duration FROM public.services s WHERE s.barbershop_id = _barbershop_id AND s.name = appointments.service_name AND s.active = true LIMIT 1),
      30
    ) * interval '1 minute' + interval '10 minutes') > _scheduled_at;

  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'Horario indisponivel. Ja existe um agendamento neste periodo.';
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
$function$;

-- 5. Log webhook events to payment_logs table
--    (This is done in the Edge Function code fix, not SQL)
