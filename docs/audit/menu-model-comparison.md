# Lunchportalen — sammenligning av meny-modeller

**Dato:** 2026-05-12  
**Repo-commit:** 0625628d64c37e2302242bf62ec47ee65a3aea48  
**Branch:** main

---

## 1. Sammendrag

- Aktiv Sanity Studio-konfigurasjon bruker `./schemaTypes`, der `menuContent` og `menuDay` er registrert, mens `weekPlan` ikke er i den aktive listen. `studio/sanity.config.ts:4-5`, `studio/sanity.config.ts:31-33`, `studio/schemaTypes/index.ts:26-37`
- `weekPlan` finnes som eget skjema i `studio/schemas/weekPlan.ts`, og et separat eldre schema-index eksporterer `dish` og `weekPlan`. `studio/schemas/weekPlan.ts:64-68`, `studio/schemas/index.ts:3-6`
- Aktiv Studio-sidebar viser `Ukeplan` som custom komponent (`WeekPlannerTool`) og `Menyinnhold` som `documentTypeListItem("menuContent")`. `studio/deskStructure.ts:4`, `studio/deskStructure.ts:10-18`
- Aktiv `WeekPlannerTool` skriver `_type: "menuDay"` per dato, ikke `_type: "weekPlan"`. `studio/src/tools/WeekPlanner.tsx:256-269`
- `GET /api/week` sier eksplisitt at operativ sannhet er `company_current_agreement + menuContent`, uten Sanity `weekPlan`. `app/api/week/route.ts:1-3`
- `weekPlan` har likevel egne API- og cron-spor for lesing, publisering og låsing. `app/api/weekplan/route.ts:1-3`, `app/api/weekplan/publish/route.ts:116-127`, `app/api/cron/lock-weekplans/route.ts:1-2`
- Det er ikke funnet kode som synkroniserer `weekPlan` til `menuDay` eller `menuContent`; cron-sporene opererer på hver sin modell. `app/api/cron/lock-weekplans/route.ts:11-18`, `app/api/cron/week-visibility/route.ts:48-56`
- Reelle dokumentantall for `weekPlan`, `menuDay` og `menuContent` kan ikke anslås fra seed/dump i repoet; seed-filer funnet her gjelder `menu`, `productPlan` og `mealIdea`. `studio/seed/product-plans-and-menus.ndjson:1-9`, `studio/seed/varmmatbank-1000.ndjson:1-5`

## 2. Modell A — weekPlan

### 2.1 Definisjon

| Punkt | Funn |
|---|---|
| Skjemafil | `studio/schemas/weekPlan.ts`, 468 linjer, definerer `name: "weekPlan"`, `title: "Ukeplan"`, `type: "document"`. `studio/schemas/weekPlan.ts:64-68`, `studio/schemas/weekPlan.ts:468` |
| Dokumenttyper | Modellen består av dokumenttypen `weekPlan` og et innebygd array-objekt `weekDay` i `days[]`. `studio/schemas/weekPlan.ts:143-153` |
| Toppnivåfelter | `weekKey`, `weekStart`, `status`, `approvedForPublish`, `customerVisible`, `visibleFrom`, `becomesCurrentAt`, `publishedAt`, `lockedAt`, `locked`, `days`, `noteForKitchen`. `studio/schemas/weekPlan.ts:70-141`, `studio/schemas/weekPlan.ts:143-190`, `studio/schemas/weekPlan.ts:431-435` |
| Hierarki | `weekPlan.days[]` inneholder `date`, `level`, `mealRef`, snapshotfelter, statusflagg og legacy `dishes`; `mealRef` peker til `mealIdea`, mens `dishes` peker til `dish`. `studio/schemas/weekPlan.ts:153-176`, `studio/schemas/weekPlan.ts:178-353` |
| Aktiv schema-registrering | Ikke funnet i aktiv `studio/schemaTypes/index.ts`; aktiv `sanity.config.ts` bruker `./schemaTypes`. `studio/sanity.config.ts:4-5`, `studio/sanity.config.ts:31-33`, `studio/schemaTypes/index.ts:26-37` |
| Eldre schema-registrering | `studio/schemas/index.ts` importerer `weekPlan` og eksporterer `[dish, weekPlan]`. `studio/schemas/index.ts:3-6` |
| Aktiv desk-registrering | Ikke funnet som `documentTypeListItem("weekPlan")`; aktiv desk har `Ukeplan` som `S.component(WeekPlannerTool)` og `Menyinnhold` som `documentTypeListItem("menuContent")`. `studio/deskStructure.ts:10-18` |
| Custom Studio-verktøy | Aktiv `WeekPlannerTool` heter `Ukeplan`, men verktøyet leser/skriver `menuDay`, ikke `weekPlan`. `studio/deskStructure.ts:4`, `studio/deskStructure.ts:10-13`, `studio/src/tools/WeekPlanner.tsx:151-179`, `studio/src/tools/WeekPlanner.tsx:256-269` |

Toppnivåstruktur:

| Felt | Type/formål |
|---|---|
| `weekKey` | ISO ukenøkkel, required + regex. `studio/schemas/weekPlan.ts:70-75` |
| `weekStart` | Mandag som `date`, required. `studio/schemas/weekPlan.ts:77-82` |
| `status` | `draft/open/current/archived`, required. `studio/schemas/weekPlan.ts:84-90` |
| `approvedForPublish` / `customerVisible` | Publiserings- og synlighetsflagg. `studio/schemas/weekPlan.ts:93-105` |
| `visibleFrom` / `becomesCurrentAt` / `publishedAt` / `lockedAt` / `locked` | Read-only tids- og låsefelter. `studio/schemas/weekPlan.ts:107-141` |
| `days[]` | Nøyaktig fem Man-Fre-dager med rettedata og validering. `studio/schemas/weekPlan.ts:143-153`, `studio/schemas/weekPlan.ts:391-428` |
| `noteForKitchen` | Overordnet notat til kjøkken. `studio/schemas/weekPlan.ts:431-435` |

### 2.2 Skrivere

| Filsti:linje | Kategori | Operasjon | Hvilke felter |
|---|---|---|---|
| `app/api/weekplan/publish/route.ts:119-127` | API-route | `patch(weekPlanId).set(...)` | `approvedForPublish`, `customerVisible`, `publishedAt` |
| `lib/sanity/weekPlanOps.ts:8-22` | lib-helper | Finner `weekPlan` etter `weekKey` og patcher status. | `status` + vilkårlig `patch` |
| `app/api/cron/lock-weekplans/route.ts:47-57` | cron-job | Finner publiserte/synlige `weekPlan` med dagens dato i `days[]` og patcher dokumentene. | `lockedAt` |

### 2.3 Lesere

| Filsti:linje | Kategori | Operasjon | GROQ-mønster |
|---|---|---|---|
| `lib/sanity/weekplan.ts:66-78` | lib-helper | Henter current/fallback live ukeplan. | `_type=="weekPlan"`, `status=="current"`, `approvedForPublish == true`, `customerVisible == true` |
| `lib/sanity/weekplan.ts:81-94` | lib-helper | Henter neste åpne ukeplan. | `_type=="weekPlan"`, `status=="open"`, `weekStart > $todayISO`, live filter |
| `app/api/weekplan/route.ts:33-79` | API-route | Autentiserer, leser avtale og kaller `fetchNextPublishedWeekPlan`. | Leser via `lib/cms/weekPlan` |
| `lib/cms/weekPlan.ts:3-18` | lib-fasade | Re-eksporterer `fetchCurrentWeekPlan`, `fetchNextOpenWeekPlan`, `fetchNextPublishedWeekPlan`. | Leser via `lib/sanity/weekplan.ts` |
| `lib/sanity/weekPlanOps.ts:8-13` | lib-helper | Leser `_id`, `status`, `locked` før statuspatch. | `*[_type=="weekPlan" && weekKey==$weekKey][0]` |
| `app/api/cron/lock-weekplans/route.ts:11-18` | cron-job | Leser publiserte ukeplaner som skal låses. | `_type=="weekPlan"` + `count(days[date==$today]) > 0` |

