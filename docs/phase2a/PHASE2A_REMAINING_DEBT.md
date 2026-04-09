# Phase 2A — Remaining debt

## CMS Design

- **Page-level card matrix** (per block-type som global `GlobalDesignSystemSection`) på side-scope er **ikke** eksponert i V4 UI — kun surface/spacing/typography/layout på side og seksjon.
- **Avansert-fanen** «Override designstil»-knapper — fortsatt placeholder UI (eksisterte fra før).

## ContentWorkspace

- Full **`ContentEditorCanvasPane`** ekstraksjon (DnD-liste) — bevisst ikke gjort for å unngå mega-duplikat.

## Komponentrot

- Øvrige `components/layout/*` kan migreres etter samme mønster som `PageContainer`.

## Tester

- `tests/cms/designMergeLayers.test.ts` dekker merge; E2E parity preview vs publisert kan utvides senere.
