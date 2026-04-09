# U27 — Hardening

## Utført i U27

- **Fail-closed:** governance-usage krever superadmin (samme mønster som `governance-registry`).
- **Ærlig cap:** skanning begrenset (`MAX_SCAN`); `scanCapped` og `totalVariantsInDb` i respons.
- **Ingen ny mutasjon:** unngår utilsiktet masse-endring av innhold.

## Ikke endret (bevisst)

- Middleware, post-login, frozen superadmin-lister, onboarding, ordre/billing.

## Anbefalt drift

- Ved svært store `content_page_variants`-tabeller: vurder bakgrunnsaggregering i egen fase — **ikke** del av U27-minimum.
