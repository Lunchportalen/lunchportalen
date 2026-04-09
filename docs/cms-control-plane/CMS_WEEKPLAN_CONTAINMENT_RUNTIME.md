# CMS — weekPlan containment vs runtime (CP7)

## Kort sannhet

- **Ansatt uke / bestilling:** `company_current_agreement` + **`menuContent`** (publisert).
- **weekPlan:** Redaksjonelt spor — **ikke** erstatning for `GET /api/week`.

## UI-tiltak (CP7)

- Amber panel og eksplisitt norsk på `/backoffice/week-menu`.
- Ingen flytting av weekPlan til nye ruter (unngår rot i navigasjon).

## QA

- Bekreft at markedsføring ikke sier at `weekPlan` styrer ordre.
- Superadmin «meny uke»-side (`/menus/week`) forblir separat superadmin-verktøy — ikke employee week.
