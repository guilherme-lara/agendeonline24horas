
-- ============================================================
-- FASE 1: PDV + Split Payments + Janela de Confirmação
-- Convenção do projeto: clinic = barbershops, professional = barbers
-- ============================================================

-- ---------- 1. CASH REGISTERS ----------
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  opened_by UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_balance NUMERIC(12,2),
  expected_balance NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas 1 caixa aberto por clínica ao mesmo tempo
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_registers_one_open_per_shop
  ON public.cash_registers (barbershop_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_cash_registers_shop ON public.cash_registers (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON public.cash_registers (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_registers TO authenticated;
GRANT ALL ON public.cash_registers TO service_role;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

-- Dono / admin
CREATE POLICY "Owners manage cash registers"
  ON public.cash_registers FOR ALL
  USING (
    barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Profissional (barber) da mesma clínica pode ver e operar
CREATE POLICY "Barbers view shop cash registers"
  ON public.cash_registers FOR SELECT
  USING (public.check_is_barber_of_shop(barbershop_id));

CREATE POLICY "Barbers open cash registers"
  ON public.cash_registers FOR INSERT
  WITH CHECK (public.check_is_barber_of_shop(barbershop_id));

CREATE POLICY "Barbers close own open register"
  ON public.cash_registers FOR UPDATE
  USING (public.check_is_barber_of_shop(barbershop_id))
  WITH CHECK (public.check_is_barber_of_shop(barbershop_id));

CREATE TRIGGER trg_cash_registers_updated_at
  BEFORE UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- 2. CASH MOVEMENTS ----------
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale','sangria','suprimento','refund','adjustment')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT CHECK (payment_method IN ('pix','credit_card','debit_card','cash','transfer','other')),
  description TEXT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON public.cash_movements (register_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_shop ON public.cash_movements (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON public.cash_movements (type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage cash movements"
  ON public.cash_movements FOR ALL
  USING (
    barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Barbers view shop movements"
  ON public.cash_movements FOR SELECT
  USING (public.check_is_barber_of_shop(barbershop_id));

CREATE POLICY "Barbers insert movements on shop"
  ON public.cash_movements FOR INSERT
  WITH CHECK (public.check_is_barber_of_shop(barbershop_id));


-- ---------- 3. APPOINTMENT PAYMENTS (Split Payments) ----------
CREATE TABLE IF NOT EXISTS public.appointment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix','credit_card','debit_card','cash','transfer','voucher','other')),
  installments INTEGER NOT NULL DEFAULT 1 CHECK (installments >= 1 AND installments <= 24),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','refunded','cancelled')),
  register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  external_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_payments_appt ON public.appointment_payments (appointment_id);
CREATE INDEX IF NOT EXISTS idx_appt_payments_shop ON public.appointment_payments (barbershop_id);
CREATE INDEX IF NOT EXISTS idx_appt_payments_register ON public.appointment_payments (register_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_payments TO authenticated;
GRANT ALL ON public.appointment_payments TO service_role;
ALTER TABLE public.appointment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage appointment payments"
  ON public.appointment_payments FOR ALL
  USING (
    barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Barbers view shop appointment payments"
  ON public.appointment_payments FOR SELECT
  USING (public.check_is_barber_of_shop(barbershop_id));

CREATE POLICY "Barbers register appointment payments"
  ON public.appointment_payments FOR INSERT
  WITH CHECK (public.check_is_barber_of_shop(barbershop_id));

CREATE TRIGGER trg_appt_payments_updated_at
  BEFORE UPDATE ON public.appointment_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- 4. SERVICES: garantir requires_advance_payment ----------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS requires_advance_payment BOOLEAN NOT NULL DEFAULT false;


-- ---------- 5. APPOINTMENTS: confirmação + adiantamento ----------
DO $$ BEGIN
  CREATE TYPE public.appointment_confirmation_status AS ENUM ('pending','confirmed','timeout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirmation_status public.appointment_confirmation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS advance_payment_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_status
  ON public.appointments (confirmation_status);
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_sent_at
  ON public.appointments (confirmation_sent_at);
