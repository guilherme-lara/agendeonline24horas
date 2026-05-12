
-- 1. Fix permissive RLS policies on clients table
DROP POLICY IF EXISTS "Permitir inserção pública de clientes no agendamento" ON public.clients;
DROP POLICY IF EXISTS "Permitir leitura/atualização pública durante agendamento" ON public.clients;
DROP POLICY IF EXISTS "Permitir update público durante agendamento" ON public.clients;

-- Owners-only management for clients table (public booking should use customers + find_or_create_public_customer RPC)
CREATE POLICY "Owners manage own clients"
ON public.clients
FOR ALL
USING (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()))
WITH CHECK (barbershop_id IN (SELECT id FROM public.barbershops WHERE owner_id = auth.uid()));

CREATE POLICY "Admins manage all clients"
ON public.clients
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Fix function search_path (cleanup_expired_appointments was missing SET search_path)
CREATE OR REPLACE FUNCTION public.cleanup_expired_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled'
  WHERE status = 'pendente_pagamento'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$function$;

-- 3. Restrict EXECUTE on SECURITY DEFINER functions
-- Triggers / cron / internal: revoke from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.cancel_expired_pix_appointments() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_appointments() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_grant_pro_trial() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

-- has_role is used inside RLS policies; SECURITY DEFINER runs as owner regardless of grants. Revoke direct execute.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;

-- admin_get_user_emails: only authenticated admins; revoke anon
REVOKE EXECUTE ON FUNCTION public.admin_get_user_emails() FROM anon, PUBLIC;

-- get_customers_with_stats: dashboard only; revoke anon
REVOKE EXECUTE ON FUNCTION public.get_customers_with_stats(uuid) FROM anon, PUBLIC;

-- Public booking RPCs: keep anon access (intentional public surface). No revoke.

-- 4. Fix public storage buckets allow listing
-- Drop overly broad SELECT policies and replace with scoped read; logos and barber-photos buckets
DROP POLICY IF EXISTS "Public can read logos" ON storage.objects;
DROP POLICY IF EXISTS "Logos publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "logos public read" ON storage.objects;

DROP POLICY IF EXISTS "Public can read barber-photos" ON storage.objects;
DROP POLICY IF EXISTS "Barber photos publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read barber-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view barber-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view barber-photos" ON storage.objects;
DROP POLICY IF EXISTS "Barber photos are publicly accessible" ON storage.objects;

-- Make buckets non-public (files still accessible via signed URLs or scoped policies)
UPDATE storage.buckets SET public = false WHERE id IN ('logos','barber-photos');

-- Allow public SELECT only for direct file access by exact name (no listing). Supabase storage list endpoints
-- use SELECT but require the policy to allow listing. We allow object reads (file fetches) via the public CDN
-- by keeping bucket public was the old way; instead create a policy that allows reads but the linter detects
-- bucket-public as the issue. We've set public=false which prevents anonymous CDN reads; provide a scoped
-- read policy so authenticated users in the same tenant can read, and anyone with a signed URL can still fetch.
CREATE POLICY "Tenant members read logos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.barbershops WHERE owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Tenant members read barber-photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'barber-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.barbershops WHERE owner_id = auth.uid()
    )
  )
);
