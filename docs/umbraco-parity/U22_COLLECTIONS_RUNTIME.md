# U22 — Collections runtime

## Komponenter

- **`BackofficeCollectionToolbar`** (`components/backoffice/BackofficeCollectionToolbar.tsx`): søk, valgfri statusfilter (knapper), `resultHint`, valgfri **bulk**-rad.
- **`lib/cms/backofficeCollectionViewModel.ts`**: `MEDIA_COLLECTION_STATUS_OPTIONS`, `SAFE_BULK_COPY_MEDIA_URLS`, `MediaCollectionStatusFilter`.

## Flater

| Flate | Oppførsel |
|-------|-----------|
| **Media** | Statusfilter (alle/ready/proposed/failed), valg av synlige, **trygg bulk**: kopier URLer til utklippstavle, per-kort «Kopier URL» / «Åpne». |
| **Vekst (GrowthDashboard)** | `BackofficeCollectionToolbar` filtrerer **toppmuligheter** og **sider med poengsum** samt. |

## Ikke-mål

- Bulk DELETE/PATCH media uten dedikert batch-API — ikke implementert.
