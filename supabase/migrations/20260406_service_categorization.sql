-- ============================================================
-- MISSION: SERVICE CATEGORIZATION
-- Add category and price_is_starting_at to services table
-- ============================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Geral';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price_is_starting_at boolean NOT NULL DEFAULT false;
