-- Extend profiles.preferred_locale CHECK to all eight app UI locales.
-- NULL = default nb. Does not affect Europe/Oslo operational time.

COMMENT ON COLUMN public.profiles.preferred_locale IS
  'UI locale preference (nb | en | sv | da | fi | de | fr | es). NULL = default nb. Does not affect Europe/Oslo operational time.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (
    preferred_locale IS NULL
    OR preferred_locale IN ('nb', 'en', 'sv', 'da', 'fi', 'de', 'fr', 'es')
  );
