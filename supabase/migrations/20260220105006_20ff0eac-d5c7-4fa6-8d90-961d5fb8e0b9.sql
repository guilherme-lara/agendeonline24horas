
-- ============================================================
-- 1. CUSTOMERS table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id            uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid NOT NULL,
  name          text NOT NULL,
  phone         text NOT NULL DEFAULT '',
  birth_date    date,
  notes         text DEFAULT '',
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_barbershop_id_fkey FOREIGN KEY (barbershop_id)
    REFERENCES public.barbershops (id) ON DELETE CASCADE
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own customers"
  ON public.customers FOR ALL
  USING  (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can view all customers"
  ON public.customers FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_customers_barbershop_id ON public.customers (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone        ON public.customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_birth_date   ON public.customers (birth_date);

-- ============================================================
-- 2. EXPENSES table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id            uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid NOT NULL,
  description   text NOT NULL,
  amount        numeric NOT NULL DEFAULT 0,
  date          date NOT NULL DEFAULT CURRENT_DATE,
  category      text NOT NULL DEFAULT 'outros',
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expenses_barbershop_id_fkey FOREIGN KEY (barbershop_id)
    REFERENCES public.barbershops (id) ON DELETE CASCADE
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own expenses"
  ON public.expenses FOR ALL
  USING  (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can view all expenses"
  ON public.expenses FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_expenses_barbershop_id ON public.expenses (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date          ON public.expenses (date);

-- ============================================================
-- 3. PACKAGES table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.packages (
  id            uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id uuid NOT NULL,
  name          text NOT NULL,
  price         numeric NOT NULL DEFAULT 0,
  quantity      integer NOT NULL DEFAULT 1,
  service_id    uuid,
  description   text DEFAULT '',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT packages_barbershop_id_fkey FOREIGN KEY (barbershop_id)
    REFERENCES public.barbershops (id) ON DELETE CASCADE,
  CONSTRAINT packages_service_id_fkey FOREIGN KEY (service_id)
    REFERENCES public.services (id) ON DELETE SET NULL
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own packages"
  ON public.packages FOR ALL
  USING  (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Public can view active packages"
  ON public.packages FOR SELECT
  USING (active = true);

CREATE INDEX IF NOT EXISTS idx_packages_barbershop_id ON public.packages (barbershop_id);

-- ============================================================
-- 4. ORDERS (Comandas) table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id             uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbershop_id  uuid NOT NULL,
  customer_id    uuid,
  appointment_id uuid,
  barber_name    text DEFAULT '',
  items          jsonb NOT NULL DEFAULT '[]'::jsonb,
  total          numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status         text NOT NULL DEFAULT 'open',
  notes          text DEFAULT '',
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_barbershop_id_fkey FOREIGN KEY (barbershop_id)
    REFERENCES public.barbershops (id) ON DELETE CASCADE,
  CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id)
    REFERENCES public.customers (id) ON DELETE SET NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own orders"
  ON public.orders FOR ALL
  USING  (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()))
  WITH CHECK (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_orders_barbershop_id ON public.orders (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id   ON public.orders (customer_id);

-- ============================================================
-- 5. updated_at triggers for new tables
-- ============================================================
CREATE OR REPLACE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. Storage bucket for barber photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('barber-photos', 'barber-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read barber photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'barber-photos');

CREATE POLICY "Authenticated upload barber photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'barber-photos');

CREATE POLICY "Authenticated update barber photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'barber-photos');
