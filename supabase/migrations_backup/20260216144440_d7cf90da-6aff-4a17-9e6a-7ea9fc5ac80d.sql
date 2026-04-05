
-- Add avatar_url column to barbers table
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';

-- Create storage policy for barber avatars (bucket 'logos' already exists and is public)
-- We'll reuse the existing 'logos' bucket for barber photos
