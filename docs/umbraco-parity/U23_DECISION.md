# U23 — Beslutning

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- Settings er løftet til **førsteordens hub** med **read-only** schema/create governance og egen **system**-understi.
- **Ingen** persisted document/data type editor eller Management API-paritet — se `U23_REPLATFORMING_GAPS.md`.

## 2. Hva som er oppnådd

- **CMS** forblir kontrollplan: innhold, media, moduler via eksisterende registry; Settings samler **forklaring** av typer og create-flyt.
- **Domener**: uendret runtime-kobling; hub lenker til AI og runtime uten ny sannhet.
- **Ukemeny/ukeplan**: ikke endret i U23 (fortsatt eksisterende publiseringskjede).
- **Settings / document types / data types / create options**: synlige, konsoliderte kilder (`contentDocumentTypes`, `editorBlockCreateOptions`, governance-tabeller).
- **Sections/trees/workspaces**: TopBar uendret; Settings får understier under samme rot.

## 3. Hva som fortsatt er svakt

- Ingen **database-styrte** document/data types.
- Ingen **per-dokumenttype block filter** med server enforcement.
- Moduler som var **LIMITED/DRY_RUN/STUB** forblir det — U23 endrer ikke backend-posture.

## 4. Nærhet til Umbraco 17 / verdensklasse

- **Workflow/IA**: sterkere Settings-seksjon og ærlig create-dokumentasjon.
- **Teknisk identitet**: avstand til full Bellissima/Management API — dokumentert som gap.

## 5. Før ubetinget enterprise-live-ready (minimalt)

1. Eksplisitt policy for **blokk allowlist** der forretning krever det.
2. Eventuelt persisted type-modell dersom skal skaleres uten deploy.

## 6. Kan vente

- Kosmetisk finpuss på tabeller, E2E på Settings-navigasjon.
- Salgs-/markedsfiler utenfor kode.
