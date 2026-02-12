
-- Add commission_pct to barbers
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS commission_pct numeric NOT NULL DEFAULT 0;

-- Create inventory table
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 5,
  cost_price numeric NOT NULL DEFAULT 0,
  sell_price numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'geral',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own inventory"
ON public.inventory FOR ALL
USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can view all inventory"
ON public.inventory FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create stock movements table
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entry', 'exit')),
  quantity integer NOT NULL,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own movements"
ON public.stock_movements FOR ALL
USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can view all movements"
ON public.stock_movements FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for inventory updated_at
CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add default_commission to barbershops for onboarding
ALTER TABLE public.barbershops ADD COLUMN IF NOT EXISTS default_commission numeric NOT NULL DEFAULT 0;
