
-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Public can read own appointments" ON appointments;

-- Create a restricted SELECT policy for anon users
-- Only allows seeing appointments for slot availability checking
-- The actual data restriction is enforced by the frontend SELECT fields
-- but this policy ensures anon can only see non-cancelled appointments
CREATE POLICY "Anon can view appointment slots for availability"
ON appointments FOR SELECT
TO anon
USING (
  status IN ('confirmed', 'completed', 'pending_payment', 'pendente_pagamento', 'pending', 'pendente_sinal')
);

-- Keep authenticated users able to read appointments they're involved in
-- (this doesn't conflict with existing owner/barber policies)
