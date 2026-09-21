-- ============================================================
-- CRIAÇÃO DE ESCALA E FOLGAS PARA OS PROFISSIONAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.professional_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Domingo, 6 = Sábado
  is_working BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (barber_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.professional_time_offs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- Habilitar RLS
ALTER TABLE public.professional_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_time_offs ENABLE ROW LEVEL SECURITY;

-- Triggers de updated_at para schedules
CREATE TRIGGER trg_professional_schedules_updated_at
  BEFORE UPDATE ON public.professional_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================

-- Gestores podem gerenciar as escalas de todos os profissionais de suas clínicas
CREATE POLICY "Gestores gerenciam escalas"
  ON public.professional_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barbers
      JOIN public.barbershops ON barbers.barbershop_id = barbershops.id
      WHERE barbers.id = professional_schedules.barber_id
      AND (barbershops.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

-- O Profissional pode ver apenas a própria escala
CREATE POLICY "Profissionais veem suas proprias escalas"
  ON public.professional_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barbers
      WHERE barbers.id = professional_schedules.barber_id
      AND barbers.user_id = auth.uid()
    )
  );

-- Gestores podem gerenciar as folgas de todos os profissionais de suas clínicas
CREATE POLICY "Gestores gerenciam folgas"
  ON public.professional_time_offs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barbers
      JOIN public.barbershops ON barbers.barbershop_id = barbershops.id
      WHERE barbers.id = professional_time_offs.barber_id
      AND (barbershops.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

-- O Profissional pode ver apenas as próprias folgas
CREATE POLICY "Profissionais veem suas proprias folgas"
  ON public.professional_time_offs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barbers
      WHERE barbers.id = professional_time_offs.barber_id
      AND barbers.user_id = auth.uid()
    )
  );
