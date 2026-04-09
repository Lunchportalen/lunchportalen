# U22 — Collections og entity actions baseline

## Collection-/list-/table-flater i dag

| Flate | Mønster |
|-------|---------|
| Media | Grid + søk, per-kort metadata/redigering |
| Content tree | Tre + `TreeNodeRow` + `NodeActionsMenu` |
| Growth dashboard | Lister «sider med poengsum», muligheter, lenker til editor |
| Domener / kunder | Tabeller (`CmsCompanyAgreementLocationPanel`) |
| Uke & meny | Tabell for Sanity-dokumenter |
| API | `GET /api/backoffice/content/pages`, `GET /api/backoffice/media/items` |

## Entity actions i dag

- Tre: kopier lenke, forhåndsvisning, flytt, m.m. (`NodeActionsMenu`).
- Palett (U20): manifest + entitetsrader.
- Domain cards: `CmsDomainActionSurfaceCard`.

## Bulk-lignende i dag

- Growth: `applySafeBatchPreview` (kun **lokal simulering**, ikke lagring).
- Media: per-element lagre/slett — **ingen** multi-select før U22.

## Nær paritet

- Trygg batch-forklaring i vekst-dashboard; schema-drevet blokkeditor (`blockFieldSchemas`).

## Under paritet (før U22)

- Ingen felles **collection toolbar**-komponent.
- Ingen eksplisitt **property dataset**-forklaring i blokk-modal.

## U22 mål

- Felles toolbar + **trygg** bulk (kun der ingen ny sannhet kreves).
- Tydelig schema/data/UI-lag i blokkeditor.
