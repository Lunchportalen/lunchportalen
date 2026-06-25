-- Extend profiles.preferred_locale CHECK to all nine app UI locales (adds it).

COMMENT ON COLUMN public.profiles.preferred_locale IS
  'App UI locale preference (nb, en, sv, da, fi, de, fr, es, it). Unrelated to market/commercial config.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (
    preferred_locale IS NULL
    OR preferred_locale IN ('nb', 'en', 'sv', 'da', 'fi', 'de', 'fr', 'es', 'it')
  );
