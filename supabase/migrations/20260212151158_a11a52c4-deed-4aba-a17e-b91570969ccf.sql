
-- Create barbers table for team management
CREATE TABLE public.barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

-- Owners can manage their barbers
CREATE POLICY "Owners can manage own barbers"
ON public.barbers
FOR ALL
USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

-- Public can view active barbers (for booking page)
CREATE POLICY "Public can view active barbers"
ON public.barbers
FOR SELECT
USING (active = true);

-- Admins can view all barbers
CREATE POLICY "Admins can view all barbers"
ON public.barbers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Storage policies for logos
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete own logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Add logo_url column to barbershops
ALTER TABLE public.barbershops ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';
