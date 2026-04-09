# U28 — Collections and bulk baseline

**Status:** Kartlegging før U28-bygging. Bygger på U27 (governance-usage, vekst bulk-lenker, settings insights).

## Collections / list views

| Område | Mønster | Merknad |
|--------|---------|--------|
| Innhold API-liste | `GET /api/backoffice/content/pages` | Limit/paginering |
| Mediabibliotek | Toolbar + statusfilter + trygg URL-bulk | `backofficeCollectionViewModel.ts` |
| Vekst-dashboard | `BackofficeCollectionToolbar` + multi-select + kopier editor-lenker | U27 |
| Settings | Hub + schema, create-options, management-read, governance-insights | U23–U28 |
| Innholdstre | Hierarki + `NodeActionsMenu` | Ikke tabell-collection |

## Bulk-lignende handlinger i dag

- **Trygt:** kopier URLer (media), kopier editor-lenker (vekst), aggregerte read-only API-er.
- **U28:** forutsatt **batch-normalisering** kun via `previewNormalizeLegacyBodyToEnvelope` (samme transform som enkelt-preview i U26) + superadmin API med dry-run.
- **Ikke:** masse-PATCH uten validering, masse-publish, masse-slett.

## Entity actions (praksis)

- **Tre:** `NodeActionsMenu` — opprett, omdøp, kopier lenke, forhåndsvis, flytt, slett.
- **Discovery:** `BackofficeCommandPalette` — navigasjon til `href` (én handling per rad).
- **Workspace:** lagre, preview, AI — `ContentWorkspace`.
- **Collections:** primært `Link` med pink underline til editor.

## Envelope / legacy

- **Klassifisering:** `parseBodyEnvelope` + `documentType` tom/mangler ⇒ legacy for variant.
- **Allowlist:** `validateBodyPayloadBlockAllowlist` på lagret body — governed kan feile allowlist.
- **U28 coverage:** tell governed+OK vs governed+feil vs legacy (se kode).

## Hva U28 skal levere (helhetlig CMS-mønster)

1. Konsistent **entity action**-stil (delt klasse/meny-mønster der det er trygt).
2. **Reviewbar batch-normalisering** med dry-run og lav cap.
3. **Governance coverage** i management-innsikt (allowlist faktisk holdt).
4. Dokumentert preset/impact (read-only der data mangler).
