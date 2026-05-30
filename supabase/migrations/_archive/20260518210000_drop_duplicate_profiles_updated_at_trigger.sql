-- Fjerner duplikat set_updated_at-trigger på public.profiles.
--
-- P3.D5 hygiene fix: to triggers (set_updated_at + profiles_set_updated_at)
-- kjørte samme tg_set_updated_at() per UPDATE på profiles. Funksjonelt
-- idempotent (begge setter now() til updated_at), men unødvendig overhead
-- og katalog-støy. Verifisert i prod 2026-05-18 (P3.D5-AUDIT).
--
-- Beholder: profiles_set_updated_at -> public.tg_set_updated_at()
--           (følger {table}_set_updated_at navnekonvensjon)
-- Dropper:  set_updated_at -> public.tg_set_updated_at()
--           (generisk legacy-navn uten tabell-prefiks)
--
-- Rollback (hvis nødvendig — kjør manuelt):
--   CREATE TRIGGER set_updated_at
--     BEFORE UPDATE ON public.profiles
--     FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

BEGIN;

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;

COMMIT;
