-- Add pix_code column to appointments for recovery on page refresh
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS pix_code text DEFAULT '';
