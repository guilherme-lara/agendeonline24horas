DROP TRIGGER IF EXISTS trg_freeze_commission ON public.appointments;
DROP TRIGGER IF EXISTS trg_calculate_appointment_commission ON public.appointments;
DROP FUNCTION IF EXISTS public.calculate_appointment_commission();
CREATE OR REPLACE FUNCTION public.calculate_appointment_commission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _pct numeric;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.status='completed' AND OLD.commission_amount IS NOT NULL AND OLD.commission_pct IS NOT NULL THEN
      NEW.commission_amount:=OLD.commission_amount; NEW.commission_pct:=OLD.commission_pct; RETURN NEW;
    END IF;
  END IF;
  IF NEW.status='completed' THEN
    IF NEW.barber_id IS NOT NULL THEN
      SELECT bs.commission_pct INTO _pct FROM public.barber_services bs JOIN public.services s ON s.id=bs.service_id WHERE bs.barber_id=NEW.barber_id AND bs.barbershop_id=NEW.barbershop_id AND s.barbershop_id=NEW.barbershop_id AND s.name=NEW.service_name LIMIT 1;
      IF _pct IS NULL THEN SELECT commission_pct INTO _pct FROM public.barbers WHERE id=NEW.barber_id AND barbershop_id=NEW.barbershop_id; END IF;
      IF _pct IS NULL THEN SELECT default_commission INTO _pct FROM public.barbershops WHERE id=NEW.barbershop_id; END IF;
    ELSE _pct:=0;
    END IF;
    NEW.commission_pct:=COALESCE(_pct,0);
    NEW.commission_amount:=round(COALESCE(NEW.total_price,NEW.price,0)*NEW.commission_pct/100,2);
  ELSE
    NEW.commission_pct:=NULL; NEW.commission_amount:=NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.calculate_appointment_commission() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_calculate_appointment_commission BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.calculate_appointment_commission();