## 3. Modell B — menuDay + menuContent

### 3.1 Definisjon

| Punkt | Funn |
|---|---|
| Skjemafiler | `studio/schemaTypes/menuDay.ts` er 233 linjer; `studio/schemaTypes/menuContent.ts` er 74 linjer. `studio/schemaTypes/menuDay.ts:1-233`, `studio/schemaTypes/menuContent.ts:1-74` |
| Dokumenttyper | Modellen består av `menuDay` (`Meny – Dag`) og `menuContent` (`Menyinnhold`). `studio/schemaTypes/menuDay.ts:3-7`, `studio/schemaTypes/menuContent.ts:3-7` |
| `menuDay` toppnivåfelter | `date`, `mealRef`, `mealTitle`, `description`, allergener, næring, kjøkkenstil, kostnadsnivå, råvarekost, rettetypeflagg, godkjenning og synlighet. `studio/schemaTypes/menuDay.ts:9-203` |
| `menuContent` toppnivåfelter | `date`, `description`, `allergens`, `isPublished`. `studio/schemaTypes/menuContent.ts:8-55` |
| Hierarki | `menuDay.mealRef` refererer til `mealIdea`; `menuContent` har ingen referansefelt i skjemaet. `studio/schemaTypes/menuDay.ts:16-21`, `studio/schemaTypes/menuContent.ts:8-55` |
| Aktiv schema-registrering | `menuContent` importeres og ligger i `schemaTypes`; `menuDay` importeres og ligger i samme liste. `studio/schemaTypes/index.ts:3-12`, `studio/schemaTypes/index.ts:26-37` |
| Aktiv desk-registrering | `menuContent` er `documentTypeListItem("menuContent")`; `menuDay` er ikke egen document-list i aktiv desk, men brukes via custom `Ukeplan`-komponenten. `studio/deskStructure.ts:10-18`, `studio/src/tools/WeekPlanner.tsx:531-533` |
| Eldre desk-spor | `studio/src/structure.ts` skjuler først `menuDay` fra standardlisten og legger deretter til `S.documentTypeListItem("menuDay").title("Meny – Dager")`. `studio/src/structure.ts:13-18` |
| Custom Studio-verktøy | Aktiv `WeekPlannerTool` leser, oppretter, autofyller, godkjenner og trekker tilbake `menuDay`. `studio/src/tools/WeekPlanner.tsx:146-189`, `studio/src/tools/WeekPlanner.tsx:256-269`, `studio/src/tools/WeekPlanner.tsx:275-418` |

Toppnivåstruktur:

| Felt | `menuDay` | `menuContent` |
|---|---|---|
| Dato | `date` required. `studio/schemaTypes/menuDay.ts:9-14` | `date` required. `studio/schemaTypes/menuContent.ts:9-15` |
| Rett/tekst | `mealTitle`, `description`, `mealRef -> mealIdea`. `studio/schemaTypes/menuDay.ts:16-34` | `description` required min 8. `studio/schemaTypes/menuContent.ts:17-26` |
| Allergener | `allergens`, `mayContain`. `studio/schemaTypes/menuDay.ts:36-50` | `allergens`. `studio/schemaTypes/menuContent.ts:28-36` |
| Næring/kost | `nutritionPer100g`, `kitchenStyle`, `costTier`, `estimatedCostPerPortion`. `studio/schemaTypes/menuDay.ts:52-151` | Ikke funnet i skjemaet. `studio/schemaTypes/menuContent.ts:8-55` |
| Publisering/synlighet | `approvedForPublish`, `approvedAt`, `customerVisible`, `customerVisibleSetAt`. `studio/schemaTypes/menuDay.ts:175-202` | `isPublished`. `studio/schemaTypes/menuContent.ts:38-54` |

### 3.2 Skrivere

| Filsti:linje | Kategori | Operasjon | Hvilke felter |
|---|---|---|---|
| `studio/src/tools/WeekPlanner.tsx:256-269` | Studio-verktøy | `client.createIfNotExists` for `menuDay-${date}`. | `_type`, `date`, `description`, `mealTitle`, `allergens`, `mayContain`, `approvedForPublish`, `customerVisible` |
| `studio/src/tools/WeekPlanner.tsx:321-345` | Studio-verktøy | Autofyll patcher `menuDay`. | `description`, `mealTitle`, `mealRef`, `allergens`, `mayContain`, `nutritionPer100g`, `kitchenStyle`, `costTier`, `estimatedCostPerPortion`, `isFishDish`, `isSoup`, `isVegetarian`, `approvedForPublish`, `customerVisible` |
| `studio/src/tools/WeekPlanner.tsx:347-350` | Studio-verktøy | Autofyll patcher valgt `mealIdea`. | `lastUsedDate`, `usageCount` |
| `studio/src/tools/WeekPlanner.tsx:400-409` | Studio-verktøy | Godkjenner uke 2 ved å patche alle fem `menuDay`. | `approvedForPublish`, `approvedAt` |
| `studio/src/tools/WeekPlanner.tsx:424-434` | Studio-verktøy | Trekker godkjenning for uke 2. | `approvedForPublish`, `customerVisible`, unset `approvedAt`, `customerVisibleSetAt` |
| `app/api/cron/week-visibility/route.ts:48-72` | cron-job | Finner `menuContent` i datointervall og patcher synlighet. | `customerVisible`, `customerVisibleSetAt` |
| `app/api/cron/week-visibility/route.ts:75-103` | cron-job/API-route | Finner `menuContent` for én dato og patcher synlighet. | `customerVisible`, `customerVisibleSetAt` |
| `app/api/cron/week-visibility/route.ts:106-147` | cron-job/API-route | Speiler datonivå til Supabase. | `menu_visibility_days.date`, `is_published`, `updated_at`, `updated_by` |
| `lib/sanity/menuContentPublishOps.ts:25-60` | lib-helper | Publiserer Sanity draft for `menuContent` via Actions API. | Draft til published dokument |
| `app/api/backoffice/sanity/menu-content/publish/route.ts:16-55` | API-route | Superadmin-broker kaller `publishMenuContentDraftForDate(date)`. | Publiserer `menuContent` draft for dato |

### 3.3 Lesere

