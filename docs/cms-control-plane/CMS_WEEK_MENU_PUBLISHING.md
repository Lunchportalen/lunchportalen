# Arbeidsstrøm 3a — Week / menu / publish from CMS

**Dato:** 2026-03-29

## Kartlagt flyt (kildekode)

### Operativ ansatt-uke (authoritativ for bestilling og visning)

- **`GET /api/week`** (`app/api/week/route.ts`):  
  - Henter bruker, `profiles`, **aktiv avtale**, bygger uke via `buildEmployeeWeekMenuDays` og menydata (`MenuContent` fra Sanity queries).  
  - Kommentar i fil: *operativ sannhet = company_current_agreement + menuContent (ingen Sanity weekPlan).*

### Redaksjonell «weekPlan» (Sanity)

- **`lib/cms/weekPlan.ts`** eksporterer `fetchCurrentWeekPlan` m.m. med **@deprecated** for employee runtime — peker til `GET /api/week`.
- **`lib/sanity/weekplan.ts`** — kommentar: redaksjonell ukeplan for Studio/cron, ikke operativ employee-sannhet.
- **`POST /api/weekplan/publish`** (`app/api/weekplan/publish/route.ts`):  
  - **Kun superadmin** kan publisere Sanity weekPlan-dokument; publish-vindu og policy i route (stramming mulig).

### Deprecations

- **`GET /api/weekplan`** — successor header peker mot `/api/week` (se `app/api/weekplan/route.ts`).

## Hva «publisere ukemeny fra CMS» betyr teknisk

1. **Meny per måltidstype** må være **publisert i Sanity** slik at `getMenusByMealTypes` / meny-queries returnerer riktig innhold for avtalens uke — dette er den operative «meny-sannheten» ansatt ser.
2. **Redaksjonell weekPlan** er **ekstra** spor for kommunikasjon/marketing/cron — må **skilles** i UI fra punkt 1.

## Krav for én trygg sannhetskjede

- **Preview og publish** for **content pages** følger backoffice pipeline (`variant/publish`).
- **Meny:** endringer gjøres der meny faktisk redigeres (Sanity Studio / eksisterende flyt) — dokumenter **hvem** som er redaktør og **når** det blir synlig i `GET /api/week`.
- **Ikke** introduser ny parallell «Week»-tabell uten migrasjon.

## Åpne produktspørsmål (må avklares ved endring, ikke gjett)

- Skal `weekPlan` noensinne styre employee-UI, eller forbli **marketing/cron only**? Dagens kode antar **ikke** for runtime.

## CP1-merknad

- Runtime-statusstrip i backoffice skiller **Ansatt uke (runtime) — LIVE** fra **Redaksjonell ukeplan — LIMITED** (samme kodebase, eksplisitt UI).

## Evidensstier

- `app/api/week/route.ts`
- `lib/week/employeeWeekMenuDays.ts`
- `app/api/weekplan/publish/route.ts`
- `lib/cms/weekPlan.ts`
- `lib/cms/controlPlaneRuntimeStatusData.ts`
