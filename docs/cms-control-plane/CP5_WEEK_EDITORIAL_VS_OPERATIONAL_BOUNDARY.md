# CP5 — Week editorial vs operational boundary

## weekPlan editorial-only?

**Ja** for employee order / `GET /api/week` — uendret fra CP4.

## Hvor weekPlan vises

| Sted | Rolle |
|------|--------|
| Sanity Studio «Ukeplan» | Redaksjonelt verktøy |
| `app/api/weekplan/*` | Publish/lås — ikke employee menykilde |
| Backoffice `/backoffice/week-menu` | Amber tekst + eget panel — **ikke** primær operativ kjede |

## UI-merking (CP5)

- Operativ kjede: **grønn/hvit** seksjoner + nummerert `CmsOperationalPublishChain`.
- Editorial: **amber** panel og banner for `weekPlan`.
- Modulstatus: `weekplan_editorial` = LIMITED i `CONTROL_PLANE_RUNTIME_MODULES`.

## Hvordan weekPlan kan leve videre

Som **policy/kommunikasjon** uten å påstå styring av bestilling — dokumentert i UI.
