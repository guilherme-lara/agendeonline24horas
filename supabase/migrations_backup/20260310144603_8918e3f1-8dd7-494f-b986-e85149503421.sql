
-- Tabela para armazenar secrets sensíveis por barbearia (API keys)
-- Separada da tabela barbershops para não expor em queries públicas
CREATE TABLE IF NOT EXISTS public.barbershop_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  infinitepay_token text DEFAULT '',
  webhook_secret text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(barbershop_id)
);

ALTER TABLE public.barbershop_secrets ENABLE ROW LEVEL SECURITY;

-- Apenas o dono pode ler/escrever seus próprios secrets
CREATE POLICY "Owners can manage own secrets"
ON public.barbershop_secrets
FOR ALL
TO authenticated
USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()))
WITH CHECK (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

-- Admins podem visualizar
CREATE POLICY "Admins can view secrets"
ON public.barbershop_secrets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de logs do webhook para auditoria e idempotência
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid REFERENCES public.barbershops(id),
  event_type text NOT NULL DEFAULT '',
  payment_id text DEFAULT '',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own webhook logs"
ON public.webhook_logs
FOR SELECT
TO authenticated
USING (barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Admins can view all webhook logs"
ON public.webhook_logs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
