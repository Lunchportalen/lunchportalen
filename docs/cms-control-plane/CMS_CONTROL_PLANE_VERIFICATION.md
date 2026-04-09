# CMS Control Plane — Verification (CP1 → CP7)

**Sist oppdatert:** 2026-03-29 (CP7)

## Kommandoer (CP7)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | **PASS** (2026-03-29) |
| `npm run test:run` | **PASS** (2026-03-29) |
| `npm run build:enterprise` | **PASS** (2026-03-29; etter ren `rm .next` + enkel kjøring — unngå parallelle `next build`) |
| `npm run sanity:live` | Ikke påkrevd for CP7 |

## Nye / relevante endringer (CP7)

- `lib/sanity/menuContentPublishOps.ts` — Sanity Actions publish for `menuContent`.
- `app/api/backoffice/sanity/menu-content/publish/route.ts` — superadmin broker.
- `components/cms/control-plane/CmsMenuContentNativePublishPanel.tsx` — UI.

## Fokuserte testgrupper (CP7)

| Område | Merknad |
|--------|---------|
| Auth | Superadmin gate på ny publish-route |
| Content | Uendret kjerne |
| Week | `GET /api/week` uendret; publish påvirker kun Sanity perspektiv |
| Social / SEO / ESG | Ingen CP7-kodeendring |
| Admin / superadmin | Ny route under backoffice |
| Kitchen / driver | Uendret |

## Konklusjon

CP7: **typecheck**, **test:run**, **build:enterprise** **PASS** (2026-03-29).
