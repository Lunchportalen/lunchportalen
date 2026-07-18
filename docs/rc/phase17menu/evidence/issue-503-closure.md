# Issue #503 closure evidence (Phase 17MENU)

**Issue:** https://github.com/Lunchportalen/lunchportalen/issues/503  
**Gate:** Close only when `MENU_LOCALES_24_24` and `MISSING_REQUIRED_MENU_TRANSLATIONS = 0`.

## Fixes shipped

1. Global `timeZone: "Europe/Oslo"` in `i18n/request.ts` (eliminates `ENVIRONMENT_FALLBACK` in SSR/CI).
2. Locale evidence for all 24 locales under `docs/rc/phase17menu/evidence/locales/*.json`.
3. CI gate `npm run ci:phase17menu-gates` asserts locale PASS + timeZone present.

## Result

| Gate | Value |
|------|-------|
| MENU_LOCALES_24_24 | PASS |
| MISSING_REQUIRED_MENU_TRANSLATIONS | 0 |
| timeZone configured | YES |

Issue #503 may be closed after CI gate passes on the PR.
