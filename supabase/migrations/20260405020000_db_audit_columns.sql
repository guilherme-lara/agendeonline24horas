-- DB AUDIT: Ensure critical columns exist + schema notification
-- 1. barbershops: plan_name, plan_status, trial_ends_at
-- 2. appointments: barber_id

ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS plan_name text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS setup_completed boolean DEFAULT false;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS barber_id uuid REFERENCES public.barbers(id);

-- Notify PostgREST to reload schema after structural changes
NOTIFY pgrst, 'reload schema';
