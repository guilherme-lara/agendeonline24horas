CREATE POLICY "Owners can view own appointment items"
ON public.appointment_items
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR appointment_id IN (
    SELECT a.id FROM public.appointments a
    JOIN public.barbershops b ON b.id = a.barbershop_id
    WHERE b.owner_id = auth.uid()
  )
);