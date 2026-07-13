-- 21-COUNTRY MARKET CORRECTION (additive, LOCAL ONLY — do not run against production
-- without the separate approval flow in docs/21-COUNTRY-MARKET-CORRECTION-PLAN.md).
--
-- Corrects the flawed "21 locales = 21 markets" model to exactly 21 country markets:
--   NO SE DK FI GB DE FR ES IT NL BE CH AT IE PL RO CZ PT GR US CA
--
--   1. Adds the five missing country markets: PL, RO, CZ, PT, GR.
--   2. Adds the French-Canadian market locale row (fr-CA) so Canada supports en+fr.
--      (BE and CH already carry two locale rows each; a country with several locale
--      rows still counts as ONE market — market identity is country_code.)
--   3. Retires AU, SG and LU from launch scope (is_active=false). Rows are KEPT
--      readable for data transition; no deletes, no destructive changes.
--   4. Widens profiles.preferred_locale and menu_content_translations.locale
--      CHECK allowlists to the 15 base languages.
--
-- No orders, companies, providers or financial data are touched.

BEGIN;

-- 1) New country markets (VAT seeds are catering/served-food defaults and MUST be
--    commercially/legally reviewed before first invoice in each market).
INSERT INTO public.markets (
  country_code, locale, slug, default_currency, default_timezone,
  tax_country_code, default_language, is_active,
  vat_rate_food, cutoff_local_time, invoice_language, stripe_status
)
VALUES
  ('PL', 'pl-PL', 'polish_office_lunch',     'PLN', 'Europe/Warsaw',    'PL', 'pl', true, 8.00,  time '08:00', 'pl', 'not_configured'),
  ('RO', 'ro-RO', 'romanian_office_lunch',   'RON', 'Europe/Bucharest', 'RO', 'ro', true, 9.00,  time '08:00', 'ro', 'not_configured'),
  ('CZ', 'cs-CZ', 'czech_office_lunch',      'CZK', 'Europe/Prague',    'CZ', 'cs', true, 12.00, time '08:00', 'cs', 'not_configured'),
  ('PT', 'pt-PT', 'portuguese_office_lunch', 'EUR', 'Europe/Lisbon',    'PT', 'pt', true, 13.00, time '08:00', 'pt', 'not_configured'),
  ('GR', 'el-GR', 'greek_office_lunch',      'EUR', 'Europe/Athens',    'GR', 'el', true, 13.00, time '08:00', 'el', 'not_configured')
ON CONFLICT (locale, slug) DO NOTHING;

-- 2) French-Canadian market locale (Canada = ONE market, two locales).
--    Slug is the market-locale public slug; menu profile resolution for fr-CA maps to
--    the shared canadian_office_lunch profile in code (lib/i18n/localeRegistry.ts).
INSERT INTO public.markets (
  country_code, locale, slug, default_currency, default_timezone,
  tax_country_code, default_language, is_active,
  vat_rate_food, cutoff_local_time, invoice_language, stripe_status
)
VALUES
  ('CA', 'fr-CA', 'canadian_french_office_lunch', 'CAD', 'America/Toronto', 'CA', 'fr', true, 5.00, time '08:00', 'fr', 'not_configured')
ON CONFLICT (locale, slug) DO NOTHING;

-- 3) Retire AU, SG, LU from launch scope (kept readable; never deleted).
UPDATE public.markets
SET is_active = false, updated_at = now()
WHERE country_code IN ('AU', 'SG', 'LU')
  AND is_active = true;

COMMENT ON TABLE public.markets IS
  'Global market registry. Market identity = country_code (21 canonical countries; multi-locale countries BE/CH/CA carry several locale rows but count once). Locale/slug separated from legal country, tax country, currency, timezone. AU/SG/LU retired from launch scope (is_active=false, retained for data transition).';

-- 4) Base-language allowlists → 15 languages (nb sv da fi en de fr es it nl pl ro cs pt el).
COMMENT ON COLUMN public.profiles.preferred_locale IS
  'App UI locale preference (nb, en, sv, da, fi, de, fr, es, it, nl, pl, ro, cs, pt, el). Unrelated to market/commercial config.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (
    preferred_locale IS NULL
    OR preferred_locale IN ('nb', 'en', 'sv', 'da', 'fi', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'ro', 'cs', 'pt', 'el')
  );

ALTER TABLE public.menu_content_translations
  DROP CONSTRAINT IF EXISTS menu_content_translations_locale_chk;

ALTER TABLE public.menu_content_translations
  ADD CONSTRAINT menu_content_translations_locale_chk
  CHECK (
    locale IN ('nb', 'en', 'sv', 'da', 'fi', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'ro', 'cs', 'pt', 'el')
  );

COMMIT;
