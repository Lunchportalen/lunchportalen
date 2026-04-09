# U21 — Workspace actions og footer apps

## I dag

- **Primær handling:** ofte `toolbar` på `BackofficeWorkspaceSurface` (lenker/knapper).
- **Sekundær:** spredt i brødtekst eller egne seksjoner.
- **Footer-lignende status:** global `CmsRuntimeStatusStrip` + `CmsHistoryDiscoveryStrip` i layout — ikke per-workspace footer.

## Umbraco-paritet (mål)

| Umbraco | Lunchportalen U21 |
|---------|-------------------|
| Workspace Actions | `toolbar` (primær) + `secondaryActions` (sekundær) |
| Footer Apps | `footerApps` — vedvarende strip **under** hovedinnhold i workspace |

## Bygges nå

- Props på eksisterende surface — ingen parallell handlingsmotor.

## UX vs teknisk

- Handlinger er **ruting** til eksisterende sikre ruter (`href`), ikke nye mutasjons-API-er i denne fasen.
