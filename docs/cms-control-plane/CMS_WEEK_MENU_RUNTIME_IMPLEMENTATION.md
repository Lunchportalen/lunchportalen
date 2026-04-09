# CMS — Week / menu runtime implementation (CP2)

**Dato:** 2026-03-29

## Server routes / libs

| Del | Sti |
|-----|-----|
| Employee API | `app/api/week/route.ts` |
| Meny per måltidstype | `lib/cms/getMenusByMealTypes.ts` |
| Meny per dato (runtime) | `lib/cms/menuContent.ts` (importert dynamisk fra week route) |
| Ukeplan editorial | `lib/cms/weekPlan.ts`, `app/api/weekplan/publish/route.ts` |

## Backoffice UI (CP2)

- `app/(backoffice)/backoffice/week-menu/page.tsx` — tabell over meny-nøkler + Sanity-titler, lenke Studio, dokumentasjon av kjede.

## Ingen ny publish-pipeline

- Publisering av meny skjer fortsatt i **Sanity**; CP2 legger **styringssynlighet** i backoffice.
