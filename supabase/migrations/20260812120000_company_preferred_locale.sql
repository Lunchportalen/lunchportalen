-- Global launch P0 (Fase E / E1): company default UI locale.
-- Locale chain: user preference -> company default -> market default -> global fallback (nb).
-- Additive only. Validation happens app-side (parseAppLocale); invalid values are
-- skipped fail-closed to the next step in the chain.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS preferred_locale text;

COMMENT ON COLUMN public.companies.preferred_locale IS
  'Company default UI locale (app locale code, e.g. nb/en/sv). Step 2 in locale chain: user -> company -> market -> nb.';
