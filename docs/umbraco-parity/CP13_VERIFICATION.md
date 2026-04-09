# CP13 — Verification

**Dato:** 2026-03-29

## Kommandoer

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run build:enterprise` | **PASS** (exit 0; SEO scripts OK) |
| `npm run test:run` | **PASS** (exit 0; **221** filer, **1225** tester) |

**Kjørt:** 2026-03-29.

## Nye tester

- `tests/cms/backofficeExtensionRegistry.test.ts` — id/href unikhet, palett > nav, aktiv tilstand, `getBackofficeExtensionById`.

## Fokusgrupper

| Gruppe | Dekning |
|--------|---------|
| CMS/backoffice parity | Registry + eksisterende `backofficeCommandPalette.test.ts` |
| Auth | Ikke rørt |
| Content | Indirekte (nav til content) |
| Øvrige | Regresjon via full `test:run` |