| Filsti:linje | Kategori | Operasjon | GROQ-mønster |
|---|---|---|---|
| `studio/src/tools/WeekPlanner.tsx:146-179` | Studio-verktøy | Henter uke 1 og uke 2 `menuDay`. | `_type == "menuDay"`, `date in $dates`, ekskluderer drafts |
| `studio/src/tools/WeekPlanner.tsx:232-245` | Studio-verktøy | Henter historiske `menuDay` for cooldown. | `_type == "menuDay"`, `date >= $from`, `date <= $to` |
| `studio/src/tools/WeekPlanner.tsx:374-388` | Studio-verktøy | Henter uke 2 før godkjenning. | `_type == "menuDay"`, `date in $dates` |
| `app/api/cron/meal-learning/route.ts:198-209` | cron-job | Matcher ordre-datoer mot `menuDay.mealRef`. | `_type == "menuDay"`, `date in $dates`, `defined(mealRef._ref)` |
| `lib/sanity/queries.ts:91-125` | lib-helper | Henter synlig `menuContent` for én dato. | `_type == "menuContent"`, `date == $date`, `CUSTOMER_VISIBLE_FILTER` |
| `lib/sanity/queries.ts:141-180` | lib-helper | Henter synlig `menuContent` for flere datoer. | `_type == "menuContent"`, `date in $dates`, `CUSTOMER_VISIBLE_FILTER` |
| `lib/sanity/queries.ts:186-233` | lib-helper | Henter synlig `menuContent` for datointervall. | `_type == "menuContent"`, `date >= $from`, `date <= $to` |
| `lib/sanity/queries.ts:241-278` | lib-helper | Henter admin-liste av `menuContent` uten drafts. | `_type == "menuContent"`, `date in $dates`, `!(_id in path("drafts.**"))` |
| `app/api/week/route.ts:165-192` | API-route | Leser `menuContent` via `getMenuForDates` og bygger `days`. | Leser via `lib/cms/menuContent` |
| `app/(app)/week/page.tsx:479-483` | server component | Leser publiserte menyer for superadmin-preview. | Leser via `getMenuForDates(allDates)` |
| `app/menus/week/page.tsx:72-76` | server component | Leser admin-menyer for Man-Fre. | Leser via `getMenuForDatesAdmin(days)` |
| `app/api/orders/set/route.ts:114-123` | API-route | Blokkerer bestilling hvis meny ikke er publisert. | Leser via `getPublishedMenuForDate(date)` |
| `app/api/orders/week/route.ts:52-77` | API-route | Leser publiserte datoer med kort cache. | Leser via `getMenuForDates(days)` |
| `app/api/superadmin/menus-week/route.ts:93-120` | API-route | Leser `menuContent` og `menu_visibility_days` for superadminstatus. | Leser via `getMenuForDatesAdmin(dates)` + Supabase mirror |

## 4. Feature-sammenligning

| Capability | weekPlan | menuDay+menuContent |
|---|---|---|
| Ukestruktur (Mon-Fri som enhet) | Ja, `days` må ha nøyaktig 5 dager. `studio/schemas/weekPlan.ts:391-399` | Delvis: `WeekPlanner` beregner fem datoer per uke, men dokumenttypen er per dag. `studio/src/tools/WeekPlanner.tsx:136-143`, `studio/src/tools/WeekPlanner.tsx:256-269` |
| Dag-nivå metadata (allergener, mayContain) | Ja, i `days[]`. `studio/schemas/weekPlan.ts:192-212` | Ja i `menuDay`; `menuContent` har bare `allergens`. `studio/schemaTypes/menuDay.ts:36-50`, `studio/schemaTypes/menuContent.ts:28-36` |
| Næringsinnhold per dag | Ja, `days[].nutritionPer100g`. `studio/schemas/weekPlan.ts:214-275` | Ja i `menuDay`; ikke funnet i `menuContent`. `studio/schemaTypes/menuDay.ts:52-112`, `studio/schemaTypes/menuContent.ts:8-55` |
| Kjøkkenstil per dag | Ja, `days[].kitchenStyle`. `studio/schemas/weekPlan.ts:277-285` | Ja i `menuDay`; ikke funnet i `menuContent`. `studio/schemaTypes/menuDay.ts:114-131`, `studio/schemaTypes/menuContent.ts:8-55` |
| Kostnadsnivå per dag | Ja, `days[].costTier`. `studio/schemas/weekPlan.ts:287-295` | Ja i `menuDay`; ikke funnet i `menuContent`. `studio/schemaTypes/menuDay.ts:133-145`, `studio/schemaTypes/menuContent.ts:8-55` |
| Råvarekost per dag | Ja, `days[].estimatedCostPerPortion`. `studio/schemas/weekPlan.ts:297-302` | Ja i `menuDay`; ikke funnet i `menuContent`. `studio/schemaTypes/menuDay.ts:147-151`, `studio/schemaTypes/menuContent.ts:8-55` |
| Margin-beregning | Ikke funnet i `weekPlan`-skjemaet; modellen har bare råvarekost. `studio/schemas/weekPlan.ts:297-302` | Ja i WeekPlanner UI (`90 - cost`) og generator-score. `studio/src/tools/WeekPlanner.tsx:97-103`, `lib/menu-publish/generateWeekMenu.ts:64-95` |
| Status (draft/open/current/archived) | Ja, `status` options. `studio/schemas/weekPlan.ts:9-14`, `studio/schemas/weekPlan.ts:84-90` | Nei som samme statusfelt; `menuDay` bruker godkjenning/synlighet, `menuContent` bruker `isPublished`. `studio/schemaTypes/menuDay.ts:175-202`, `studio/schemaTypes/menuContent.ts:38-54` |
| Godkjenning per uke | Ja på toppnivå `approvedForPublish`; `publish`-API setter den. `studio/schemas/weekPlan.ts:93-98`, `app/api/weekplan/publish/route.ts:119-127` | Delvis: WeekPlanner godkjenner alle fem `menuDay` i uke 2, men feltet ligger per dag. `studio/src/tools/WeekPlanner.tsx:367-409` |
| Skjult/customerVisible per dag | `customerVisible` finnes på toppnivå og `hidden` finnes per `days[]`. `studio/schemas/weekPlan.ts:100-105`, `studio/schemas/weekPlan.ts:332-337` | Ja, `menuDay.customerVisible`; `menuContent` runtime-filter forventer også `customerVisible` som bakoverkompatibelt kontrollfelt selv om skjemaet ikke definerer det. `studio/schemaTypes/menuDay.ts:189-202`, `lib/sanity/queries.ts:56-72` |
| Locked-flag | Ja, `locked` og `lockedAt`. `studio/schemas/weekPlan.ts:128-141` | Ikke funnet i `menuDay` eller `menuContent` skjema. `studio/schemaTypes/menuDay.ts:8-203`, `studio/schemaTypes/menuContent.ts:8-55` |
| Validering: unike datoer | Ja, `uniqueDates.size !== 5` gir feil. `studio/schemas/weekPlan.ts:401-406` | Ikke funnet i skjema; WeekPlanner bruker deterministisk `_id: menuDay-${date}` med `createIfNotExists`. `studio/src/tools/WeekPlanner.tsx:74-76`, `studio/src/tools/WeekPlanner.tsx:256-269` |
| Validering: maks én fiskerett | Ja i `weekPlan.days[]` validering. `studio/schemas/weekPlan.ts:417-420` | Ja i auto-generator, ikke i `menuDay`-skjemaet. `lib/menu-publish/generateWeekMenu.ts:70-72`, `lib/menu-publish/generateWeekMenu.ts:285-295` |
| Validering: maks én suppe | Ja i `weekPlan.days[]` validering. `studio/schemas/weekPlan.ts:422-425` | Ja i auto-generator, ikke i `menuDay`-skjemaet. `lib/menu-publish/generateWeekMenu.ts:70-72`, `lib/menu-publish/generateWeekMenu.ts:285-295` |
| Validering: maks én vegetar | Ikke funnet i `weekPlan` validering; feltet finnes. `studio/schemas/weekPlan.ts:318-323`, `studio/schemas/weekPlan.ts:391-428` | Ja i auto-generator (`MAX_VEG_PER_WEEK`), ikke i `menuDay`-skjemaet. `lib/menu-publish/generateWeekMenu.ts:70-72`, `lib/menu-publish/generateWeekMenu.ts:285-295` |
| Auto-fyll | Ikke funnet for `weekPlan`. `studio/schemas/weekPlan.ts:1-468` | Ja, `autoFillWeek` henter `mealIdea`, kjører `generateWeekMenu`, patcher `menuDay`. `studio/src/tools/WeekPlanner.tsx:275-365` |
| Referanse til `mealIdea`-pool | Ja, `days[].mealRef -> mealIdea`. `studio/schemas/weekPlan.ts:169-176` | Ja, `menuDay.mealRef -> mealIdea`. `studio/schemaTypes/menuDay.ts:16-21` |
| Referanse til `dish` (legacy) | Ja, `days[].dishes -> dish`, hidden legacyfelt. `studio/schemas/weekPlan.ts:339-347` | Ikke funnet i `menuDay` eller `menuContent`. `studio/schemaTypes/menuDay.ts:8-203`, `studio/schemaTypes/menuContent.ts:8-55` |
| Tidsfelt (visibleFrom, becomesCurrentAt, publishedAt, lockedAt) | Ja på toppnivå. `studio/schemas/weekPlan.ts:107-133` | Delvis: `menuDay` har `approvedAt` og `customerVisibleSetAt`; `menuContent` skjema har ikke tidsfeltene, men queries/projeksjon forventer dem. `studio/schemaTypes/menuDay.ts:182-202`, `lib/sanity/queries.ts:35-40` |
| `noteForKitchen` | Ja på toppnivå; per dag heter feltet `kitchenNote`. `studio/schemas/weekPlan.ts:349-353`, `studio/schemas/weekPlan.ts:431-435` | Ikke funnet i `menuDay`/`menuContent` skjema. `studio/schemaTypes/menuDay.ts:8-203`, `studio/schemaTypes/menuContent.ts:8-55` |
| Filtrering på publisert/synlig i GROQ | Ja, `WEEKPLAN_LIVE_FILTER` krever `approvedForPublish` og `customerVisible`. `lib/sanity/weekplan.ts:63-72` | Ja for `menuContent`; filteret tillater `isPublished` eller `approvedForPublish && customerVisible`. `lib/sanity/queries.ts:56-72`, `lib/sanity/queries.ts:98-121` |

