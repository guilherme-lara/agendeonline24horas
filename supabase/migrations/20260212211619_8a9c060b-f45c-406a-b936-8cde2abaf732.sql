
-- Add payment tracking columns to appointments
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS payment_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_price numeric DEFAULT 0;

-- Copy price to total_price for existing records
UPDATE public.appointments SET total_price = price WHERE total_price = 0 AND price > 0;
