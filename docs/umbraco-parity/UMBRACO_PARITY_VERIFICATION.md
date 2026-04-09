# Umbraco parity — verification

**Sist oppdatert:** 2026-03-29

## Kommandoer

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | **PASS** (2026-03-29) |
| `npm run test:run` | **PASS** (2026-03-29) |
| `npm run build:enterprise` | **PASS** (2026-03-29; `Remove-Item .next` før én kjøring) |

## Fokuserte testgrupper

| Område | Merknad |
|--------|---------|
| Auth | Uendret; domain surfaces metadata oppdatert |
| Content | Uendret |
| Week | `controlPlaneDomainActionSurfaces` reflekterer CP7 broker |
| Social / SEO / ESG | Dokumentasjon only |
| Admin / superadmin | Ingen kjerneendring |
| Kitchen / driver | Ingen endring |

## Konklusjon

Umbraco parity (dokumentasjon + minimal metadata-endring): **typecheck**, **test:run**, **build:enterprise** **PASS** (2026-03-29).
