# CP13 — Changed files

## Oppsummering

Kode endret for kanonisk extension registry + workspace context-typer + tester og dokumentasjon.

## Kode

| Fil | Hvorfor | Minimal risiko |
|-----|---------|----------------|
| `lib/cms/backofficeExtensionRegistry.ts` | **NY** — `BACKOFFICE_EXTENSION_REGISTRY`, avledet nav/palett, `isBackofficeNavActive`, lookup | Samme href/labels som før; eksplisitt konsolidering |
| `lib/cms/backofficeNavItems.ts` | Barrel re-export fra registry (bakoverkompatibel API) | Import-path uendret for konsumenter |
| `lib/cms/backofficeWorkspaceContextModel.ts` | **NY** — TypeScript-modell for workspace session (ingen global Context) | Kun typer — ingen runtime-adferd |
| `app/(backoffice)/backoffice/_shell/TopBar.tsx` | Bruker `isBackofficeNavActive` — fjerner duplisert aktiv-logikk | Prefix-match ekvivalent med tidligere spesialtilfeller |
| `tests/cms/backofficeExtensionRegistry.test.ts` | **NY** — unikhet, palett > nav, aktiv path | Regresjonsnett |

## Dokumentasjon

Alle `docs/umbraco-parity/CP13_*.md` (baseline, runtime, beslutning, verifikasjon, osv.).

## Ikke rørt

- `middleware.ts`, auth, billing, onboarding, week API, agreement motor, Sanity-oppsett.
