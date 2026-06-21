-- Additive UI locale preference on profiles (Fase 2 i18n foundation).
-- NULL = default nb. Does not affect Europe/Oslo operational time.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_locale text;

COMMENT ON COLUMN public.profiles.preferred_locale IS
  'UI locale preference (nb | en). NULL = default nb. Does not affect Europe/Oslo operational time.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_locale_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_locale_check
      CHECK (preferred_locale IS NULL OR preferred_locale IN ('nb', 'en'));
  END IF;
END $$;
