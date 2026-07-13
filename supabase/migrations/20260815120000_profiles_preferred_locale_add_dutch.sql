-- Add Dutch (nl) to profiles.preferred_locale CHECK — 10th runtime base language.
-- Additive only: widens the allowlist, drops no data, changes no existing rows.
-- Part of the 21-locale end-to-end language completion (nl-NL, nl-BE bind to nl).

COMMENT ON COLUMN public.profiles.preferred_locale IS
  'App UI locale preference (nb, en, sv, da, fi, de, fr, es, it, nl). Unrelated to market/commercial config.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (
    preferred_locale IS NULL
    OR preferred_locale IN ('nb', 'en', 'sv', 'da', 'fi', 'de', 'fr', 'es', 'it', 'nl')
  );
