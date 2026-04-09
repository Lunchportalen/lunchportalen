# U27 — Bulk and legacy baseline (pre-build mapping)

**Scope:** Kartlegging av eksisterende collection-flater, bulk-lignende handlinger, entity actions og legacy/envelope-tilstand før U27-implementasjon.

## Collections / list views i dag

| Område | Kilde | Mønster |
|--------|--------|---------|
| Innholdssider (liste) | `GET /api/backoffice/content/pages` | Paginering/limit; brukt fra vekst, tre, m.fl. |
| Mediabibliotek | `app/(backoffice)/backoffice/media/page.tsx` | `BackofficeCollectionToolbar` + statusfilter; trygg bulk: kopier URLer (`SAFE_BULK_COPY_MEDIA_URLS` i `lib/cms/backofficeCollectionViewModel.ts`) |
| Vekst / kontrolltårn | `GrowthDashboard.tsx` | Laster sider + analyser; U27: multi-select + **Kopier editor-lenker** (kun utklippstavle) |
| Settings | Diverse under `/backoffice/settings/*` | Hub + schema, create-options, management-read |
| Content tree | `ContentTree` / API `tree` | Hierarki, ikke tabell-collection |

## Bulk-lignende handlinger i dag

- **Trygge (ingen server-mutasjon):** kopier URLer (media), kopier editor-lenker (vekst, U27).
- **Simulering:** `applySafeBatchPreview` i vekst — kun lokal state, ikke lagret.
- **Ikke bygget som Umbraco entity bulk action:** masse-PATCH av sider, masse-publish, masse-slett — krever eksplisitt backend og review (bevisst ikke i U27).

## Entity actions i praksis

- **Tre:** `NodeActionsMenu` — opprett under, omdøp, kopier lenke, forhåndsvis, flytt, slett.
- **Workspace:** handlingsknapper i `ContentWorkspace` / panels (lagre, publiser, preview, AI).
- **Discovery / command palette:** hurtig navigasjon (U19–U22-lag).
- **Collection-rader:** typisk `Link` til editor med pink underline (primær handling).

## Envelope / governed vs legacy

- **Klassifisering:** `parseBodyEnvelope` (`lib/cms/bodyEnvelopeContract.ts`) — `documentType` satt og ikke-tom ⇒ behandlet som envelope/governed variant; ellers legacy/flat (inkl. ren `blocks[]`-liste).
- **Validering ved lagring:** `blockAllowlistGovernance`, `legacyEnvelopeGovernance` (enkelttilfeller).
- **Aggregert innsikt (U27):** `summarizeGovernanceFromVariantRows` + `GET /api/backoffice/content/governance-usage` — read-only tellinger fra `content_page_variants`.

## Hva som må bygges for helhetlig CMS-mønster (U27)

1. Tydelige **trygge** bulk-handlinger der UX forventer det (clipboard / åpne), ikke falske masse-mutasjoner.
2. **Management usage**-flate: legacy vs governed, dokumenttype- og blokkforekomster — read-only.
3. **Legacy review:** liste over legacy-side-IDer med dype lenker til workspace (ingen skjult batch-migrering).
4. **Entity action**-språk: dokumentere og der mulig harmonisere lenke-stiler og verb (se `U27_ENTITY_ACTIONS_CONSOLIDATION_MODEL.md`).

**Kilde:** kode i repo per U27-branch; kode vinner over eldre notater.
