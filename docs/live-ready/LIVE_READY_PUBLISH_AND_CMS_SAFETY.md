# LIVE READY — Publish & CMS safety (arbeidsstrøm 3)

**Dato:** 2026-03-29

## Flyt (kilde: eksisterende arkitektur)

- **Content pages** → API under `app/api/backoffice/content/**` med rolle-gates.
- **Tree move** → dedikerte ruter med guards (se tester `tests/backoffice/content-tree-guard.test.ts`).
- **Media** → upload/items med scope; tester under `tests/api/media*`.
- **Preview** → backoffice preview route — ikke det samme som public før publish.

## Risiko mot utilsiktet publisert innhold

| Risiko | Mitigering i kode |
|--------|-------------------|
| SEO-verktøy overskriver variant uten review | SEO-flate er **lagring i CMS-flyt** — fortsatt menneskelig review (`SeoGrowthRuntimeClient` copy) |
| Social påvirker public site direkte | Social poster er **egne rader**; ekstern publish **dry_run** mulig |
| AI apply uten kontroll | Backoffice AI routes krever **superadmin** / avtalt rolle — stikkprøve i audit |

## Endringer i denne fasen

- Ingen kodeendring i publish-pipeline — **dokumentert** her.