Forskjellen når samme capability finnes i begge: `weekPlan` modellerer en uke som ett dokument med `days[]`, mens `menuDay+menuContent` modellerer redaksjonell dagplan og operativ visning som dato-orienterte dokumenter. `studio/schemas/weekPlan.ts:143-153`, `studio/schemaTypes/menuDay.ts:3-14`, `studio/schemaTypes/menuContent.ts:3-15`

## 5. Aktuell dataflyt

- Når redaktør åpner Studio-sidebaren `Ukeplan`, rendres `WeekPlannerTool` som custom component. `studio/deskStructure.ts:10-13`
- Når redaktør oppretter uke i dette verktøyet, kaller verktøyet `ensureWeek`, som oppretter `menuDay-${date}` med `_type: "menuDay"`. `studio/src/tools/WeekPlanner.tsx:445-452`, `studio/src/tools/WeekPlanner.tsx:256-269`
- Når redaktør auto-fyller, skriver verktøyet snapshotfelter fra `mealIdea` til `menuDay` og oppdaterer `mealIdea` brukshistorikk. `studio/src/tools/WeekPlanner.tsx:306-353`
- `GET /api/week` leser aktiv avtale fra Supabase, leser `menuContent` via `getMenuForDates`, og returnerer `sanity.weekPlanOperational: false` og `plan: null`. `app/api/week/route.ts:114-149`, `app/api/week/route.ts:165-192`, `app/api/week/route.ts:215-223`
- Den synlige `/week`-siden sier i filkommentaren at employee-ukevisning får meny fra `/api/order/window`, mens samme server component også leser `menuContent` for superadmin-preview. `app/(app)/week/page.tsx:1`, `app/(app)/week/page.tsx:479-483`
- `/api/order/window` bruker avtale, `productPlan` og `menu` per måltidstype for header/valg, ikke `weekPlan`. `app/api/order/window/route.ts:20-24`, `app/api/order/window/route.ts:707-724`, `app/api/order/window/route.ts:586-620`
- Kode som flytter data fra `weekPlan` til `menuDay` eller `menuContent` er ikke funnet; `lock-weekplans` leser/skriver bare `weekPlan`, mens `week-visibility` leser/skriver `menuContent`. `app/api/cron/lock-weekplans/route.ts:11-18`, `app/api/cron/lock-weekplans/route.ts:47-57`, `app/api/cron/week-visibility/route.ts:48-72`
- Kode som flytter data fra `menuDay` til `menuContent` er ikke funnet; `WeekPlannerTool` skriver `menuDay`, mens `menuContent`-queries og publiseringscron står separat. `studio/src/tools/WeekPlanner.tsx:256-269`, `lib/sanity/queries.ts:91-180`, `app/api/cron/week-visibility/route.ts:48-72`
- Det betyr at `weekPlan`-dokumenter ikke brukes av `GET /api/week` sin ansattflyt i dag. `app/api/week/route.ts:1-3`, `app/api/week/route.ts:215-223`

## 6. Cron-jobber

| Filsti | Kjøre-tidspunkt | Hvilken modell | Hva den gjør | Konsekvens om den ikke kjører |
|---|---|---|---|---|
| `vercel.json` / `/api/cron/week-scheduler` | `*/10 * * * *`. `vercel.json:2-4` | Orkestrerer begge spor | Kaller `week-visibility` torsdag 08 innen 10-minuttersvindu og `lock-weekplans` fredag 15 innen 10-minuttersvindu. `app/api/cron/week-scheduler/route.ts:86-94` | Underjobbene trigges ikke av Vercel-scheduler. `app/api/cron/week-scheduler/route.ts:81-107` |
| `app/api/cron/week-visibility/route.ts` | Indirekte torsdag 08 via scheduler; også manuell `POST`. `app/api/cron/week-scheduler/route.ts:86-89`, `app/api/cron/week-visibility/route.ts:284-370` | `menuContent` + Supabase `menu_visibility_days` | Setter uke 2 synlig hvis godkjent torsdag 08 og skjuler uke 1 fredag 15; speiler datonivå til DB. `app/api/cron/week-visibility/route.ts:178-204`, `app/api/cron/week-visibility/route.ts:222-240`, `app/api/cron/week-visibility/route.ts:125-147` | `menuContent.customerVisible` og DB-speilet endres ikke av denne automatikken. `app/api/cron/week-visibility/route.ts:48-72`, `app/api/cron/week-visibility/route.ts:106-147` |
| `app/api/cron/lock-weekplans/route.ts` | Indirekte fredag 15 via scheduler. `app/api/cron/week-scheduler/route.ts:91-94` | `weekPlan` | Låser publiserte/synlige ukeplaner når dagens dato finnes i `days[]`. `app/api/cron/lock-weekplans/route.ts:11-18`, `app/api/cron/lock-weekplans/route.ts:47-57` | `weekPlan.lockedAt` settes ikke av denne jobben. `app/api/cron/lock-weekplans/route.ts:53-57` |
| `app/api/cron/meal-learning/route.ts` | Ikke funnet i `vercel.json`. `vercel.json:2-13` | Leser `menuDay`, skriver `mealIdea` | Leser `menuDay` med `mealRef`, sammenstiller ordre, patcher `mealIdea.aiMenuLearning`. `app/api/cron/meal-learning/route.ts:198-209`, `app/api/cron/meal-learning/route.ts:221-263` | AI-læringsfelt på `mealIdea` oppdateres ikke fra ordredata. `app/api/cron/meal-learning/route.ts:253-273` |

