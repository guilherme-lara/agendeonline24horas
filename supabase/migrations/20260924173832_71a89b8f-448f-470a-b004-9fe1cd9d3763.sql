DO $mig$
DECLARE _def text; _new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO _def FROM pg_proc p
   WHERE p.proname='create_public_appointment' AND p.pronamespace='public'::regnamespace LIMIT 1;
  _new := regexp_replace(_def,
    'OR\s*\(a\.status IN \(''pending_payment'', ''pendente_pagamento'', ''pending'', ''pendente_sinal''\)\s*AND\s*\(a\.expires_at IS NULL OR a\.expires_at > NOW\(\)\)\)',
    'OR false', 'gi');
  IF _new = _def THEN
    RAISE EXCEPTION 'pattern not found';
  END IF;
  EXECUTE _new;
END $mig$;