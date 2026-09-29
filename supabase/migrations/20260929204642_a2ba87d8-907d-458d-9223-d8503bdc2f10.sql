ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS comanda_number bigint,
  ADD COLUMN IF NOT EXISTS commission_pct numeric,
  ADD COLUMN IF NOT EXISTS commission_amount numeric;

-- Backfill numbers
WITH n AS (
  SELECT id, row_number() OVER (PARTITION BY barbershop_id ORDER BY created_at, id) rn FROM public.appointments
)
UPDATE public.appointments a SET comanda_number = n.rn FROM n WHERE n.id = a.id AND a.comanda_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_shop_comanda_number_uidx ON public.appointments(barbershop_id, comanda_number);

CREATE OR REPLACE FUNCTION public.assign_comanda_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtext('comanda_' || NEW.barbershop_id::text));
    SELECT COALESCE(MAX(comanda_number), 0) + 1 INTO NEW.comanda_number
      FROM public.appointments WHERE barbershop_id = NEW.barbershop_id;
  ELSE
    NEW.comanda_number := OLD.comanda_number;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_assign_comanda_number ON public.appointments;
CREATE TRIGGER trg_assign_comanda_number BEFORE INSERT OR UPDATE OF comanda_number ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.assign_comanda_number();

-- Commission freeze on completion
CREATE OR REPLACE FUNCTION public.freeze_appointment_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pct numeric;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed' OR NEW.commission_pct IS NULL) THEN
    IF NEW.barber_id IS NOT NULL THEN
      SELECT bs.commission_pct INTO _pct
        FROM public.barber_services bs JOIN public.services s ON s.id = bs.service_id
       WHERE bs.barber_id = NEW.barber_id AND s.barbershop_id = NEW.barbershop_id AND s.name = NEW.service_name
       LIMIT 1;
      IF _pct IS NULL THEN SELECT commission_pct INTO _pct FROM public.barbers WHERE id = NEW.barber_id; END IF;
    END IF;
    IF _pct IS NULL THEN SELECT default_commission INTO _pct FROM public.barbershops WHERE id = NEW.barbershop_id; END IF;
    _pct := COALESCE(_pct, 0);
    NEW.commission_pct := _pct;
    NEW.commission_amount := round(COALESCE(NEW.total_price, NEW.price, 0) * _pct / 100, 2);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_freeze_commission ON public.appointments;
CREATE TRIGGER trg_freeze_commission BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.freeze_appointment_commission();

-- Audit log
CREATE TABLE public.comanda_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  comanda_number bigint,
  actor_id uuid,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.comanda_audit_log TO authenticated;
GRANT ALL ON public.comanda_audit_log TO service_role;
ALTER TABLE public.comanda_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins read audit" ON public.comanda_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = barbershop_id AND b.owner_id = auth.uid()));
CREATE INDEX comanda_audit_log_appt_idx ON public.comanda_audit_log(appointment_id);

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  barbershop_id uuid REFERENCES public.barbershops(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Audit + notification trigger
CREATE OR REPLACE FUNCTION public.appointment_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner uuid; _barber_user uuid; _code text; _action text := NULL; _when text;
BEGIN
  SELECT owner_id INTO _owner FROM public.barbershops WHERE id = NEW.barbershop_id;
  IF NEW.barber_id IS NOT NULL THEN SELECT user_id INTO _barber_user FROM public.barbers WHERE id = NEW.barber_id; END IF;
  _code := 'CMD-' || lpad(COALESCE(NEW.comanda_number,0)::text, 6, '0');
  _when := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI');

  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    IF _owner IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, barbershop_id, type, title, body, link)
      VALUES (_owner, NEW.barbershop_id, 'new_appointment', 'Novo agendamento',
        COALESCE(NEW.client_name,'Cliente') || ' • ' || NEW.service_name || ' • ' || _when || ' com ' || COALESCE(NEW.barber_name,'a equipe'), '/dashboard/agenda');
    END IF;
    IF _barber_user IS NOT NULL AND _barber_user IS DISTINCT FROM _owner THEN
      INSERT INTO public.notifications(user_id, barbershop_id, type, title, body, link)
      VALUES (_barber_user, NEW.barbershop_id, 'new_appointment', 'Novo agendamento na sua agenda',
        COALESCE(NEW.client_name,'Cliente') || ' • ' || NEW.service_name || ' • ' || _when, '/profissional');
    END IF;
  ELSE
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      _action := 'completed';
      IF _owner IS NOT NULL AND NOT COALESCE(NEW.commission_approved,false) THEN
        INSERT INTO public.notifications(user_id, barbershop_id, type, title, body, link)
        VALUES (_owner, NEW.barbershop_id, 'commission_pending', 'Comanda ' || _code || ' aguardando aprovação',
          COALESCE(NEW.barber_name,'Profissional') || ' • R$ ' || to_char(COALESCE(NEW.total_price,NEW.price,0),'FM999G990D00'), '/dashboard/aprovacoes');
      END IF;
    ELSIF NEW.commission_approved AND NOT COALESCE(OLD.commission_approved,false) THEN
      _action := 'commission_approved';
      IF _barber_user IS NOT NULL THEN
        INSERT INTO public.notifications(user_id, barbershop_id, type, title, body, link)
        VALUES (_barber_user, NEW.barbershop_id, 'commission_approved', 'Comissão liberada • ' || _code,
          'Sua comissão de R$ ' || to_char(COALESCE(NEW.commission_amount,0),'FM999G990D00') || ' foi liberada. Tudo certo!', '/profissional');
      END IF;
    ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
      _action := 'cancelled';
    ELSIF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
      _action := 'paid';
    END IF;
  END IF;

  IF _action IS NOT NULL THEN
    INSERT INTO public.comanda_audit_log(appointment_id, barbershop_id, comanda_number, actor_id, action, payload)
    VALUES (NEW.id, NEW.barbershop_id, NEW.comanda_number, auth.uid(), _action,
      jsonb_build_object('status', NEW.status, 'payment_status', NEW.payment_status, 'total', COALESCE(NEW.total_price,NEW.price),
        'commission_pct', NEW.commission_pct, 'commission_amount', NEW.commission_amount, 'barber', NEW.barber_name));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_appointment_events ON public.appointments;
CREATE TRIGGER trg_appointment_events AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.appointment_events();

-- Item audit
CREATE OR REPLACE FUNCTION public.appointment_item_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop uuid; _num bigint;
BEGIN
  SELECT barbershop_id, comanda_number INTO _shop, _num FROM public.appointments WHERE id = NEW.appointment_id;
  IF _shop IS NOT NULL THEN
    INSERT INTO public.comanda_audit_log(appointment_id, barbershop_id, comanda_number, actor_id, action, payload)
    VALUES (NEW.appointment_id, _shop, _num, auth.uid(), 'item_added', jsonb_build_object('item', NEW.service_name, 'price', NEW.price));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_appointment_item_audit ON public.appointment_items;
CREATE TRIGGER trg_appointment_item_audit AFTER INSERT ON public.appointment_items
FOR EACH ROW EXECUTE FUNCTION public.appointment_item_audit();

-- Backfill commission for already completed
UPDATE public.appointments SET commission_pct = NULL WHERE status = 'completed' AND commission_pct IS NULL;