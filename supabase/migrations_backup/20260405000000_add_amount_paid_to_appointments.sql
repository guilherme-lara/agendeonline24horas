
-- Add amount_paid column to track exactly how much was paid via InfinitePay
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) DEFAULT 0;

-- Set amount_paid = total_price for already confirmed appointments
UPDATE public.appointments
  SET amount_paid = total_price
  WHERE status = 'confirmed' AND total_price > 0;
