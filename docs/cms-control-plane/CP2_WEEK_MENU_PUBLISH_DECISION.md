# CP2 — Week / menu publish decision (eksplisitt)

**Dato:** 2026-03-29  
**Kilde:** `app/api/week/route.ts`, `lib/cms/menuContent.ts`, `lib/cms/getMenusByMealTypes.ts`, `lib/cms/weekPlan.ts`, `app/api/weekplan/publish/route.ts`

## 1. Hva employee runtime faktisk leser i dag

- **`GET /api/week`**: Profil → **`company_current_agreement`** (ACTIVE) → **`getMenuForDates` / `menuContent`** fra Sanity (per dato/måltid) → `buildEmployeeWeekMenuDays`.
- **Sanity `weekPlan`** er **ikke** denne kjedeoperatoren — se `lib/cms/weekPlan.ts` (@deprecated for employee runtime).

## 2. Publisert sannhet i dag

- **Menyinnhold** som påvirker ansatt: **Sanity `menu`**-dokumenter (og relaterte queries) som `menuContent` resolver.
- **Redaksjonell `weekPlan`**: eget spor (Studio/cron/superadmin publish) — **ikke** «employee truth» uten produktendring.

## 3. Hvordan CMS skal styre ukemeny uten ny sannhet

- **Styringsflate** = **Sanity Studio** + eksisterende CMS-APIer som allerede leser/skriver Sanity — CP2 legger **backoffice-leseside** som peker på samme kilde og viser hva runtime henter (`getMenusByMealTypes`).
- **Ingen** ny menytabell i Postgres; **ingen** parallell `menu` store.

## 4. Er Sanity menu / menuContent fortsatt source of truth?

**Ja** for det som vises som menydata til employee (via `menuContent` / relaterte helpers).

## 5. Er weekPlan editorial-only eller operativ?

**Editorial / marketing / policy** — ikke `GET /api/week` primærkilde. Operativ rolle for cron/marketing kan finnes; **employee UI** skal ikke presenteres som drevet av weekPlan uten kodebevis.

## 6. Preview og publish

- **Content pages (Postgres)**: egen preview/publish — ikke blandet med meny.
- **Meny**: «preview» = det Sanity returnerer ved lesing; «publish» i drift = tilgjengelige dokumenter i Sanity + ev. redaksjonell weekPlan publish — **to ulike lag**, begge dokumentert.

## 7. Hva CP2 implementerer nå

- Side **`/backoffice/week-menu`**: read-only oversikt over `menu` per måltidstype (via `getMenusByMealTypes`), forklaring av runtime-kjede, lenke til Sanity Studio.
- **Ingen** ny publish-knapp som skriver til annen kilde enn eksisterende Sanity/CRM-mønstre.

## 8. Hva som venter

- Dyp integrasjon av inline Sanity-redigering i Next (stor jobb).
- Eventuell automatisk «promoter weekPlan → visibility» — **produktbeslutning**, ikke CP2.
