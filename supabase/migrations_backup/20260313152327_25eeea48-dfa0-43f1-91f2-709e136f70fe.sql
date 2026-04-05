
-- FIX CRÍTICO: Remove a política quebrada que compara auth.uid() com barbershop_id
DROP POLICY IF EXISTS "Acesso total as próprias comandas" ON public.orders;

-- Garante que webhook_logs permita INSERT via service_role (edge functions)
-- Já tem política para admins e owners, mas edge functions usam service_role que bypassa RLS