`workers/worker.ts` har ingen meny/uke-scheduling; den håndterer køjobbtyper som `retry_outbox`, `send_email`, `ai_generate` og `experiment_run`. `workers/worker.ts:49-80`

## 7. Anslått dokumentantall

| Modell | Repo-basert anslag uten live-query |
|---|---|
| `weekPlan` | Kun live-data — krever Sanity-query for å verifisere. Seed/dump for `weekPlan` er ikke funnet; skjema finnes i `studio/schemas/weekPlan.ts`. `studio/schemas/weekPlan.ts:64-68` |
| `menuDay` | Kun live-data — krever Sanity-query for å verifisere. Seed/dump for `menuDay` er ikke funnet; dokumenter opprettes dynamisk som `menuDay-${date}`. `studio/src/tools/WeekPlanner.tsx:74-76`, `studio/src/tools/WeekPlanner.tsx:256-269` |
| `menuContent` | Kun live-data — krever Sanity-query for å verifisere. `studio/seed/product-plans-and-menus.ndjson` seeder `productPlan` og `menu`, ikke `menuContent`. `studio/seed/product-plans-and-menus.ndjson:1-9`, `studio/schemaTypes/menuContent.ts:3-7` |
| Relatert `mealIdea` | Det finnes seed/dump med 1000 `mealIdea`-linjer i repoet. `studio/mealIdea_1000.ndjson:1-5`, `studio/seed/varmmatbank-1000.ndjson:1-5` |

## 8. Avhengigheter i Next.js

### 8.1 weekPlan

Server components som leser modellen:

| Route | Filsti | Hvilke felter |
|---|---|---|
| Ikke funnet | Ikke funnet | Ikke funnet |

API/lib-avhengigheter:

| Route/helper | Filsti | Hvilke felter |
|---|---|---|
| `GET /api/weekplan` | `app/api/weekplan/route.ts:33-101` | Returnerer `plan` fra `fetchNextPublishedWeekPlan`; leser `weekKey`, `weekStart`, `status`, publiseringsflagg, tider, `days`, `noteForKitchen` via helper. `lib/sanity/weekplan.ts:36-61` |
| `POST /api/weekplan/publish` | `app/api/weekplan/publish/route.ts:84-139` | Leser dokument, sjekker `lockedAt`, setter `approvedForPublish`, `customerVisible`, `publishedAt`. `app/api/weekplan/publish/route.ts:99-127` |
| `GET /api/weekplan/next` | `app/api/weekplan/next/route.ts:29-54` | Returnerer `plan: null` og deprecation-melding, leser ikke Sanity. `app/api/weekplan/next/route.ts:39-48` |
| `lock-weekplans` | `app/api/cron/lock-weekplans/route.ts:11-57` | Leser `_id`, `weekStart`, `days[].date`, setter `lockedAt`. `app/api/cron/lock-weekplans/route.ts:11-18`, `app/api/cron/lock-weekplans/route.ts:53-57` |

Client components som indirekte er avhengige:

| Komponent | Filsti | Hvilke felter |
|---|---|---|
| Ikke funnet | Ikke funnet | Ikke funnet |

Type-definisjoner:

| Filsti | Type-navn | Felt-liste |
|---|---|---|
| `lib/sanity/weekplan.ts:6-30` | `WeekPlanStatus`, `WeekPlanDay`, `WeekPlanDoc` | `WeekPlanDay` har `date`, `level`, `dishes`, `kitchenNote`; `WeekPlanDoc` har `_id`, `_type`, `weekKey`, `weekStart`, `status`, publiseringsflagg, tidsfelt, `days`, `noteForKitchen`. `lib/sanity/weekplan.ts:6-30` |

### 8.2 menuDay + menuContent

Server components som leser modellen:

| Route | Filsti | Hvilke felter |
|---|---|---|
| `/week` | `app/(app)/week/page.tsx:479-483` | Leser `MenuContent` per dato for superadmin-preview; bruker senere `title`, `description`, `isPublished` og kategorisering. `app/(app)/week/page.tsx:195-214`, `app/(app)/week/page.tsx:327-349` |
| `/menus/week` | `app/menus/week/page.tsx:72-76` | Leser `_id`, `date`, `title`, `tier`, `description`, `allergens`, `approvedForPublish`, `customerVisible`, `isPublished`. `app/menus/week/page.tsx:21-46`, `app/menus/week/page.tsx:121-155` |
| `/backoffice/week-menu` | `app/(backoffice)/backoffice/week-menu/page.tsx:16-19` | Leser `menu` per meal type, ikke `menuContent`; siden forklarer samtidig at operativ meny følger `menuContent`. `app/(backoffice)/backoffice/week-menu/page.tsx:30-37`, `app/(backoffice)/backoffice/week-menu/page.tsx:104-128` |

Client components som indirekte er avhengige:

| Komponent | Filsti | Hvilke felter |
|---|---|---|
| `WeekPreview` | `app/today/WeekPreview.tsx:113-131` | Fetcher `/api/week`, mapper `date`, `weekday`, `isPublished`, `description`, `allergens`. `app/today/WeekPreview.tsx:7-22`, `app/today/WeekPreview.tsx:124-131` |
| `EmployeeWeekClient` | `app/(app)/week/EmployeeWeekClient.tsx:130-162` | Mapper `/api/order/window`-payload til `menuTitle`, `menuDescription`, `allergens`, `menuImages`; denne ruten bruker `menu` per måltidstype, ikke `menuContent`. `app/(app)/week/EmployeeWeekClient.tsx:34-49`, `app/api/order/window/route.ts:586-620` |

API-avhengigheter:

| Route | Filsti | Hvilke felter |
|---|---|---|
| `GET /api/week` | `app/api/week/route.ts:165-192` | Leser `date`, `description`, `title`, `allergens`, `isPublished` via `MenuContent`. `lib/week/employeeWeekMenuDays.ts:38-59` |
| `POST /api/orders/set` | `app/api/orders/set/route.ts:114-123` | Krever publisert meny for dato via `getPublishedMenuForDate`. `app/api/orders/set/route.ts:114-123` |
| `GET /api/orders/week` | `app/api/orders/week/route.ts:52-77` | Leser publiserte datoer via `getMenuForDates`, `isPublished` og displayable copy. `app/api/orders/week/route.ts:52-77` |
| `GET /api/superadmin/menus-week` | `app/api/superadmin/menus-week/route.ts:93-163` | Leser `title`, `description`, `allergens`, `tier`, `approvedForPublish`, `customerVisible`, `_id`, `isPublished`, DB-speil. `app/api/superadmin/menus-week/route.ts:122-163` |
| `POST /api/backoffice/sanity/menu-content/publish` | `app/api/backoffice/sanity/menu-content/publish/route.ts:16-55` | Publiserer `menuContent` draft for `date`. `app/api/backoffice/sanity/menu-content/publish/route.ts:32-51` |
| `GET/POST /api/cron/week-visibility` | `app/api/cron/week-visibility/route.ts:39-147`, `app/api/cron/week-visibility/route.ts:150-370` | Leser/skriver `date`, `approvedForPublish`, `customerVisible`, `customerVisibleSetAt`; speiler `date/is_published`. `app/api/cron/week-visibility/route.ts:48-72`, `app/api/cron/week-visibility/route.ts:106-147` |
| `GET /api/cron/meal-learning` | `app/api/cron/meal-learning/route.ts:198-263` | Leser `menuDay.date`, `mealRef._ref`, `mealTitle`; skriver `mealIdea.aiMenuLearning`. `app/api/cron/meal-learning/route.ts:198-209`, `app/api/cron/meal-learning/route.ts:253-263` |

