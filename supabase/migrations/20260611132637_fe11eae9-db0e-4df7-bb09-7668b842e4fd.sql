-- Permite que profissionais (barbeiros) leiam os dados da própria barbearia
-- Necessário para o ProfessionalDashboard/useClinic carregarem nome, logo e plano
DROP POLICY IF EXISTS "Barbers can view own barbershop" ON public.barbershops;

CREATE POLICY "Barbers can view own barbershop"
ON public.barbershops
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT b.barbershop_id
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
  )
);