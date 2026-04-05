
-- 1. Add user_id to barbers table (links barber to auth account)
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Add 'barber' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'barber';

-- 3. RLS: Barbers can view their own appointments
CREATE POLICY "Barbers can view own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  barber_name = (
    SELECT b.name FROM public.barbers b 
    WHERE b.user_id = auth.uid() 
    LIMIT 1
  )
);

-- 4. RLS: Barbers can update own appointments (mark as done)
CREATE POLICY "Barbers can update own appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  barber_name = (
    SELECT b.name FROM public.barbers b 
    WHERE b.user_id = auth.uid() 
    LIMIT 1
  )
)
WITH CHECK (
  barber_name = (
    SELECT b.name FROM public.barbers b 
    WHERE b.user_id = auth.uid() 
    LIMIT 1
  )
);

-- 5. RLS: Barbers can view orders linked to them
CREATE POLICY "Barbers can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  barber_name = (
    SELECT b.name FROM public.barbers b 
    WHERE b.user_id = auth.uid() 
    LIMIT 1
  )
);

-- 6. RLS: Barbers can read their own barber record
CREATE POLICY "Barbers can view own record"
ON public.barbers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 7. RLS: Barbers can read services (needed for dashboard)
CREATE POLICY "Barbers can view barbershop services"
ON public.services
FOR SELECT
TO authenticated
USING (
  barbershop_id IN (
    SELECT b.barbershop_id FROM public.barbers b WHERE b.user_id = auth.uid()
  )
);