Type-definisjoner:

| Filsti | Type-navn | Felt-liste |
|---|---|---|
| `lib/sanity/queries.ts:15-43` | `MenuContent`, `SanityMenuDay` | `_id`, `date`, `title`, `tier`, `description`, `allergens`, `isPublished`, `approvedForPublish`, `approvedAt`, `customerVisible`, `customerVisibleSetAt`; `SanityMenuDay` er alias til `MenuContent`. `lib/sanity/queries.ts:15-43` |
| `studio/src/tools/WeekPlanner.tsx:19-38` | `DayDoc` | `_id`, `date`, `description`, `mealTitle`, `mealRef`, `allergens`, `mayContain`, `nutritionPer100g`, `kitchenStyle`, `costTier`, `estimatedCostPerPortion`, rettetypeflagg, godkjennings- og synlighetsfelt. `studio/src/tools/WeekPlanner.tsx:19-38` |
| `lib/week/employeeWeekMenuDays.ts:12-25` | `EmployeeWeekDayRow` | `date`, `weekday`, `dayKey`, `tier`, `isDeliveryDay`, `dishes`, `kitchenNote`, `isPublished`, `description`, `title`, `allergens`, `weekOffset`. `lib/week/employeeWeekMenuDays.ts:12-25` |
| `app/today/WeekPreview.tsx:7-22` | `MenuDayItem`, `WeekResp` | `date`, `weekday`, `isPublished`, `description`, `allergens`, `range`, `weekOffset`, `days`. `app/today/WeekPreview.tsx:7-22` |

### 8.3 TypeScript-typer som avviker fra skjema

| Avvik | Kilde |
|---|---|
| `MenuContent`-typen har `title` og `tier`, men `menuContent`-skjemaet definerer bare `date`, `description`, `allergens`, `isPublished`. `lib/sanity/queries.ts:15-25`, `studio/schemaTypes/menuContent.ts:8-55` |
| `MenuContent`-typen og GROQ-projeksjoner bruker `approvedForPublish`, `approvedAt`, `customerVisible`, `customerVisibleSetAt`, men disse feltene er ikke definert i `menuContent`-skjemaet. `lib/sanity/queries.ts:35-40`, `lib/sanity/queries.ts:111-120`, `studio/schemaTypes/menuContent.ts:8-55` |
| `SanityMenuDay` er et alias til `MenuContent`, selv om `menuDay` er en egen Sanity dokumenttype med flere felt. `lib/sanity/queries.ts:42-43`, `studio/schemaTypes/menuDay.ts:3-203` |
| `WeekPlanDay`-typen i `lib/sanity/weekplan.ts` har `dishes` og `kitchenNote`, men GROQ-projeksjonen tar ikke med `mealRef`, `mealTitle`, `description`, allergener, næring, kost eller godkjenningsflagg fra `weekPlan.days[]`. `lib/sanity/weekplan.ts:8-13`, `lib/sanity/weekplan.ts:50-60`, `studio/schemas/weekPlan.ts:169-353` |

## 9. Avhengigheter i Supabase

- `menu_visibility_days` er et DB-speil for ukemeny-synlighet; kommentaren sier at Sanity fortsatt er kilde for menyinnhold, og tabellen lagrer bare datonivå synlighet. `supabase/migrations/20260509184900_create_menu_visibility_days.sql:1-8`
- `week-visibility` skriver `menu_visibility_days` samtidig som den patcher Sanity `menuContent`. `app/api/cron/week-visibility/route.ts:106-147`
- `GET /api/superadmin/menus-week` leser både `menuContent` og `menu_visibility_days`, og bruker DB-speilet som publiseringsstatus-fallback. `app/api/superadmin/menus-week/route.ts:93-120`, `app/api/superadmin/menus-week/route.ts:136-139`
- `agreements.tier` er en Supabase enum med `BASIS` og `LUXUS`, og avtaler lagrer `delivery_days`; `GET /api/week` bruker disse feltene før Sanity-meny leses. `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:34-39`, `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:652-669`, `app/api/week/route.ts:114-149`
- `agreement_day_slot_rules` lagrer per-dag `tier` og brukes som daymap for operativ uke. `supabase/migrations/20260414220000_agreement_day_slot_rules_daymap.sql:11-14`, `supabase/migrations/20260414220000_agreement_day_slot_rules_daymap.sql:177-181`, `app/api/week/route.ts:148-149`
- En Supabase-tabell som speiler selve Sanity-menyteksten, `mealRef`, næring eller `weekPlan.days[]`, er ikke funnet i de kartlagte migrasjonene; funnet speil er kun `menu_visibility_days`. `supabase/migrations/20260509184900_create_menu_visibility_days.sql:1-8`

## 10. Risiko ved sletting

### 10.1 Hvis weekPlan slettes

Broken kodeflater hvis dokumenttypen/filer fjernes:

| Fil/route | Hvorfor |
|---|---|
| `lib/sanity/weekplan.ts` | Inneholder `WeekPlanDoc`-typer og GROQ mot `_type=="weekPlan"`. `lib/sanity/weekplan.ts:15-30`, `lib/sanity/weekplan.ts:66-94` |
| `lib/cms/weekPlan.ts` | Re-eksporterer `weekPlan`-helperne. `lib/cms/weekPlan.ts:3-18` |
| `app/api/weekplan/route.ts` | Importerer `fetchNextPublishedWeekPlan` og returnerer `plan`. `app/api/weekplan/route.ts:33-36`, `app/api/weekplan/route.ts:76-95` |
| `app/api/weekplan/publish/route.ts` | Krever `weekPlanId`, leser dokumentet og patcher publiseringsfelt. `app/api/weekplan/publish/route.ts:84-127` |
| `lib/sanity/weekPlanOps.ts` | Leser og patcher `weekPlan` etter `weekKey`. `lib/sanity/weekPlanOps.ts:8-24` |
| `app/api/cron/lock-weekplans/route.ts` | Leser `_type=="weekPlan"` og patcher `lockedAt`. `app/api/cron/lock-weekplans/route.ts:11-18`, `app/api/cron/lock-weekplans/route.ts:47-57` |
| `app/api/cron/week-scheduler/route.ts` | Kaller `/api/cron/lock-weekplans` fredag 15. `app/api/cron/week-scheduler/route.ts:91-94` |

Data som kan gå tapt:

- Live `weekPlan`-dokumenter kan inneholde `weekKey`, `weekStart`, status, publiseringsflagg, tidsfelt, `days[]`, legacy `dishes` og `noteForKitchen`; reelt antall live-dokumenter er ikke funnet uten Sanity-query. `studio/schemas/weekPlan.ts:70-141`, `studio/schemas/weekPlan.ts:143-353`, `studio/schemas/weekPlan.ts:431-435`

Felt som må avklares/migreres før sletting:

