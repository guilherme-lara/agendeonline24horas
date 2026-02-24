
-- Modulo 6: Colunas de sinal nos servicos
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS requires_advance_payment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS advance_payment_value NUMERIC(10, 2) DEFAULT 0;

-- Modulo 3: Fix RLS upgrade_requests (policies atuais comparam auth.uid() com barbershop_id incorretamente)
DROP POLICY IF EXISTS "Donos podem criar solicitações" ON public.upgrade_requests;
DROP POLICY IF EXISTS "Donos podem ver suas próprias solicitações" ON public.upgrade_requests;

CREATE POLICY "Owners can insert upgrade requests" ON public.upgrade_requests
  FOR INSERT WITH CHECK (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can view own upgrade requests" ON public.upgrade_requests
  FOR SELECT USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())
  );

CREATE POLICY "Admins can view all upgrade requests" ON public.upgrade_requests
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update upgrade requests" ON public.upgrade_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
