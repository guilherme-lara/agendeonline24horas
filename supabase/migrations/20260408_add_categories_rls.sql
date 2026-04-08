-- ==========================================
-- Add RLS Policies for Categories Table
-- ==========================================

-- Enable RLS on categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public (anon) to read active categories for storefront
CREATE POLICY "Public can read active categories"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Policy: Allow authenticated users to manage categories (create, update, delete)
-- Adjust as needed for role-based access (e.g., only admins)
CREATE POLICY "Authenticated users can manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Optional: More restrictive policy for admins only
-- CREATE POLICY "Admins can manage categories"
--   ON public.categories FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_roles ur
--       JOIN profiles p ON ur.user_id = p.id
--       WHERE p.id = auth.uid() AND ur.role = 'admin'
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM user_roles ur
--       JOIN profiles p ON ur.user_id = p.id
--       WHERE p.id = auth.uid() AND ur.role = 'admin'
--     )
--   );