| Felt | Nærmeste alternative modell i kode |
|---|---|
| `weekKey`, `weekStart`, `status` | Ikke funnet direkte i `menuDay`/`menuContent`; uke beregnes fra dato i API/UI. `studio/schemas/weekPlan.ts:70-90`, `app/api/week/route.ts:153-160` |
| `approvedForPublish`, `customerVisible`, `publishedAt` | `menuDay` har godkjenning/synlighet per dag; `menuContent` runtime forventer `approvedForPublish/customerVisible` selv om skjemaet ikke har dem. `studio/schemaTypes/menuDay.ts:175-202`, `lib/sanity/queries.ts:56-72` |
| `days[].mealRef`, `days[].mealTitle`, `days[].description` | `menuDay` har tilsvarende `mealRef`, `mealTitle`, `description`. `studio/schemas/weekPlan.ts:169-190`, `studio/schemaTypes/menuDay.ts:16-34` |
| `days[].nutritionPer100g`, `allergens`, `mayContain`, `kitchenStyle`, `costTier`, `estimatedCostPerPortion` | `menuDay` har tilsvarende felt; `menuContent` har ikke disse i skjema. `studio/schemas/weekPlan.ts:192-302`, `studio/schemaTypes/menuDay.ts:36-151`, `studio/schemaTypes/menuContent.ts:8-55` |
| `days[].dishes` | Kun `weekPlan` har legacy `dish`-referanser i denne modellgruppen. `studio/schemas/weekPlan.ts:339-347` |
| `noteForKitchen` / `kitchenNote` | `weekPlan` har toppnivå og per-dag kjøkkennotat; `menuDay`/`menuContent` har ikke funnet tilsvarende felt. `studio/schemas/weekPlan.ts:349-353`, `studio/schemas/weekPlan.ts:431-435`, `studio/schemaTypes/menuDay.ts:8-203` |

### 10.2 Hvis menuDay+menuContent slettes

Broken kodeflater hvis dokumenttypene/filer fjernes:

| Fil/route | Hvorfor |
|---|---|
| `studio/src/tools/WeekPlanner.tsx` | Leser, oppretter, autofyller, godkjenner og redigerer `menuDay`. `studio/src/tools/WeekPlanner.tsx:146-189`, `studio/src/tools/WeekPlanner.tsx:256-269`, `studio/src/tools/WeekPlanner.tsx:275-418`, `studio/src/tools/WeekPlanner.tsx:531-533` |
| `app/api/cron/meal-learning/route.ts` | Leser `menuDay` med `mealRef` for læringsoppdatering. `app/api/cron/meal-learning/route.ts:198-209` |
| `lib/sanity/queries.ts` / `lib/cms/menuContent.ts` | Alle dato-baserte `menuContent`-reads og publisert-meny helperne forsvinner. `lib/sanity/queries.ts:91-278`, `lib/cms/menuContent.ts:1-20` |
| `app/api/week/route.ts` | Leser `menuContent` for `days` og markerer `weekPlanOperational: false`. `app/api/week/route.ts:165-192`, `app/api/week/route.ts:215-223` |
| `app/(app)/week/page.tsx` | Leser `menuContent` for superadmin-preview. `app/(app)/week/page.tsx:479-483` |
| `app/menus/week/page.tsx` | Leser adminliste av `menuContent`. `app/menus/week/page.tsx:72-76` |
| `app/api/orders/set/route.ts` | Bestilling blokkeres uten publisert `menuContent` for dato. `app/api/orders/set/route.ts:114-123` |
| `app/api/orders/week/route.ts` | Leser publiserte datoer fra `menuContent`. `app/api/orders/week/route.ts:52-77` |
| `app/api/superadmin/menus-week/route.ts` | Leser `menuContent` og DB-speil for status. `app/api/superadmin/menus-week/route.ts:93-163` |
| `app/api/cron/week-visibility/route.ts` | Patcher `menuContent` og speiler datoer til DB. `app/api/cron/week-visibility/route.ts:39-147`, `app/api/cron/week-visibility/route.ts:150-370` |
| `app/api/backoffice/sanity/menu-content/publish/route.ts` / `lib/sanity/menuContentPublishOps.ts` | Publiseringsbroker for `menuContent` blir uten målmodell. `app/api/backoffice/sanity/menu-content/publish/route.ts:16-55`, `lib/sanity/menuContentPublishOps.ts:25-60` |

Data som kan gå tapt:

- `menuDay` live-data kan inneholde per-dato `mealRef`, rettetittel, allergener, næring, råvarekost, rettetypeflagg, godkjenningsfelt og synlighetsfelt; antall live-dokumenter er ikke funnet uten Sanity-query. `studio/schemaTypes/menuDay.ts:9-203`
- `menuContent` live-data kan inneholde dato, menybeskrivelse, allergener og `isPublished`; runtime-kode forventer i tillegg felter som ikke finnes i skjemaet. `studio/schemaTypes/menuContent.ts:8-55`, `lib/sanity/queries.ts:15-40`

Felt som må avklares/migreres før sletting:

| Felt | Nærmeste alternative modell i kode |
|---|---|
| `menuDay.mealRef`, `mealTitle`, `description` | `weekPlan.days[]` har tilsvarende `mealRef`, `mealTitle`, `description`. `studio/schemaTypes/menuDay.ts:16-34`, `studio/schemas/weekPlan.ts:169-190` |
| `menuDay` allergener/næring/kost/kjøkkenstil | `weekPlan.days[]` har tilsvarende felt. `studio/schemaTypes/menuDay.ts:36-151`, `studio/schemas/weekPlan.ts:192-302` |
| `menuDay.approvedForPublish/customerVisible` | `weekPlan` har toppnivå godkjenning/synlighet, ikke samme per-dato struktur. `studio/schemaTypes/menuDay.ts:175-202`, `studio/schemas/weekPlan.ts:93-105` |
| `menuContent.description/allergens/isPublished` | `weekPlan.days[].description/allergens` finnes, men `isPublished` som `menuContent`-felt finnes ikke i `weekPlan`. `studio/schemaTypes/menuContent.ts:17-54`, `studio/schemas/weekPlan.ts:186-201` |
| `menu_visibility_days` kobling | Speilet er datonivå og peker ikke til Sanity-ID; det kan ikke alene rekonstruere menyinnhold. `supabase/migrations/20260509184900_create_menu_visibility_days.sql:4-8` |

## 11. Commit-historikk

### 11.1 weekPlan

Første 20 commits for `studio/schemas/weekPlan.ts`:

| Commit | Dato | Melding |
|---|---|---|
| `d60cd355` | 2026-04-26 | `fix: configure Umbraco domain and web config` |
| `24bec71a` | 2026-04-09 | `runtime/core: commit tracked KEEP slice` |
| `7be169f9` | 2026-01-31 | `ci: stabilize build by forcing dynamic routes and late imports` |
| `debc71bb` | 2026-01-23 | `Deploy: invites + employees admin + disabled gate + docs` |

### 11.2 menuDay

Første 20 commits for `studio/schemaTypes/menuDay.ts`:

| Commit | Dato | Melding |
|---|---|---|
| `d60cd355` | 2026-04-26 | `fix: configure Umbraco domain and web config` |
| `0bf67250` | 2026-01-18 | `Initial commit: production-ready build` |

### 11.3 menuContent

Første 20 commits for `studio/schemaTypes/menuContent.ts`:

| Commit | Dato | Melding |
|---|---|---|
| `0bf67250` | 2026-01-18 | `Initial commit: production-ready build` |
| `b548261f` | 2026-01-14 | `v3 – stabil baseline (app + studio)` |

## 12. Mulige fortolkninger av status quo

### Hypotese A — `weekPlan` er nyere og var ment å erstatte `menuDay`+`menuContent`

Evidens for:

