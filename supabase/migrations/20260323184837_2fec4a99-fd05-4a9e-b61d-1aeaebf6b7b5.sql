-- 1. Admin full access on orders (currently only SELECT)
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Admin full access on appointments (currently only SELECT + UPDATE separately)
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can update all appointments" ON public.appointments;
CREATE POLICY "Admins can manage all appointments"
  ON public.appointments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Admin full access on inventory
DROP POLICY IF EXISTS "Admins can view all inventory" ON public.inventory;
CREATE POLICY "Admins can manage all inventory"
  ON public.inventory FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Admin full access on services
DROP POLICY IF EXISTS "Admins can view all services" ON public.services;
CREATE POLICY "Admins can manage all services"
  ON public.services FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Admin full access on barbers
DROP POLICY IF EXISTS "Admins can view all barbers" ON public.barbers;
CREATE POLICY "Admins can manage all barbers"
  ON public.barbers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Admin full access on customers
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
CREATE POLICY "Admins can manage all customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Admin full access on expenses
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
CREATE POLICY "Admins can manage all expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 8. Admin full access on stock_movements
DROP POLICY IF EXISTS "Admins can view all movements" ON public.stock_movements;
CREATE POLICY "Admins can manage all movements"
  ON public.stock_movements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
