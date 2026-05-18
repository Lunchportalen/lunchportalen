-- Fjerner orders_delete_none, orders_insert_none, orders_update_none.
-- Disse er PERMISSIVE policies på public.orders med qual=false /
-- with_check=false. Postgres evaluerer permissive policies med OR,
-- så _none-policies har null semantisk effekt så lenge ekte
-- policies (orders_delete, orders_insert, orders_update) eksisterer.
--
-- FASE P3.D4-PARTIAL. Reduserer multiple_permissive_policies
-- advisor-warnings fra 4 til 1 (SELECT-konsolidering gjenstår).
--
-- Idempotent (DROP POLICY IF EXISTS). Ingen semantisk endring i
-- tilgang. Verifisert mot prod 2026-05-18 i FASE P3.D4-AUDIT.
--
-- Rollback (hvis nødvendig — kjør manuelt, ikke i migrasjon):
--   CREATE POLICY orders_delete_none ON public.orders
--     FOR DELETE TO authenticated USING (false);
--   CREATE POLICY orders_insert_none ON public.orders
--     FOR INSERT TO authenticated WITH CHECK (false);
--   CREATE POLICY orders_update_none ON public.orders
--     FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

BEGIN;

DROP POLICY IF EXISTS orders_delete_none ON public.orders;
DROP POLICY IF EXISTS orders_insert_none ON public.orders;
DROP POLICY IF EXISTS orders_update_none ON public.orders;

COMMIT;
