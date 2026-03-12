-- 1. Add trial_ends_at to barbershops (30 days from creation by default)
ALTER TABLE public.barbershops 
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone DEFAULT (now() + interval '30 days');

-- Set existing barbershops trial to 30 days from now
UPDATE public.barbershops SET trial_ends_at = now() + interval '30 days' WHERE trial_ends_at IS NULL;

-- 2. Add validity_days to packages (default 30 days)
ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 30;