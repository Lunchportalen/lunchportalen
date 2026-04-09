# CP7 — weekPlan editorial containment

## Er weekPlan editorial-only?

- **Ja** mht. ansatt-bestilling og `GET /api/week`. Koden sier eksplisitt at operativ sannhet er avtale + `menuContent`, ikke `weekPlan` (`app/api/week/route.ts` kommentar).

## Hvilke skjermer viser weekPlan?

- **Sanity Studio:** Ukeplan-verktøy (`studio/tools/weekPlanner/WeekPlanner.tsx`).
- **Backoffice:** Tekst og amber-panel på `/backoffice/week-menu` (CP6/CP7).

## Merking i UI (ingen forveksling med runtime)

- Bruk formuleringer: **«Redaksjonelt»**, **«Ikke ansatt-runtime»**, **«Ikke bestillingskilde»**.
- Amber panel på week-menu siden beskriver at `weekPlan` ≠ `GET /api/week`.
- Modulregister / posture: `weekPlan` som **LIMITED** der relevant (jf. CP6).

## Videre levedykt som redaksjonell planlegging

- `weekPlan` kan brukes til plan/policy uten å påvirke ordre — så lenge produkt/SEO ikke hevder det motsatte.
- CP7 **flytter ikke** weekPlan visuelt til annen rute (unødvendig risiko); tekstlig containment er prioritert.
