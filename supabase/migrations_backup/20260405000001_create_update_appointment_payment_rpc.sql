-- RPC function for atomic, secure payment confirmation
-- Uses SECURITY DEFINER to bypass RLS and update safely

CREATE OR REPLACE FUNCTION public.update_appointment_payment(
  _appt_id uuid,
  _amount_paid numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure the appointment exists before updating
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE id = _appt_id) THEN
    RAISE EXCEPTION 'Appointment % not found', _appt_id;
  END IF;

  UPDATE public.appointments
  SET
    status = 'confirmed',
    payment_status = 'paid',
    payment_confirmed_at = now(),
    amount_paid = COALESCE(_amount_paid, 0)
  WHERE id = _appt_id;

  RAISE LOG 'Payment confirmed for appointment % with amount %', _appt_id, _amount_paid;
END;
$$;
