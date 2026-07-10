
-- 1. Campos de aprovação de comissão
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS commission_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS commission_approved_by uuid;

-- 2. Recálculo automático do total do agendamento a partir dos itens da comanda
CREATE OR REPLACE FUNCTION public.recalc_appointment_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _appt uuid := COALESCE(NEW.appointment_id, OLD.appointment_id);
  _sum numeric;
  _count integer;
BEGIN
  IF _appt IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(price), 0), COUNT(*)
    INTO _sum, _count
    FROM public.appointment_items
   WHERE appointment_id = _appt;

  -- Só sobrescreve o total quando existem itens vinculados
  IF _count > 0 THEN
    UPDATE public.appointments
       SET price = _sum,
           total_price = _sum,
           updated_at = now()
     WHERE id = _appt;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_appointment_total ON public.appointment_items;
CREATE TRIGGER trg_recalc_appointment_total
AFTER INSERT OR UPDATE OR DELETE ON public.appointment_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_appointment_total();

-- 3. Trava: apenas gerente (owner) ou admin pode alterar campos de comissão
CREATE OR REPLACE FUNCTION public.enforce_commission_approval_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_manager boolean;
BEGIN
  IF NEW.commission_approved IS DISTINCT FROM OLD.commission_approved
     OR NEW.commission_approved_by IS DISTINCT FROM OLD.commission_approved_by
     OR NEW.commission_approved_at IS DISTINCT FROM OLD.commission_approved_at THEN

    SELECT (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.barbershops b
        WHERE b.id = NEW.barbershop_id AND b.owner_id = auth.uid()
      )
    ) INTO _is_manager;

    IF NOT COALESCE(_is_manager, false) THEN
      RAISE EXCEPTION 'Apenas o gerente pode liberar a comissão desta comanda';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_commission_lock ON public.appointments;
CREATE TRIGGER trg_enforce_commission_lock
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_commission_approval_lock();

-- 4. RPC segura para o gerente liberar a comissão
CREATE OR REPLACE FUNCTION public.approve_appointment_commission(_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop uuid;
BEGIN
  SELECT barbershop_id INTO _shop FROM public.appointments WHERE id = _appointment_id;
  IF _shop IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops WHERE id = _shop AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para liberar a comissão';
  END IF;

  UPDATE public.appointments
     SET commission_approved = true,
         commission_approved_at = now(),
         commission_approved_by = auth.uid(),
         updated_at = now()
   WHERE id = _appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_appointment_commission(uuid) TO authenticated;

-- 5. RLS de appointment_items: profissional gerencia itens dos próprios atendimentos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_items TO authenticated;
GRANT ALL ON public.appointment_items TO service_role;

DROP POLICY IF EXISTS "Barbers can view own appointment items" ON public.appointment_items;
CREATE POLICY "Barbers can view own appointment items"
ON public.appointment_items FOR SELECT TO authenticated
USING (
  appointment_id IN (
    SELECT a.id FROM public.appointments a
    WHERE a.barber_id = (SELECT b.id FROM public.barbers b WHERE b.user_id = auth.uid() LIMIT 1)
       OR a.barber_name = (SELECT b.name FROM public.barbers b WHERE b.user_id = auth.uid() LIMIT 1)
  )
);

DROP POLICY IF EXISTS "Barbers can add items to own appointments" ON public.appointment_items;
CREATE POLICY "Barbers can add items to own appointments"
ON public.appointment_items FOR INSERT TO authenticated
WITH CHECK (
  appointment_id IN (
    SELECT a.id FROM public.appointments a
    WHERE a.barber_id = (SELECT b.id FROM public.barbers b WHERE b.user_id = auth.uid() LIMIT 1)
       OR a.barber_name = (SELECT b.name FROM public.barbers b WHERE b.user_id = auth.uid() LIMIT 1)
  )
);

DROP POLICY IF EXISTS "Owners can manage barbershop appointment items" ON public.appointment_items;
CREATE POLICY "Owners can manage barbershop appointment items"
ON public.appointment_items FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR appointment_id IN (
    SELECT a.id FROM public.appointments a
    JOIN public.barbershops b ON b.id = a.barbershop_id
    WHERE b.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR appointment_id IN (
    SELECT a.id FROM public.appointments a
    JOIN public.barbershops b ON b.id = a.barbershop_id
    WHERE b.owner_id = auth.uid()
  )
);
