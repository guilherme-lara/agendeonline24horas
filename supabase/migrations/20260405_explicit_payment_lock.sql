-- ============================================================
-- 3-Minute Payment Lock / Auto-Cancel
-- ============================================================

-- 1. Add expires_at column
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Cleanup RPC: cancels expired pending_payment appointments
CREATE OR REPLACE FUNCTION public.cleanup_expired_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled'
  WHERE status = 'pendente_pagamento'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$;
