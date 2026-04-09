# CP4 — weekPlan editorial boundary

## Er weekPlan editorial-only?

**Ja** mht. **employee order / GET /api/week**: koden sier eksplisitt at operativ sannhet er avtale + `menuContent`, ikke Sanity `weekPlan` (`app/api/week/route.ts`, `lib/sanity/weekplan.ts` kommentarer).

## Hvor weekPlan fortsatt vises / brukes

| Område | Formål |
|--------|--------|
| Sanity Studio | «Ukeplan» i venstremeny (`studio/deskStructure.ts` → `WeekPlannerTool`) |
| `app/api/weekplan/*`, cron `lock-weekplans` | Redaksjonelt spor (publish, lås) |
| `app/api/weekplan/next` | Returnerer melding hvis ikke operativ employee-kilde |
| Company admin avtale-UI | `weekPlan` i **API-respons** (`/api/admin/agreement`) er **avledet ukeskjema for avtale** (man–fre grid) — **ikke** nødvendigvis samme dokument som Sanity `weekPlan` |

**Navigasjonskollisjon:** ordet «weekPlan» brukes om (a) Sanity-dokumenttype og (b) struktur i admin-avtale-API. CP4 **merker Sanity-weekPlan** tydelig som **editorial** i CMS-flater.

## UI-merking (CP4)

- `/backoffice/week-menu`: amber/seksjon **«Redaksjonell ukeplan (Sanity) — ikke ansatt-runtime»** med lenke til Studio og forklaring.
- `CONTROL_PLANE_RUNTIME_MODULES`: `weekplan_editorial` = **LIMITED**.
- `CmsWeekMenuPublishControlsPanel`: egen underseksjon «Editorial» vs «Operativ kjede».

## Hvordan weekPlan kan leve videre

- Som **kommunikasjon og planlegging** (synlighet, lås, policy) uten å påstå at det styrer bestilling.
- Eventuelle fremtidige koblinger til marketing må dokumenteres — **ikke** CP4-scope.
