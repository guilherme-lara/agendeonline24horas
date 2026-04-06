-- ============================================================
-- Trial Backfill: Fix null trial data for existing barbershops
-- ============================================================

-- Set pro plan with 30-day trial for all barbershops missing trial data
UPDATE public.barbershops
SET plan_name = 'pro',
    plan_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '30 days'
WHERE trial_ends_at IS NULL
   OR plan_status IS NULL
   OR plan_status NOT IN ('trialing', 'active', 'expired');
