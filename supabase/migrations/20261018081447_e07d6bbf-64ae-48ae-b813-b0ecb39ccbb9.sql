CREATE SCHEMA IF NOT EXISTS pdv_private;
REVOKE ALL ON SCHEMA pdv_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA pdv_private TO authenticated,service_role;
ALTER FUNCTION public.checkout_pdv(uuid,jsonb,jsonb,uuid,text,uuid,uuid,boolean) SET SCHEMA pdv_private;
DROP FUNCTION IF EXISTS public.checkout_pdv(uuid,jsonb,jsonb,uuid,text,uuid,uuid,boolean);
CREATE OR REPLACE FUNCTION public.checkout_pdv(_shop uuid, _items jsonb, _payments jsonb, _customer uuid DEFAULT NULL, _client_name text DEFAULT 'Cliente Balcão', _sale uuid DEFAULT NULL, _appointment uuid DEFAULT NULL, _complete boolean DEFAULT true)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT pdv_private.checkout_pdv(_shop,_items,_payments,_customer,_client_name,_sale,_appointment,_complete); $$;
REVOKE ALL ON FUNCTION public.checkout_pdv(uuid,jsonb,jsonb,uuid,text,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.checkout_pdv(uuid,jsonb,jsonb,uuid,text,uuid,uuid,boolean) TO authenticated,service_role;