-- Add Dutch (nl) to menu_content_translations.locale CHECK — 10th runtime base language.
-- Additive only: widens the locale allowlist so providers can approve Dutch (nl-NL, nl-BE)
-- menu translations. Drops no data, changes no rows, changes no other constraint.

ALTER TABLE public.menu_content_translations
  DROP CONSTRAINT IF EXISTS menu_content_translations_locale_chk;

ALTER TABLE public.menu_content_translations
  ADD CONSTRAINT menu_content_translations_locale_chk
  CHECK (
    locale IN ('nb', 'en', 'sv', 'da', 'fi', 'de', 'fr', 'es', 'it', 'nl')
  );
