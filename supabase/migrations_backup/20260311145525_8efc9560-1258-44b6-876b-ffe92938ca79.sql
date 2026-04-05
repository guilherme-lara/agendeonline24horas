
-- =============================================
-- HARDENING: Remove permissive USING(true) policies
-- Replace with barbershop_id owner-based access
-- =============================================

-- CUSTOMERS: Drop 4 permissive policies
DROP POLICY IF EXISTS "Permitir leitura" ON public.customers;
DROP POLICY IF EXISTS "Permitir insercao" ON public.customers;
DROP POLICY IF EXISTS "Permitir atualizacao" ON public.customers;
DROP POLICY IF EXISTS "Permitir exclusao" ON public.customers;
-- Also drop the broken policy comparing auth.uid() = barbershop_id
DROP POLICY IF EXISTS "Acesso total aos próprios clientes" ON public.customers;

-- EXPENSES: Drop 4 permissive policies
DROP POLICY IF EXISTS "Permitir leitura" ON public.expenses;
DROP POLICY IF EXISTS "Permitir insercao" ON public.expenses;
DROP POLICY IF EXISTS "Permitir atualizacao" ON public.expenses;
DROP POLICY IF EXISTS "Permitir exclusao" ON public.expenses;
DROP POLICY IF EXISTS "Acesso total as próprias despesas" ON public.expenses;

-- INVENTORY: Drop 4 permissive policies
DROP POLICY IF EXISTS "Permitir leitura" ON public.inventory;
DROP POLICY IF EXISTS "Permitir insercao" ON public.inventory;
DROP POLICY IF EXISTS "Permitir atualizacao" ON public.inventory;
DROP POLICY IF EXISTS "Permitir exclusao" ON public.inventory;

-- PACKAGES: Drop 4 permissive policies
DROP POLICY IF EXISTS "Permitir leitura" ON public.packages;
DROP POLICY IF EXISTS "Permitir insercao" ON public.packages;
DROP POLICY IF EXISTS "Permitir atualizacao" ON public.packages;
DROP POLICY IF EXISTS "Permitir exclusao" ON public.packages;
DROP POLICY IF EXISTS "Acesso total aos próprios pacotes" ON public.packages;

-- SERVICES: Drop 4 permissive policies
DROP POLICY IF EXISTS "Permitir leitura" ON public.services;
DROP POLICY IF EXISTS "Permitir insercao" ON public.services;
DROP POLICY IF EXISTS "Permitir atualizacao" ON public.services;
DROP POLICY IF EXISTS "Permitir exclusao" ON public.services;
