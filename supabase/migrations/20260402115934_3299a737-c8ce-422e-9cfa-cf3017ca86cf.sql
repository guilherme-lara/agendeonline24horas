CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid REFERENCES public.barbershops(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'webhook',
  event_type text NOT NULL DEFAULT '',
  status_code integer,
  request_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_body jsonb DEFAULT '{}'::jsonb,
  payment_id text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment_logs" ON public.payment_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can view own payment_logs" ON public.payment_logs
  FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));