- `weekPlan` har rik ukestruktur, statusmodell, publiseringsfelt, låsing, kjøkkennotat og legacy `dish`-referanser i ett dokument. `studio/schemas/weekPlan.ts:70-141`, `studio/schemas/weekPlan.ts:143-353`, `studio/schemas/weekPlan.ts:431-435`
- `weekPlan` har egne API-er for publish og next/current-lignende lesing. `app/api/weekplan/route.ts:33-101`, `app/api/weekplan/publish/route.ts:60-147`

Evidens mot:

- Aktiv Studio-konfigurasjon registrerer ikke `weekPlan` i `studio/schemaTypes/index.ts`. `studio/sanity.config.ts:4-5`, `studio/schemaTypes/index.ts:26-37`
- `GET /api/week` sier eksplisitt at `weekPlan` ikke er operativ sannhet. `app/api/week/route.ts:1-3`
- `lib/cms/weekPlan.ts` er merket deprecated for employee runtime. `lib/cms/weekPlan.ts:3-8`

### Hypotese B — `menuDay`+`menuContent` er nyere operativ retning, og gammel `weekPlan`-kode er ikke ryddet opp

Evidens for:

- Aktiv schema-index registrerer `menuContent` og `menuDay`, ikke `weekPlan`. `studio/schemaTypes/index.ts:26-37`
- `GET /api/week` bruker `menuContent` og returnerer `weekPlanOperational: false`. `app/api/week/route.ts:165-192`, `app/api/week/route.ts:215-223`
- `app/(backoffice)/backoffice/week-menu/page.tsx` omtaler `weekPlan` som redaksjonelt/LIMITED og `menuContent` som operativ ansatt-sannhet. `app/(backoffice)/backoffice/week-menu/page.tsx:30-37`, `app/(backoffice)/backoffice/week-menu/page.tsx:94-97`

Evidens mot:

- `weekPlan` har fortsatt API, publish-route og cron-låsing. `app/api/weekplan/route.ts:33-101`, `app/api/weekplan/publish/route.ts:60-147`, `app/api/cron/lock-weekplans/route.ts:24-77`
- `week-scheduler` kaller fortsatt `lock-weekplans` fredag 15. `app/api/cron/week-scheduler/route.ts:91-94`

### Hypotese C — Modellene har ulike formål: `weekPlan` for redaksjonell plan/policy, `menuDay`/`menuContent` for daglig drift/visning

Evidens for:

- `lib/sanity/weekplan.ts` kommenterer `weekPlan` som redaksjonell ukeplan og peker til `GET /api/week + menuContent` for operativ employee-sannhet. `lib/sanity/weekplan.ts:1-3`
- Backoffice-teksten skiller mellom operativ ansatt-sannhet (`menuContent`) og redaksjonell ukeplan (`weekPlan`). `app/(backoffice)/backoffice/week-menu/page.tsx:30-37`, `app/(backoffice)/backoffice/week-menu/page.tsx:50-58`
- `menu_visibility_days` kommenterer at Sanity er kilde for menyinnhold, og tabellen lagrer bare synlighet på dato. `supabase/migrations/20260509184900_create_menu_visibility_days.sql:1-8`

Evidens mot:

- Aktiv Studio `Ukeplan`-tool skriver `menuDay`, ikke `weekPlan`, selv om UI-navnet er `Ukeplan`. `studio/deskStructure.ts:10-13`, `studio/src/tools/WeekPlanner.tsx:256-269`
- `menuDay` har også redaksjonelle felt som godkjenning, synlighet, næring og råvarekost, som overlapper med `weekPlan.days[]`. `studio/schemaTypes/menuDay.ts:52-202`, `studio/schemas/weekPlan.ts:214-337`

### Hypotese D — Begge er forsøk på samme problem, og ingen ble fullført som én kanon

Evidens for:

- `weekPlan`, `menuDay`, `menuContent`, `menu`, Supabase-avtale og DB-speilet beskriver ulike deler av uke/meny-flyten samtidig. `app/api/week/route.ts:114-149`, `lib/sanity/queries.ts:91-180`, `studio/src/tools/WeekPlanner.tsx:256-345`, `supabase/migrations/20260509184900_create_menu_visibility_days.sql:1-8`
- TypeScript-typen `SanityMenuDay` er alias til `MenuContent`, mens `menuDay` er en annen Sanity dokumenttype. `lib/sanity/queries.ts:42-43`, `studio/schemaTypes/menuDay.ts:3-7`
- `menuContent` runtime-projeksjoner forventer kontrollfelt som ikke finnes i `menuContent`-skjemaet. `lib/sanity/queries.ts:35-40`, `studio/schemaTypes/menuContent.ts:8-55`

Evidens mot:

- Det finnes eksplisitte kommentarer og UI-copy som forsøker å avgrense `weekPlan` som ikke-operativ employee-kilde. `app/api/week/route.ts:1-3`, `lib/cms/weekPlan.ts:3-8`, `app/(backoffice)/backoffice/week-menu/page.tsx:94-97`

## 13. Åpne spørsmål

- Hvilken Sanity Studio-instans er faktisk deployet: aktiv rot-`studio/sanity.config.ts` med `./schemaTypes`, eldre `studio/src`-spor, eller `studio/lunchportalen-studio` med tom schema-liste? `studio/sanity.config.ts:4-5`, `studio/src/structure.ts:1-19`, `studio/lunchportalen-studio/schemaTypes/index.ts:1`
- Finnes det live `weekPlan`-dokumenter med historikk som må bevares før eventuell beslutning? `studio/schemas/weekPlan.ts:70-141`, `studio/schemas/weekPlan.ts:143-353`
- Finnes det live `menuDay`-dokumenter som faktisk brukes av kjøkken/drift utenfor funnene i denne rapporten? `studio/src/tools/WeekPlanner.tsx:146-189`, `app/api/cron/meal-learning/route.ts:198-209`
- Hvorfor forventer `menuContent`-queries feltene `title`, `tier`, `approvedForPublish`, `approvedAt`, `customerVisible` og `customerVisibleSetAt` når skjemaet ikke definerer dem? `lib/sanity/queries.ts:15-40`, `studio/schemaTypes/menuContent.ts:8-55`
- Skal `menu_visibility_days` være autoritativ publiseringsstatus for superadminstatus, eller bare observasjon/speil av Sanity? `app/api/superadmin/menus-week/route.ts:136-139`, `supabase/migrations/20260509184900_create_menu_visibility_days.sql:1-8`
- Er `app/api/weekplan/*` fortsatt en offentlig/stabil kontrakt, eller kun bakoverkompatibel/deprecated fasade? `app/api/weekplan/route.ts:1-3`, `app/api/weekplan/next/route.ts:29-54`
- Skal Studio-sidebarens `Ukeplan` forstås som `menuDay`-planlegging, mens Sanity-dokumenttypen `weekPlan` er et separat redaksjonelt dokument, eller er dette navnekollisjon? `studio/deskStructure.ts:10-13`, `studio/src/tools/WeekPlanner.tsx:256-269`, `studio/schemas/weekPlan.ts:64-68`

## 14. Status etter beslutning

- 2026-05-12: `weekPlan` ble slettet etter live-verifisering av 0 dokumenter i Sanity production og tom backup-dump i `docs/audit/sanity-dump/weekPlan.ndjson`. Se `docs/audit/sanity-live-state.md:17`, `docs/audit/sanity-live-state.md:69-73`.

`menuDay` er kanonisk meny-modell. `weekPlan` og `menuContent` slettet. Se `current-menu-architecture.md` §16.
