
-- Add payment_method column to track how client chose to pay
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'pix_online';

-- Add comment for clarity
COMMENT ON COLUMN public.appointments.payment_method IS 'Payment method: pix_online, local_cash, local_card, local_pix, manual';
