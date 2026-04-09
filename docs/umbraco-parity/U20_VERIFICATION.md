# U20 — Verification

## Kommandoer (lokalt, 2026-03-29)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (exit 0, eksisterende warnings i andre filer) |
| `npm run build:enterprise` | PASS (exit 0) |
| `npm run test:run` | PASS (exit 0) |
| `npm run sanity:live` | Exit 0 — **soft skip** (localhost:3000 ikke oppe; se script-output) |

## Fokuserte testgrupper (kjørt via `test:run`)

- CMS: `tests/cms/backofficeDiscoveryEntities.test.ts` (4 tester)

## Merk

- Full E2E-matrise (auth, week, kitchen, …) er ikke en egen dedikert suite i denne kjøringen; regresjon dekkes av hele `test:run`.
