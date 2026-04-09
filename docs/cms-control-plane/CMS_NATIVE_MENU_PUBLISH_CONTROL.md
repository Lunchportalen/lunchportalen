# CMS — Native menu publish control (CP7)

## Formål

Gi **in-CMS publish control** over operativ **`menuContent`** uten ny menymotor og uten dobbel sannhet.

## Kjede

1. **Redaksjon:** Sanity Studio (utkast til `menuContent`).
2. **Publish:** Enten Studio-knappen **eller** `POST /api/backoffice/sanity/menu-content/publish` med `{ "date": "YYYY-MM-DD" }` (superadmin + `SANITY_WRITE_TOKEN`).
3. **Runtime:** `GET /api/week` leser publisert `menuContent` som før (`lib/sanity/queries.ts`).

## Hva vises i UI

- `/backoffice/week-menu`: `CmsMenuContentNativePublishPanel` under orkestratoren.
- Eksisterende Studio-handoff-kort beholdes for full redigering.

## Ikke-mål

- Endre `menu_visibility_days` eller cron — egen governance.
- Erstatte Studio som redigeringsflate.
