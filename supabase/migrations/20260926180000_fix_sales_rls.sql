-- Fix RLS policy on sales and sales_items for barbershop staff and professionals
DO $$
BEGIN
  -- Check if sales table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
    ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

    -- Drop existing restrictive policy if any
    DROP POLICY IF EXISTS "Enable all for shop members on sales" ON public.sales;
    DROP POLICY IF EXISTS "Owners manage sales" ON public.sales;
    DROP POLICY IF EXISTS "Barbers manage sales" ON public.sales;
    DROP POLICY IF EXISTS "Authenticated users manage sales" ON public.sales;
    DROP POLICY IF EXISTS "Shop members and creators manage sales" ON public.sales;

    -- Allow owners, barbers of the shop, admins, and the creator
    CREATE POLICY "Shop members and creators manage sales"
      ON public.sales FOR ALL
      TO authenticated
      USING (
        barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
        OR (public.check_is_barber_of_shop(barbershop_id))
        OR (public.has_role(auth.uid(), 'admin'::public.app_role))
        OR (created_by = auth.uid())
      )
      WITH CHECK (
        barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
        OR (public.check_is_barber_of_shop(barbershop_id))
        OR (public.has_role(auth.uid(), 'admin'::public.app_role))
        OR (created_by = auth.uid())
      );
  END IF;

  -- Check if sales_items table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_items') THEN
    ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Shop members manage sales_items" ON public.sales_items;

    CREATE POLICY "Shop members manage sales_items"
      ON public.sales_items FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.sales s
          WHERE s.id = sales_items.sale_id
          AND (
            s.barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
            OR (public.check_is_barber_of_shop(s.barbershop_id))
            OR (public.has_role(auth.uid(), 'admin'::public.app_role))
            OR (s.created_by = auth.uid())
          )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.sales s
          WHERE s.id = sales_items.sale_id
          AND (
            s.barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
            OR (public.check_is_barber_of_shop(s.barbershop_id))
            OR (public.has_role(auth.uid(), 'admin'::public.app_role))
            OR (s.created_by = auth.uid())
          )
        )
      );
  END IF;
END $$;
