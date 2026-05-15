# Lunchportalen — kartlegging av dagens meny-arkitektur

**Dato:** 2026-05-12  
**Repo-commit:** 0625628d64c37e2302242bf62ec47ee65a3aea48  
**Branch:** main

---

## 1. Sammendrag

- Sanity Studio viser `Ukeplan` via custom `WeekPlannerTool`, ikke som dokumentliste; sidebaren peker til komponenten. `studio/deskStructure.ts:10-13`
- Custom ukeplanverktøyet oppretter/muterer `menuDay`-dokumenter per dato, mens et eget `weekPlan`-skjema også finnes registrert som redaksjonell ukeplan. `studio/src/tools/WeekPlanner.tsx:245-258`
- Next employee-uken (`/week`) sier selv at operativ sannhet er `company_current_agreement` + `menuContent`, ikke Sanity `weekPlan`. `app/api/week/route.ts:1-3`
- Sanity read-client bruker `useCdn: true` og `perspective: published`; write-client krever token, `useCdn: false`. `lib/sanity/client.ts:13-19`
- Supabase `agreements.tier` er `public.agreement_tier`, og enumverdiene som opprettes er `BASIS` og `LUXUS`. `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:34-39`
- Datohelperen `formatDateNO` produserer `DD-MM-YYYY`, som avviker fra påkrevd `dd.MM.yyyy`. `lib/date/format.ts:37-40`
- WeekPlanner-formatet `formatNordicDate` produserer `dd.MM.yyyy`, men uten tre-bokstavs ukedag i ukeplanvisning. `studio/src/tools/WeekPlanner.tsx:77-80`
- Umbraco CSS ligger under `umbraco17/lunchportalen/wwwroot/css`; etterspurt `wwwroot/css/fordeler.css` ble ikke funnet som fil. `umbraco17/lunchportalen/wwwroot/css/design-system.css:1`
- Eksisterende tier/plan-begreper finnes i Sanity, Supabase, Next og UI-copy (`BASIS`, `LUXUS`, `STANDARD`, `PREMIUM`). `studio/schemas/weekPlan.ts:4-7`
- API-rutene for uke/order/kitchen/driver/agreement er kartlagt med metodefunn i §9. `app/api/week/route.ts:81-86`

## 2. Repostruktur

`ls -la` ble forsøkt i PowerShell, men PowerShell-aliasen `ls` støttet ikke `-la`; rotoversikten ble derfor hentet med `Get-ChildItem -Force`. Toppnivå-mapper:

- `.backups/`
- `.claude/`
- `.cursor/`
- `.git/`
- `.githooks/`
- `.github/`
- `.next/`
- `.tmp/`
- `.vercel/`
- `.vscode/`
- `app/`
- `archive/`
- `artifacts/`
- `audit/`
- `components/`
- `config/`
- `Controllers/`
- `cua/`
- `design/`
- `docs/`
- `domain/`
- `e2e/`
- `evidence/`
- `infra/`
- `k8s/`
- `lib/`
- `node_modules/`
- `perf/`
- `playwright-report/`
- `plugins/`
- `public/`
- `repo-intelligence/`
- `reports/`
- `scripts/`
- `src/`
- `studio/`
- `supabase/`
- `superadmin/`
- `test-results/`
- `tests/`
- `tmp/`
- `tools/`
- `Umbraco/`
- `umbraco17/`
- `utils/`
- `workers/`

Klassifisering: Next.js-app ligger i `app/` og rotpakken har Next scripts/dependency `package.json:7-16`, `package.json:90`; Sanity Studio ligger i `studio/` med `sanity.config.ts` `studio/sanity.config.ts:22-34`; Umbraco-laget ligger i `umbraco17/lunchportalen/` og `Umbraco/` med .csproj-filer i §14; infrastruktur finnes i `supabase/`, `infra/`, `k8s/`; dokumentasjon finnes i `docs/`.

Node-pakker:

| Pakke | Fil | Scripts |
|---|---|---|
| `lunchportalen` | `package.json:2` / `package.json:7` | `dev, dev:rc, build, build:enterprise, build:enterprise:ci, start, lint, lint:ci, typecheck, verify:production-public-cms, test, test:run, test:watch, test:tenant, test:rls, test:db, db:rebuild-verify, db:types, e2e, e2e:ui, e2e:headed, e2e:update-snapshots, e2e:install, e2e:debug, check:admin-copy, check:ai-internal-provider, audit:api, audit:repo, audit:generate, audit:full, audit:tasks, autonomous:fix, autonomous:validate, autonomous:run, evolution:run, verify:control-coverage, sanity:live, agents:check, ci:guard, api:contract, status:guard, mock:check, cms:check, ai:check, ui:clickable-check, ci:platform-guards, preflight, ci:enterprise, ci:critical, push:ok, hooks:install, hooks:check, postdeploy, seo:proof, seo:audit, seo:content-lint, system:test, test:social-flow, repo:scan, repo:update, seed:sanity-menu, worker:queue` |
| `lunchportalen-studio` | `studio/lunchportalen-studio/package.json:2` / `studio/lunchportalen-studio/package.json:7` | `dev, start, build, deploy, deploy-graphql` |
| `portalen` | `studio/package.json:2` / `studio/package.json:8` | `dev, start, build, deploy, deploy-graphql` |

Monorepo-verktøy: `pnpm-workspace.yaml`, `turbo.json`, `nx.json` og `lerna.json` ble ikke funnet i filsystemskanningen; rotpakken bruker npm scripts direkte. `package.json:7-70`

## 3. Sanity-skjemaer

### 3.1 ukeplan
- Fil: `studio/schemas/weekPlan.ts:64-468`
- Skjema: `name: weekPlan`, `title: Ukeplan`, `type: document`. `studio/schemas/weekPlan.ts:64-67`
- Liste/singleton: registrert som schema type, men ikke lagt som dokumentliste i desk-strukturen; desk viser custom komponent for `Ukeplan`. `studio/schemaTypes/index.ts:26-37`, `studio/deskStructure.ts:10-13`
- Felter:

| Navn | Type | Validering | Referanser |
|---|---|---|---|
| weekKey | string | required + regex `^\d{4}-W\d{2}$` | Ikke funnet |
| weekStart | date | required | Ikke funnet |
| status | string | required; options `draft/open/current/archived` | Ikke funnet |
| approvedForPublish | boolean | initialValue false | Ikke funnet |
| customerVisible | boolean | initialValue false | Ikke funnet |
| visibleFrom/becomesCurrentAt/publishedAt/lockedAt | datetime | readOnly | Ikke funnet |
| locked | boolean | readOnly + initialValue false | Ikke funnet |
| days[] | array<object weekDay> | custom: 5 dager, unike datoer, unike varmretter, maks én fiskerett og én suppe | `mealRef -> mealIdea`, `dishes -> dish` legacy |
| noteForKitchen | text | Ikke funnet | Ikke funnet |

Kilder for feltene: `studio/schemas/weekPlan.ts:70-90`, `studio/schemas/weekPlan.ts:93-141`, `studio/schemas/weekPlan.ts:143-190`, `studio/schemas/weekPlan.ts:192-353`, `studio/schemas/weekPlan.ts:391-428`, `studio/schemas/weekPlan.ts:431-435`. Preview bruker `weekKey/weekStart/status/approved/customerVisible/locked/days`. `studio/schemas/weekPlan.ts:438-467`

### 3.2 menyinnhold
- Fil: `studio/schemaTypes/menuContent.ts:3-73`
- Skjema: `name: menuContent`, `title: Menyinnhold`, `type: document`. `studio/schemaTypes/menuContent.ts:3-7`

| Navn | Type | Validering | Referanser |
|---|---|---|---|
| date | date | required | Ikke funnet |
| description | text | required + min 8 | Ikke funnet |
| allergens | array<string> | tags layout | Ikke funnet |
| isPublished | boolean | initialValue false; custom krever description ved publisering | Ikke funnet |

Preview: `date/description/isPublished`, media `✅` eller `🕒`. `studio/schemaTypes/menuContent.ts:57-72`

### 3.3 menytyper
- Fil: `studio/schemaTypes/menu.ts:3-101`
- Skjema: `name: menu`, `title: Meny (mealType)`, `type: document`. `studio/schemaTypes/menu.ts:3-7`

| Navn | Type | Validering | Referanser |
|---|---|---|---|
| mealType | string | required; options paasmurt/salat/sushi/pokebowl/thai | Ikke funnet |
| title | string | required min 2 max 120 | Ikke funnet |
| description | text | Ikke funnet | Ikke funnet |
| allergens | array<string> | tags layout | Ikke funnet |
| images | array<image> | hotspot | asset |
| image | image | hidden hvis images finnes | asset |
| nutrition | object | Ikke funnet | Ikke funnet |
| variants | array<object> | variant-felter, allergener tags | Ikke funnet |

Kilder: `studio/schemaTypes/menu.ts:8-64`, `studio/schemaTypes/menu.ts:65-93`. Preview: `studio/schemaTypes/menu.ts:95-100`

### 3.4 stengte dager
- Fil: `studio/schemaTypes/closedDate.ts:3-20`
- Skjema: `name: closedDate`, `title: Stengt dag`, `type: document`. `studio/schemaTypes/closedDate.ts:3-6`

| Navn | Type | Validering | Referanser |
|---|---|---|---|
| date | date | required | Ikke funnet |
| reason | string | Ikke funnet | Ikke funnet |

### 3.5 driftsmeldinger
- Fil: `studio/schemaTypes/announcement.ts:3-42`
- Skjema: `name: announcement`, `title: Driftsmelding`, `type: document`. `studio/schemaTypes/announcement.ts:3-6`

| Navn | Type | Validering | Referanser |
|---|---|---|---|
| title | string | required | Ikke funnet |
| message | text | required | Ikke funnet |
| active | boolean | initialValue true | Ikke funnet |
| severity | string | options info/warning/critical, radio, initialValue info | Ikke funnet |

### 3.6 Øvrige refererte dokumenter
- `menuDay` er dagkort brukt av WeekPlanner og registrert fordi WeekPlanner oppretter `_type: menuDay`. `studio/schemaTypes/index.ts:21-24`, `studio/schemaTypes/menuDay.ts:3-7`
- `menuDay.mealRef` refererer til `mealIdea`. `studio/schemaTypes/menuDay.ts:16-21`
- `menuDay` har allergener, `mayContain`, `nutritionPer100g`, `kitchenStyle`, `costTier`, `estimatedCostPerPortion`, publiseringsfelter og synlighetsfelter. `studio/schemaTypes/menuDay.ts:36-151`, `studio/schemaTypes/menuDay.ts:175-202`
- `dish` finnes som legacy rett med `title`, `description`, `allergens`, `tags`. `studio/schemas/dish.ts:3-36`
- `mealIdea` er `Varmmatbank` og brukes av auto-generatoren; skjemaet definerer `TARGET_PRICE_PER_PORTION = 90`. `studio/schemaTypes/mealIdea.ts:3-8`
- `mealIdea` har felter for kost/næring/allergener/AI læring/aktivitet/brukshistorikk. `studio/schemaTypes/mealIdea.ts:102-137`, `studio/schemaTypes/mealIdea.ts:181-291`, `studio/schemaTypes/mealIdea.ts:302-377`
- `weekTemplate` finnes som valgfri preset for `mealType per ukedag`. `studio/schemaTypes/weekTemplate.ts:3-36`

## 4. Sanity Studio

### 4.1 Konfigurasjon
- Studio config bruker `defineConfig`, `deskTool`, `structure` og `schemaTypes`. `studio/sanity.config.ts:1-5`
- `projectId` leses fra `SANITY_STUDIO_PROJECT_ID` eller `NEXT_PUBLIC_SANITY_PROJECT_ID`; `dataset` fra `SANITY_STUDIO_DATASET`, `NEXT_PUBLIC_SANITY_DATASET` eller `production`. `studio/sanity.config.ts:7-14`
- Pluginlisten er `deskTool({ structure })`; basePath er ikke funnet i `studio/sanity.config.ts`. `studio/sanity.config.ts:22-34`
- CLI-config har `projectId: 4udoq5d8`, `dataset: production`, `autoUpdates: false`. `studio/sanity.cli.ts:3-10`

### 4.2 Struktur (sidebar)
- Sidebar-tittel er `Lunchportalen`. `studio/deskStructure.ts:6-9`
- `Ukeplan` renderer `WeekPlannerTool` som component child. `studio/deskStructure.ts:10-13`
- `Menyinnhold`, `Menytyper`, `Stengte dager`, `Driftsmeldinger` er documentTypeListItems for `menuContent`, `menu`, `closedDate`, `announcement`. `studio/deskStructure.ts:17-31`

### 4.3 Custom actions
| Knapp | Komponent | Handler | Muterer |
|---|---|---|---|
| Opprett uke 1 | `studio/src/tools/WeekPlanner.tsx:553-557` | `createWeek` | `createIfNotExists` for `menuDay` med date/description/mealTitle/allergens/mayContain/approvedForPublish/customerVisible. `studio/src/tools/WeekPlanner.tsx:245-258` |
| Opprett uke 2 | `studio/src/tools/WeekPlanner.tsx:558-562` | `createWeek` | samme som over. `studio/src/tools/WeekPlanner.tsx:245-258` |
| Auto-fyll uke 1 | `studio/src/tools/WeekPlanner.tsx:563-567` | `autoFillWeek` | patcher `menuDay` og `mealIdea` usage/lastUsedDate. `studio/src/tools/WeekPlanner.tsx:264-345` |
| Auto-fyll uke 2 | `studio/src/tools/WeekPlanner.tsx:568-572` | `autoFillWeek` | samme som over. `studio/src/tools/WeekPlanner.tsx:264-345` |
| Godkjenn uke 2 | `studio/src/tools/WeekPlanner.tsx:573-578` | `approveWeek2` | setter `approvedForPublish: true`, `approvedAt`. `studio/src/tools/WeekPlanner.tsx:356-399` |
| Trekk godkjenning | `studio/src/tools/WeekPlanner.tsx:579-584` | `revokeWeek2` | setter `approvedForPublish:false`, `customerVisible:false`, unsetter tidsstempler. `studio/src/tools/WeekPlanner.tsx:409-424` |
| Oppdater | `studio/src/tools/WeekPlanner.tsx:585` | `fetchWeeks` | leser `menuDay`, muterer ikke. `studio/src/tools/WeekPlanner.tsx:135-178` |

Validatorer: auto-fyll stopper hvis eksisterende docs har `approvedForPublish`, generator krever gyldige `mealIdea` med aktiv status og nutrition, og godkjenning krever 5 dager, menybeskrivelse og `nutritionPer100g.energyKcal`. `studio/src/tools/WeekPlanner.tsx:272-299`, `lib/menu-publish/generateWeekMenu.ts:114-120`, `studio/src/tools/WeekPlanner.tsx:379-387`

### 4.4 Status-badges
- Dag-badges `Godkjent/Ikke godkjent` og `Synlig/Skjult` rendres i WeekPlanner. `studio/src/tools/WeekPlanner.tsx:480-486`
- Uke-badges `Uke 1 godkjent`, `Uke 1 synlig`, `Uke 2 godkjent`, `Uke 2 synlig` rendres fra `stats`. `studio/src/tools/WeekPlanner.tsx:453-460`, `studio/src/tools/WeekPlanner.tsx:589-601`
- `menuDay` preview bruker `Ikke godkjent` og `Skjult`. `studio/schemaTypes/menuDay.ts:215-230`
- `weekPlan` preview bruker `Ikke godkjent` og `Skjult`. `studio/schemas/weekPlan.ts:448-465`

### 4.5 Felter på rett-/dag-/uke-niv?
- `Allergener`: `menuContent`-nivå `studio/schemaTypes/menuContent.ts:28-36`, menytype/variant `studio/schemaTypes/menu.ts:36-42`, `studio/schemaTypes/menu.ts:83-89`, dagkort `studio/schemaTypes/menuDay.ts:36-42`, `weekPlan.days[]` `studio/schemas/weekPlan.ts:192-201`, rett/basebank `studio/schemaTypes/mealIdea.ts:181-205`.
- `Kan inneholde spor av`: dagkort `studio/schemaTypes/menuDay.ts:44-50`, `weekPlan.days[]` `studio/schemas/weekPlan.ts:203-212`, basebank `studio/schemaTypes/mealIdea.ts:207-228`.
- `Næring`: menytype `studio/schemaTypes/menu.ts:56-64`, dagkort `studio/schemaTypes/menuDay.ts:52-112`, `weekPlan.days[]` `studio/schemas/weekPlan.ts:214-275`, basebank `studio/schemaTypes/mealIdea.ts:230-291`.
- `Kjøkkenstil`: dagkort `studio/schemaTypes/menuDay.ts:114-131`, `weekPlan.days[]` `studio/schemas/weekPlan.ts:277-285`, basebank `studio/schemaTypes/mealIdea.ts:74-93`.
- `Kostnadsnivå`: dagkort `studio/schemaTypes/menuDay.ts:133-145`, `weekPlan.days[]` `studio/schemas/weekPlan.ts:287-295`, basebank `studio/schemaTypes/mealIdea.ts:123-137`.
- `Råvarekost` og `Margin mot 90 kr`: WeekPlanner-visning `studio/src/tools/WeekPlanner.tsx:514-516`; basebank beregner margin mot `TARGET_PRICE_PER_PORTION = 90`. `studio/schemaTypes/mealIdea.ts:3-4`, `studio/schemaTypes/mealIdea.ts:455-458`

## 5. GROQ-queries
| Fil:linje | Brukt i | Kort beskrivelse |
|---|---|---|
| `app/api/backoffice/cms/menu-draft/route.ts:91` | `app/api/backoffice/cms/menu-draft/route.ts` | L91 const fetched = await client.fetch(`*[_type == "menu" & |
| `app/api/cron/lock-weekplans/route.ts:12` | `app/api/cron/lock-weekplans/route.ts` | L12 *[_type=="weekPlan" |
| `app/api/cron/meal-learning/route.ts:198` | `app/api/cron/meal-learning/route.ts` | L198 const menuDays = await sanity.fetch<MenuDayRow[]>(; L200 _type == "menuDay" && |
| `app/api/cron/week-visibility/route.ts:50` | `app/api/cron/week-visibility/route.ts` | L50 _type=="menuContent" &&; L81 _type=="menuContent" && |
| `lib/cms/getMenuByMealType.ts:23` | `lib/cms/getMenuByMealType.ts` | L23 const doc = await sanity.fetch(; L24 `*[_type == "menu" && mealType == $mealType][0]{ |
| `lib/cms/getMenusByMealTypes.ts:21` | `lib/cms/getMenusByMealTypes.ts` | L21 const rows = await sanity.fetch(; L22 `*[_type == "menu" && mealType in $mealTypes]{ |
| `lib/cms/getProductPlan.ts:18` | `lib/cms/getProductPlan.ts` | L18 const doc = await sanity.fetch( |
| `lib/cms/getWeekTemplate.ts:16` | `lib/cms/getWeekTemplate.ts` | L16 const doc = await sanity.fetch( |
| `lib/sanity/menuContentPublishOps.ts:32` | `lib/sanity/menuContentPublishOps.ts` | L32 const draftId = await client.fetch<string | null>(; L33 `*[_type == "menuContent" && date == $date && _id in pa; L38 const anyDoc = await client.fetch<{ _id: string } | nul |
| `lib/sanity/queries.ts:78` | `lib/sanity/queries.ts` | L78 return sanity.fetch(; L79 `*[_type == "announcement" && active == true][0]{; L98 const row = await sanity.fetch( |
| `lib/sanity/weekplan.ts:71` | `lib/sanity/weekplan.ts` | L71 *[_type=="weekPlan" && status=="current" && ${WEEKPLAN_; L72 *[_type=="weekPlan" && ${WEEKPLAN_LIVE_FILTER}] | order; L85 _type=="weekPlan" && |
| `lib/sanity/weekPlanOps.ts:11` | `lib/sanity/weekPlanOps.ts` | L11 `*[_type=="weekPlan" && weekKey==$weekKey][0]{_id, stat |
| `studio/schemaTypes/mealIdea.ts:388` | `studio/schemaTypes/mealIdea.ts` | L388 const query = `count(*[_type == "mealIdea" && title == ; L389 const count = await client.fetch(query, { |
| `studio/src/tools/WeekPlanner.tsx:161` | `studio/src/tools/WeekPlanner.tsx` | L161 _type == "menuDay" &&; L186 client.fetch<DayDoc[]>(query, { dates: ranges.week1.dat; L187 client.fetch<DayDoc[]>(query, { dates: ranges.week2.dat |
| `studio/src/tools/WeekPlanner.tsx:141` | `studio/src/tools/WeekPlanner.tsx` | L141 _type == "menuDay" &&; L166 client.fetch<DayDoc[]>(query, { dates: ranges.week1.dat; L167 client.fetch<DayDoc[]>(query, { dates: ranges.week2.dat |

Query-utdrag med linjer:

- `app/api/backoffice/cms/menu-draft/route.ts`
  - `app/api/backoffice/cms/menu-draft/route.ts:91`: `const fetched = await client.fetch('*[_type == "menu" && mealType == $k]{ _id }', { k: mealKey });`
- `app/api/cron/lock-weekplans/route.ts`
  - `app/api/cron/lock-weekplans/route.ts:12`: `*[_type=="weekPlan"`
- `app/api/cron/meal-learning/route.ts`
  - `app/api/cron/meal-learning/route.ts:198`: `const menuDays = await sanity.fetch<MenuDayRow[]>(`
  - `app/api/cron/meal-learning/route.ts:200`: `_type == "menuDay" &&`
- `app/api/cron/week-visibility/route.ts`
  - `app/api/cron/week-visibility/route.ts:50`: `_type=="menuContent" &&`
  - `app/api/cron/week-visibility/route.ts:81`: `_type=="menuContent" &&`
- `lib/cms/getMenuByMealType.ts`
  - `lib/cms/getMenuByMealType.ts:23`: `const doc = await sanity.fetch(`
  - `lib/cms/getMenuByMealType.ts:24`: `'*[_type == "menu" && mealType == $mealType][0]{`
- `lib/cms/getMenusByMealTypes.ts`
  - `lib/cms/getMenusByMealTypes.ts:21`: `const rows = await sanity.fetch(`
  - `lib/cms/getMenusByMealTypes.ts:22`: `'*[_type == "menu" && mealType in $mealTypes]{`
- `lib/cms/getProductPlan.ts`
  - `lib/cms/getProductPlan.ts:18`: `const doc = await sanity.fetch(`
- `lib/cms/getWeekTemplate.ts`
  - `lib/cms/getWeekTemplate.ts:16`: `const doc = await sanity.fetch(`
- `lib/sanity/menuContentPublishOps.ts`
  - `lib/sanity/menuContentPublishOps.ts:32`: `const draftId = await client.fetch<string | null>(`
  - `lib/sanity/menuContentPublishOps.ts:33`: `'*[_type == "menuContent" && date == $date && _id in path("drafts.**")][0]._id',`
  - `lib/sanity/menuContentPublishOps.ts:38`: `const anyDoc = await client.fetch<{ _id: string } | null>(`
  - `lib/sanity/menuContentPublishOps.ts:39`: `'*[_type == "menuContent" && date == $date][0]{ _id }',`
- `lib/sanity/queries.ts`
  - `lib/sanity/queries.ts:78`: `return sanity.fetch(`
  - `lib/sanity/queries.ts:79`: `'*[_type == "announcement" && active == true][0]{`
  - `lib/sanity/queries.ts:98`: `const row = await sanity.fetch(`
  - `lib/sanity/queries.ts:100`: `_type == "menuContent" &&`
  - `lib/sanity/queries.ts:153`: `const rows = await sanity.fetch(`
  - `lib/sanity/queries.ts:155`: `_type == "menuContent" &&`
  - `lib/sanity/queries.ts:206`: `const rows = await sanity.fetch(`
  - `lib/sanity/queries.ts:208`: `_type == "menuContent" &&`
- `lib/sanity/weekplan.ts`
  - `lib/sanity/weekplan.ts:71`: `*[_type=="weekPlan" && status=="current" && ${WEEKPLAN_LIVE_FILTER}][0]${WEEKPLAN_PROJECTION},`
  - `lib/sanity/weekplan.ts:72`: `*[_type=="weekPlan" && ${WEEKPLAN_LIVE_FILTER}] | order(weekStart desc)[0]${WEEKPLAN_PROJECTION},`
  - `lib/sanity/weekplan.ts:85`: `_type=="weekPlan" &&`
- `lib/sanity/weekPlanOps.ts`
  - `lib/sanity/weekPlanOps.ts:11`: `'*[_type=="weekPlan" && weekKey==$weekKey][0]{_id, status, locked}',`
- `studio/schemaTypes/mealIdea.ts`
  - `studio/schemaTypes/mealIdea.ts:388`: `const query = 'count(*[_type == "mealIdea" && title == $title && _id != $id])';`
  - `studio/schemaTypes/mealIdea.ts:389`: `const count = await client.fetch(query, {`
- `studio/src/tools/WeekPlanner.tsx`
  - `studio/src/tools/WeekPlanner.tsx:161`: `_type == "menuDay" &&`
  - `studio/src/tools/WeekPlanner.tsx:186`: `client.fetch<DayDoc[]>(query, { dates: ranges.week1.dates }),`
  - `studio/src/tools/WeekPlanner.tsx:187`: `client.fetch<DayDoc[]>(query, { dates: ranges.week2.dates }),`
  - `studio/src/tools/WeekPlanner.tsx:208`: `const meals = await client.fetch<Meal[]>(`
  - `studio/src/tools/WeekPlanner.tsx:210`: `_type == "mealIdea" &&`
  - `studio/src/tools/WeekPlanner.tsx:268`: `const rows = await client.fetch<Array<{ mealTitle?: string; description?: string }>>(`
  - `studio/src/tools/WeekPlanner.tsx:270`: `_type == "menuDay" &&`
  - `studio/src/tools/WeekPlanner.tsx:427`: `const docs = await client.fetch<DayDoc[]>(`
- `studio/src/tools/WeekPlanner.tsx`
  - `studio/src/tools/WeekPlanner.tsx:141`: `_type == "menuDay" &&`
  - `studio/src/tools/WeekPlanner.tsx:166`: `client.fetch<DayDoc[]>(query, { dates: ranges.week1.dates }),`
  - `studio/src/tools/WeekPlanner.tsx:167`: `client.fetch<DayDoc[]>(query, { dates: ranges.week2.dates }),`
  - `studio/src/tools/WeekPlanner.tsx:186`: `return client.fetch<Meal[]>(`
  - `studio/src/tools/WeekPlanner.tsx:188`: `_type == "mealIdea" &&`
  - `studio/src/tools/WeekPlanner.tsx:226`: `const rows = await client.fetch<Array<{ mealTitle?: string; description?: string }>>(`
  - `studio/src/tools/WeekPlanner.tsx:228`: `_type == "menuDay" &&`
  - `studio/src/tools/WeekPlanner.tsx:363`: `const docs = await client.fetch<DayDoc[]>(`

Sanity-client: read-client `createClient` bruker `projectId`, `dataset`, `apiVersion`, `useCdn:true`, `perspective:published`; write-client bruker token, `useCdn:false`, `perspective:published`. `lib/sanity/client.ts:13-19`, `lib/sanity/client.ts:54-63`

## 6. Supabase-skjema

### 6.1 Migrasjoner (kronologisk)
| # | Filnavn | Beskrivelse |
|---|---|---|
| 1 | `20260201000000_legacy_bootstrap_minimal.sql` | Bootstrap baseline required for legacy migrations + fail-closed defaults. `supabase/migrations/20260201000000_legacy_bootstrap_minimal.sql:1` |
| 2 | `20260204_audit_events.sql` | supabase/migrations/20260204_audit_events.sql `supabase/migrations/20260204_audit_events.sql:1` |
| 3 | `20260204_company_archive.sql` | supabase/migrations/20260204_company_archive.sql `supabase/migrations/20260204_company_archive.sql:1` |
| 4 | `20260204_mega_motor_phase1.sql` | supabase/migrations/20260204_mega_motor_phase1.sql `supabase/migrations/20260204_mega_motor_phase1.sql:1` |
| 5 | `20260204_mega_motor_phase2.sql` | supabase/migrations/20260204_mega_motor_phase2.sql `supabase/migrations/20260204_mega_motor_phase2.sql:1` |
| 6 | `20260204_mega_motor_phase3.sql` | supabase/migrations/20260204_mega_motor_phase3.sql `supabase/migrations/20260204_mega_motor_phase3.sql:1` |
| 7 | `20260205_enterprise_incidents.sql` | supabase/migrations/20260205_enterprise_incidents.sql `supabase/migrations/20260205_enterprise_incidents.sql:1` |
| 8 | `20260216_kitchen_driver_scope_rls.sql` | 20260216_kitchen_driver_scope_rls.sql `supabase/migrations/20260216_kitchen_driver_scope_rls.sql:1` |
| 9 | `20260217_enterprise_cron_outbox_rpc.sql` | supabase/migrations/20260217_enterprise_cron_outbox_rpc.sql `supabase/migrations/20260217_enterprise_cron_outbox_rpc.sql:1` |
| 10 | `20260217_enterprise_outbox_worker_rpc.sql` | supabase/migrations/20260217_enterprise_outbox_worker_rpc.sql `supabase/migrations/20260217_enterprise_outbox_worker_rpc.sql:1` |
| 11 | `20260218173933_new-migration.sql` | Placeholder: preserves migration ordering; no schema change. `supabase/migrations/20260218173933_new-migration.sql:1` |
| 12 | `20260218_enterprise_registration_agreement_order_guards.sql` | supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:1` |
| 13 | `20260218_invoice_lines_generator_point7.sql` | supabase/migrations/20260218_invoice_lines_generator_point7.sql `supabase/migrations/20260218_invoice_lines_generator_point7.sql:1` |
| 14 | `20260218_norwegian_standard_billing.sql` | supabase/migrations/20260218_norwegian_standard_billing.sql `supabase/migrations/20260218_norwegian_standard_billing.sql:1` |
| 15 | `20260218_orders_rollup_invoice_esg_overview.sql` | supabase/migrations/20260218_orders_rollup_invoice_esg_overview.sql `supabase/migrations/20260218_orders_rollup_invoice_esg_overview.sql:1` |
| 16 | `20260218_step1_4_schema_safe_hardening.sql` | supabase/migrations/20260218_step1_4_schema_safe_hardening.sql `supabase/migrations/20260218_step1_4_schema_safe_hardening.sql:1` |
| 17 | `20260218_task8_10_esg_monthly_indices.sql` | supabase/migrations/20260218_task8_10_esg_monthly_indices.sql `supabase/migrations/20260218_task8_10_esg_monthly_indices.sql:1` |
| 18 | `20260219_employee_invites.sql` | supabase/migrations/20260219_employee_invites.sql `supabase/migrations/20260219_employee_invites.sql:1` |
| 19 | `20260219_invoice_periods.sql` | supabase/migrations/20260219_invoice_periods.sql `supabase/migrations/20260219_invoice_periods.sql:1` |
| 20 | `20260219_outbox_worker_rpc_primitives.sql` | supabase/migrations/20260219_outbox_worker_rpc_primitives.sql `supabase/migrations/20260219_outbox_worker_rpc_primitives.sql:1` |
| 21 | `20260220_agreement_step2.sql` | supabase/migrations/20260220_agreement_step2.sql `supabase/migrations/20260220_agreement_step2.sql:1` |
| 22 | `20260220_registration_step1.sql` | supabase/migrations/20260220_registration_step1.sql `supabase/migrations/20260220_registration_step1.sql:1` |
| 23 | `20260221_step6_10_fasit_periods_esg.sql` | supabase/migrations/20260221_step6_10_fasit_periods_esg.sql `supabase/migrations/20260221_step6_10_fasit_periods_esg.sql:1` |
| 24 | `20260222_domain_hardening_core.sql` | 20260222_domain_hardening_core.sql `supabase/migrations/20260222_domain_hardening_core.sql:1` |
| 25 | `20260228000000_content_analytics_events.sql` | create table if not exists public.content_pages ( id uuid primary key default gen_random_uuid() ); `supabase/migrations/20260228000000_content_analytics_events.sql:1` |
| 26 | `20260229000000_content_workflow_state.sql` | Phase 19: Workflow state per variant (env+locale). Superadmin-only RLS. `supabase/migrations/20260229000000_content_workflow_state.sql:1` |
| 27 | `20260229000001_content_audit_log_workflow.sql` | Phase 19: Content audit log for backoffice (workflow_change, publish, etc.). Superadmin-only. `supabase/migrations/20260229000001_content_audit_log_workflow.sql:1` |
| 28 | `20260304000000_content_releases.sql` | Phase 20: Content releases. Superadmin-only. `supabase/migrations/20260304000000_content_releases.sql:1` |
| 29 | `20260304000001_content_audit_log_release_execute.sql` | Phase 20: Allow action 'release_execute' in content_audit_log. `supabase/migrations/20260304000001_content_audit_log_release_execute.sql:1` |
| 30 | `20260305000000_ai_activity_log.sql` | Phase 25 Foundation: AI activity log. Superadmin-only RLS. `supabase/migrations/20260305000000_ai_activity_log.sql:1` |
| 31 | `20260305000000_forms_and_submissions.sql` | Phase 21: Form Builder. Superadmin-only RLS. Public API uses service role. `supabase/migrations/20260305000000_forms_and_submissions.sql:1` |
| 32 | `20260306000000_ai_activity_log.sql` | NO-OP: superseded by 20260305000000_ai_activity_log.sql to prevent duplicate creation. `supabase/migrations/20260306000000_ai_activity_log.sql:1` |
| 33 | `20260307000000_ai_activity_log_reconcile.sql` | Phase 25 Foundation: AI activity log reconcile safety net. `supabase/migrations/20260307000000_ai_activity_log_reconcile.sql:1` |
| 34 | `20260308000000_ai_suggestions.sql` | Phase 26: AI suggestions store `supabase/migrations/20260308000000_ai_suggestions.sql:1` |
| 35 | `20260309000000_media_items.sql` | Phase 32 Media: public.media_items (images only), superadmin-only RLS `supabase/migrations/20260309000000_media_items.sql:1` |
| 36 | `20260310000000_ai_jobs.sql` | Phase 37: AI Job Queue (async tasks). Superadmin-only RLS. `supabase/migrations/20260310000000_ai_jobs.sql:1` |
| 37 | `20260311000000_content_health.sql` | Phase 38: Content health scoring. Superadmin-only RLS. `supabase/migrations/20260311000000_content_health.sql:1` |
| 38 | `20260312000000_content_pages_slug_title_body.sql` | Add slug, title to content_pages and body to content_page_variants for CMS to public red thread. `supabase/migrations/20260312000000_content_pages_slug_title_body.sql:1` |
| 39 | `20260312000000_experiment_results.sql` | Phase 39: Experiment analytics. Superadmin-only RLS. `supabase/migrations/20260312000000_experiment_results.sql:1` |
| 40 | `20260313000000_knowledge_graph.sql` | Phase 41: Knowledge graph. Superadmin-only RLS. `supabase/migrations/20260313000000_knowledge_graph.sql:1` |
| 41 | `20260314000000_ai_activity_log_actions.sql` | Extend ai_activity_log.action for jobs runner and agents `supabase/migrations/20260314000000_ai_activity_log_actions.sql:1` |
| 42 | `20260315000000_ai_jobs_retries.sql` | Phase 43A: AI jobs retry/backoff and safe claiming. `supabase/migrations/20260315000000_ai_jobs_retries.sql:1` |
| 43 | `20260315000001_experiment_results_unique.sql` | Phase 43C: Unique key for experiment_results upserts. `supabase/migrations/20260315000001_experiment_results_unique.sql:1` |
| 44 | `20260315000003_ai_activity_log_actions_phase43.sql` | Phase 43: Extend ai_activity_log action for experiment_event. `supabase/migrations/20260315000003_ai_activity_log_actions_phase43.sql:1` |
| 45 | `20260316000000_ai_activity_log_editor_ai_metric.sql` | Add editor_ai_metric to ai_activity_log action constraint (editor-AI metrics trinn 2) `supabase/migrations/20260316000000_ai_activity_log_editor_ai_metric.sql:1` |
| 46 | `20260316000000_content_pages_status_timestamps.sql` | Add status and timestamps to content_pages for backoffice persistence API. `supabase/migrations/20260316000000_content_pages_status_timestamps.sql:1` |
| 47 | `20260316000001_content_page_variants_locale_env.sql` | Add locale, environment and timestamps to content_page_variants for deterministic variant selection. `supabase/migrations/20260316000001_content_page_variants_locale_env.sql:1` |
| 48 | `20260317000001_create_content_pages_tables.sql` | Create CMS content tables expected by backoffice. `supabase/migrations/20260317000001_create_content_pages_tables.sql:1` |
| 49 | `20260318000000_seed_fixed_content_pages.sql` | Seed fixed Backoffice Content tree pages so every tree node has a real content_page (no 404 on by-slug). `supabase/migrations/20260318000000_seed_fixed_content_pages.sql:1` |
| 50 | `20260319000000_seed_fixed_backoffice_pages.sql` | Seed fixed Backoffice Content pages (idempotent). All 9 system slugs must exist so tree click never 404s. `supabase/migrations/20260319000000_seed_fixed_backoffice_pages.sql:1` |
| 51 | `20260320000000_content_tree_persistence.sql` | Content tree persistence: parent/root placement + sort order. `supabase/migrations/20260320000000_content_tree_persistence.sql:1` |
| 52 | `20260320120000_demo_interest_leads.sql` | Valgfri e-post fra offentlig AI-demo (server-side insert via service role). `supabase/migrations/20260320120000_demo_interest_leads.sql:1` |
| 53 | `20260320140000_ai_demo_cta_ab_state.sql` | A/B-vekter for offentlig AI-demo CTA (server-styrt, auto-rebalansert). `supabase/migrations/20260320140000_ai_demo_cta_ab_state.sql:1` |
| 54 | `20260320150000_ai_demo_ab_context_state.sql` | Lærte A/B-vekter per kontekst (enhet + trafikkilde) for offentlig AI-demo-funnel. `supabase/migrations/20260320150000_ai_demo_ab_context_state.sql:1` |
| 55 | `20260320170000_ai_demo_cta_variant_catalog.sql` | Dynamisk CTA-katalog (frø + genererte varianter) for AI-demo A/B. `supabase/migrations/20260320170000_ai_demo_cta_variant_catalog.sql:1` |
| 56 | `20260320180000_demo_cta_growth_learning.sql` | Self-learning demo CTA: feature aggregates, exploration rate, performance history, strategy mode. `supabase/migrations/20260320180000_demo_cta_growth_learning.sql:1` |
| 57 | `20260320193000_agreements_approval_reject_pause.sql` | Ledger agreements (public.agreements): reject + pause + activated_at `supabase/migrations/20260320193000_agreements_approval_reject_pause.sql:1` |
| 58 | `20260320200000_employee_invites_accepted_at.sql` | Optional explicit acceptance timestamp (mirrors used_at when invite is consumed). `supabase/migrations/20260320200000_employee_invites_accepted_at.sql:1` |
| 59 | `20260321000000_content_experiments.sql` | CRO / Experiment foundation: editorial experiments with status and audit. `supabase/migrations/20260321000000_content_experiments.sql:1` |
| 60 | `20260321100000_demo_cta_combo_feature_learning.sql` | Combo dimensions for feature_learning (tone+verb, framing+tone). Preserves existing nested objects. `supabase/migrations/20260321100000_demo_cta_combo_feature_learning.sql:1` |
| 61 | `20260321110000_demo_cta_triple_feature_learning.sql` | Full triple patterns: tone + verb + framing in feature_learning. `supabase/migrations/20260321110000_demo_cta_triple_feature_learning.sql:1` |
| 62 | `20260321120000_demo_cta_pattern_learning_by_context.sql` | Context-aware pattern learning (full FeatureLearningState per d:device/i:intent). `supabase/migrations/20260321120000_demo_cta_pattern_learning_by_context.sql:1` |
| 63 | `20260321181000_lp_pgrst_reload_schema_rpc.sql` | Programmatic PostgREST schema reload (service_role only). Enables API to pick up new RPC signatures after deploy. `supabase/migrations/20260321181000_lp_pgrst_reload_schema_rpc.sql:1` |
| 64 | `20260322000000_tenant_rls_hardening.sql` | 20260322000000_tenant_rls_hardening.sql `supabase/migrations/20260322000000_tenant_rls_hardening.sql:1` |
| 65 | `20260323000000_domain_constraint_hardening.sql` | Domain constraint hardening: enforce documented domain values only. `supabase/migrations/20260323000000_domain_constraint_hardening.sql:1` |
| 66 | `20260323120000_ai_activity_log_company_control_tower.sql` | Company Control Tower audit actions (deterministic AI layer; no silent execution without log). `supabase/migrations/20260323120000_ai_activity_log_company_control_tower.sql:1` |
| 67 | `20260323120000_ai_ceo_log.sql` | Controlled AI CEO layer: append-only audit trail (service role / admin client writes). `supabase/migrations/20260323120000_ai_ceo_log.sql:1` |
| 68 | `20260323140000_ai_autonomy_log.sql` | Self-driving SaaS layer: append-only audit (service role / admin client writes). `supabase/migrations/20260323140000_ai_autonomy_log.sql:1` |
| 69 | `20260323140000_ai_intelligence_events.sql` | Unified intelligence event log: single append-only stream for GTM, revenue, design, conversions, experiments. `supabase/migrations/20260323140000_ai_intelligence_events.sql:1` |
| 70 | `20260323160000_ai_enterprise_revenue_log.sql` | Enterprise revenue / pricing / segmentation audit (append-only; service role writes). `supabase/migrations/20260323160000_ai_enterprise_revenue_log.sql:1` |
| 71 | `20260324000000_index_fk_profiles_company.sql` | Index for FK and tenant filtering: profiles.company_id. `supabase/migrations/20260324000000_index_fk_profiles_company.sql:1` |
| 72 | `20260324140000_orders_attribution_jsonb.sql` | Additive: optional marketing attribution on orders (AI Social / explainable revenue path). `supabase/migrations/20260324140000_orders_attribution_jsonb.sql:1` |
| 73 | `20260324150000_social_posts_events.sql` | Social engine persistence: calendar posts + click/lead events (service-role / admin API). `supabase/migrations/20260324150000_social_posts_events.sql:1` |
| 74 | `20260324160000_social_posts_variant_group.sql` | A/B-gruppering for social_posts (valgfri kolonne; eksisterende rader forblir NULL → behandles som «ungrouped» i app). `supabase/migrations/20260324160000_social_posts_variant_group.sql:1` |
| 75 | `20260324170000_lead_pipeline.sql` | Superadmin / growth: lead-pipeline (manuell oppfølging — ingen auto-close). `supabase/migrations/20260324170000_lead_pipeline.sql:1` |
| 76 | `20260325000000_tenant_rls_profiles_id_fix.sql` | Tenant RLS fix: canonical schema has profiles.id = auth.users(id); user_id column was dropped in bootstrap. `supabase/migrations/20260325000000_tenant_rls_profiles_id_fix.sql:1` |
| 77 | `20260326000000_trigger_outbox_canceled_spelling.sql` | Trigger safety: order_status enum has both CANCELED and CANCELLED. `supabase/migrations/20260326000000_trigger_outbox_canceled_spelling.sql:1` |
| 78 | `20260327000000_content_pages_tree_columns_forward_fix.sql` | Corrective forward fix: ensure content_pages has tree columns required by /api/backoffice/content/tree. `supabase/migrations/20260327000000_content_pages_tree_columns_forward_fix.sql:1` |
| 79 | `20260328000000_media_items_forward_fix.sql` | Corrective forward fix: ensure public.media_items exists for /api/backoffice/media/items. `supabase/migrations/20260328000000_media_items_forward_fix.sql:1` |
| 80 | `20260328100000_lp_order_set_profile_slot_action_fix.sql` | Align public.lp_order_set (4-arg) with canonical schema: `supabase/migrations/20260328100000_lp_order_set_profile_slot_action_fix.sql:1` |
| 81 | `20260329000000_forms_forward_fix.sql` | Corrective forward fix: ensure public.forms (and form_submissions) exist for /api/backoffice/forms. `supabase/migrations/20260329000000_forms_forward_fix.sql:1` |
| 82 | `20260330000000_fk_support_indexes.sql` | FK support indexes for backoffice schema `supabase/migrations/20260330000000_fk_support_indexes.sql:1` |
| 83 | `20260330120000_u30r_content_pages_page_key_if_missing.sql` | U30R — Sikre at page_key finnes der eldre databaser ikke har kjørt 20260417010000. `supabase/migrations/20260330120000_u30r_content_pages_page_key_if_missing.sql:1` |
| 84 | `20260331000000_ai_experiment_memory.sql` | Experiment learning memory: store historical experiment results for AI/analytics. `supabase/migrations/20260331000000_ai_experiment_memory.sql:1` |
| 85 | `20260401000000_ai_memory.sql` | Langtidsminne for AI: eksperimentresultater, SEO-læring, konverteringsmønstre. `supabase/migrations/20260401000000_ai_memory.sql:1` |
| 86 | `20260402000000_ai_memory_outcome_kind.sql` | AI Memory System: legg til kind 'outcome' for "hva som fungerer / ikke fungerer". `supabase/migrations/20260402000000_ai_memory_outcome_kind.sql:1` |
| 87 | `20260403000000_ai_experiments.sql` | AI Experiment Engine: experiment definitions (A/B tests, winner, status). `supabase/migrations/20260403000000_ai_experiments.sql:1` |
| 88 | `20260403000001_ai_experiment_results.sql` | AI Experiment Engine: resultater per variant (views, clicks, conversions). `supabase/migrations/20260403000001_ai_experiment_results.sql:1` |
| 89 | `20260404000000_ai_activity_log_actions_cms.sql` | CMS AI audit: extend ai_activity_log.action so all current routes and flows use allowed values. `supabase/migrations/20260404000000_ai_activity_log_actions_cms.sql:1` |
| 90 | `20260404160000_ai_suggestions_ensure_trace_columns.sql` | Align older ai_suggestions tables with repo contract (PostgREST / app inserts). `supabase/migrations/20260404160000_ai_suggestions_ensure_trace_columns.sql:1` |
| 91 | `20260413170000_closed_dates_operative.sql` | Operativ policy: stengte datoer (eget lag — ikke agreement_json, ikke Sanity). `supabase/migrations/20260413170000_closed_dates_operative.sql:1` |
| 92 | `20260413170500_closed_dates_no_authenticated_select.sql` | Minste tilgang: ingen bred SELECT for authenticated på operative sperredatoer. `supabase/migrations/20260413170500_closed_dates_no_authenticated_select.sql:1` |
| 93 | `20260414203000_company_registrations_meal_plan.sql` | Canonical operative registration: BASIS/Luxus per ukedag + leveringsvindu + binding/oppsigelse. `supabase/migrations/20260414203000_company_registrations_meal_plan.sql:1` |
| 94 | `20260414220000_agreement_day_slot_rules_daymap.sql` | Operativ daymap: materialiserer companies.agreement_json.plan.days inn i rader som `supabase/migrations/20260414220000_agreement_day_slot_rules_daymap.sql:1` |
| 95 | `20260415130000_production_operative_snapshots.sql` | Canonical frozen operative order-id set per company per delivery date (materialisert fra samme filter som kjøkken/driver). `supabase/migrations/20260415130000_production_operative_snapshots.sql:1` |
| 96 | `20260417000000_ai_activity_log_action_design_suggestion_applied.sql` | Fix: allow design_suggestion_applied when applying AI design suggestions. `supabase/migrations/20260417000000_ai_activity_log_action_design_suggestion_applied.sql:1` |
| 97 | `20260417010000_content_pages_page_key.sql` | Stable page identity for backoffice tree and bindings. `supabase/migrations/20260417010000_content_pages_page_key.sql:1` |
| 98 | `20260417011000_content_pages_page_key_unique.sql` | Ensure system-level page_key values are globally unique. `supabase/migrations/20260417011000_content_pages_page_key_unique.sql:1` |
| 99 | `20260418000000_ai_activity_log_entity_columns.sql` | Support live schema (entity_type, entity_id, actor_user_id) for ai_activity_log so editor-AI metrics and other flows can insert. `supabase/migrations/20260418000000_ai_activity_log_entity_columns.sql:1` |
| 100 | `20260420000000_ai_activity_log_rid_metrics.sql` | Lightweight route metrics: rid, block/node refs, status, duration (ms). Extends action allowlist for /api/ai/* helpers. `supabase/migrations/20260420000000_ai_activity_log_rid_metrics.sql:1` |
| 101 | `20260421000000_global_content.sql` | global_content: persisted CMS globals (header / footer / settings), draft vs published. `supabase/migrations/20260421000000_global_content.sql:1` |
| 102 | `20260422000000_experiments.sql` | Production A/B traffic: experiments, weighted variants, event stream (views / clicks / conversions). `supabase/migrations/20260422000000_experiments.sql:1` |
| 103 | `20260423000000_ai_learning_patterns.sql` | Aggregated experiment → AI feedback (adaptive scoring). Accessed via Next.js service role only. `supabase/migrations/20260423000000_ai_learning_patterns.sql:1` |
| 104 | `20260424000000_ai_autonomy_audit.sql` | Optional audit trail for autonomy layer (decision + automation preview/execute). `supabase/migrations/20260424000000_ai_autonomy_audit.sql:1` |
| 105 | `20260425000000_saas_subscriptions.sql` | SaaS: billing mirror + plan on company (extends existing multi-tenant core; does not recreate companies/profiles). `supabase/migrations/20260425000000_saas_subscriptions.sql:1` |
| 106 | `20260426000000_ai_activity_log_entity_usage_idx.sql` | Speed per-company AI usage aggregation (runAi / action = batch, entity_id = company) `supabase/migrations/20260426000000_ai_activity_log_entity_usage_idx.sql:1` |
| 107 | `20260426000000_security_audit_logs.sql` | Enterprise security audit trail: append-only, tenant-scoped read, writes via service role only. `supabase/migrations/20260426000000_security_audit_logs.sql:1` |
| 108 | `20260426100000_companies_ai_billing_flags.sql` | AI billing: surface cost vs included plan allowance (revenue-linked ops / invoicing hooks) `supabase/migrations/20260426100000_companies_ai_billing_flags.sql:1` |
| 109 | `20260427120000_ai_runner_governance.sql` | Per-company + platform governance for unified AI runner (blocks, model tier, notes). `supabase/migrations/20260427120000_ai_runner_governance.sql:1` |
| 110 | `20260427140000_ai_governance_apply_log.sql` | Idempotent governance applies, dry-run audit trail, rollback pointer. `supabase/migrations/20260427140000_ai_governance_apply_log.sql:1` |
| 111 | `20260427150000_ai_action_memory.sql` | Short-lived automation / control-plane action marks (dedupe + audit). Snake_case columns only. `supabase/migrations/20260427150000_ai_action_memory.sql:1` |
| 112 | `20260428100000_experiment_growth_columns.sql` | Additive CRO / A/B growth: optional page link, variant labels, impression events, resolution audit blob. `supabase/migrations/20260428100000_experiment_growth_columns.sql:1` |
| 113 | `20260429100000_experiment_revenue_sessions.sql` | Enterprise growth: revenue attribution per experiment variant + session stitching for public telemetry. `supabase/migrations/20260429100000_experiment_revenue_sessions.sql:1` |
| 114 | `20260429120000_ai_learning_blackbox.sql` | Append-only learning log for blackbox / controlled autonomy cycles (service role writes). `supabase/migrations/20260429120000_ai_learning_blackbox.sql:1` |
| 115 | `20260429130000_ai_memory_singularity_cycle_kind.sql` | Singularity / growth orchestrator: one ai_memory row per cron cycle (context + plan + outcomes). `supabase/migrations/20260429130000_ai_memory_singularity_cycle_kind.sql:1` |
| 116 | `20260429140000_ai_memory_god_mode_cycle_kind.sql` | God Mode / business engine: one ai_memory row per cron cycle (state, leaks, pricing suggestions, strategy, executed). `supabase/migrations/20260429140000_ai_memory_god_mode_cycle_kind.sql:1` |
| 117 | `20260429150000_ai_memory_omniscient_cycle_kind.sql` | Omniscient / market simulation cycle: full state + simulations + ranked moves + expansion (audit only). `supabase/migrations/20260429150000_ai_memory_omniscient_cycle_kind.sql:1` |
| 118 | `20260429160000_ai_memory_revenue_mode_cycle_kind.sql` | Autonomous revenue mode: simulations, offers, gaps, insights, execution trace (audit). `supabase/migrations/20260429160000_ai_memory_revenue_mode_cycle_kind.sql:1` |
| 119 | `20260429170000_ai_memory_autonomous_cycle_kind.sql` | Fully autonomous SaaS loop: state, intelligence, opportunities, prioritized plan, execution trace. `supabase/migrations/20260429170000_ai_memory_autonomous_cycle_kind.sql:1` |
| 120 | `20260429180000_ai_memory_outcome_columns.sql` | Self-learning layer: optional outcome columns on ai_memory (additive; existing rows stay null). `supabase/migrations/20260429180000_ai_memory_outcome_columns.sql:1` |
| 121 | `20260429190000_ai_memory_strategy_cycle_kind.sql` | Strategic AI layer: long-horizon context, pillars, roadmap, execution trace (audit). `supabase/migrations/20260429190000_ai_memory_strategy_cycle_kind.sql:1` |
| 122 | `20260429200000_ai_memory_org_cycle_kind.sql` | Autonomous organization layer: shared context, agent outputs, merged actions, execution trace. `supabase/migrations/20260429200000_ai_memory_org_cycle_kind.sql:1` |
| 123 | `20260429210000_ai_memory_market_cycle_kind.sql` | Market domination layer: context, competitor insights, gaps, positioning, pricing sims (audit), expansion, execution trace. `supabase/migrations/20260429210000_ai_memory_market_cycle_kind.sql:1` |
| 124 | `20260429220000_ai_memory_monopoly_cycle_kind.sql` | Monopoly layer: category mode, demand/lock-in/network/threat signals, strategy pillars, safe execution trace. `supabase/migrations/20260429220000_ai_memory_monopoly_cycle_kind.sql:1` |
| 125 | `20260429230000_ai_memory_reality_cycle_kind.sql` | Reality (perception alignment) layer: perception state, strategy tokens, mapped actions, safe execution trace. `supabase/migrations/20260429230000_ai_memory_reality_cycle_kind.sql:1` |
| 126 | `20260429240000_ai_memory_control_decision_kind.sql` | AGI control layer: per-lane gate audit (received / allowed / blocked + reasons). `supabase/migrations/20260429240000_ai_memory_control_decision_kind.sql:1` |
| 127 | `20260429250000_ai_memory_budget_execution_kind.sql` | Budget execution: capital allocation → prioritized symbolic actions → safe internal execution trace. `supabase/migrations/20260429250000_ai_memory_budget_execution_kind.sql:1` |
| 128 | `20260429260000_ai_memory_resource_allocation_kind.sql` | Resource allocation: matched resources, capacity usage, staggered schedule (advisory + pre-execution audit). `supabase/migrations/20260429260000_ai_memory_resource_allocation_kind.sql:1` |
| 129 | `20260429270000_ai_memory_learning_cycle_kind.sql` | Learning feedback loop: append-only rows for outcome → action mapping (priority adjustment only; no auto prod writes). `supabase/migrations/20260429270000_ai_memory_learning_cycle_kind.sql:1` |
| 130 | `20260429280000_ai_memory_attribution_cycle_kind.sql` | Performance attribution: append-only action → event → outcome rows for ROI / learning (no prod overrides). `supabase/migrations/20260429280000_ai_memory_attribution_cycle_kind.sql:1` |
| 131 | `20260429300000_ai_memory_scaling_cycle_kind.sql` | Autonomous scaling: ROI-driven internal growth loop plan + execution audit (no direct spend / pricing). `supabase/migrations/20260429300000_ai_memory_scaling_cycle_kind.sql:1` |
| 132 | `20260429310000_ai_memory_profit_cycle_kind.sql` | Profit maximization cycle: margin / leak / strategy audit + safe internal execution (no payments / pricing). `supabase/migrations/20260429310000_ai_memory_profit_cycle_kind.sql:1` |
| 133 | `20260429320000_ai_observability.sql` | Append-only observability stream: metrics, events, decisions, traces (service-role writes; superadmin read via app gate). `supabase/migrations/20260429320000_ai_observability.sql:1` |
| 134 | `20260429330000_ai_alerts.sql` | Anomaly / alerting audit trail (service-role inserts from cron; superadmin policy for JWT clients). `supabase/migrations/20260429330000_ai_alerts.sql:1` |
| 135 | `20260429340000_ai_metrics_history.sql` | Time-series samples per metric name for predictive (z-score) anomaly detection (append-only). `supabase/migrations/20260429340000_ai_metrics_history.sql:1` |
| 136 | `20260429350000_ai_models.sql` | Persisted ML model artifacts (JSON); service-role writes from training cron. `supabase/migrations/20260429350000_ai_models.sql:1` |
| 137 | `20260429360000_ai_models_model_type.sql` | Distinguish linear regression vs sequence model rows (additive; existing rows default to linear). `supabase/migrations/20260429360000_ai_models_model_type.sql:1` |
| 138 | `20260430100000_page_versions.sql` | CMS page content versioning (additive). Snapshots per page + locale + environment. `supabase/migrations/20260430100000_page_versions.sql:1` |
| 139 | `20260430110000_page_versions_label_action.sql` | Add human-readable version labels + action codes (additive). `supabase/migrations/20260430110000_page_versions_label_action.sql:1` |
| 140 | `20260430120000_system_settings_killswitch.sql` | system_settings.killswitch — additive column alignment (no data loss) `supabase/migrations/20260430120000_system_settings_killswitch.sql:1` |
| 141 | `20260430130000_social_attribution_pipeline.sql` | Additive: SoMe → lead → ordre-kobling + utvidet ai_activity_log for sporbarhet. `supabase/migrations/20260430130000_social_attribution_pipeline.sql:1` |
| 142 | `20260430140000_growth_ab_experiments.sql` | Additive: SoMe A/B (innhold) + vekst-mønstre i ai_activity_log. `supabase/migrations/20260430140000_growth_ab_experiments.sql:1` |
| 143 | `20260430150000_ai_activity_log_budget_allocation.sql` | Additive: logg for budsjett-/kanal-fordeling (anbefaling, ingen auto-spend). `supabase/migrations/20260430150000_ai_activity_log_budget_allocation.sql:1` |
| 144 | `20260430160000_ai_activity_log_valuation_run.sql` | Additive: investor/verdivurdering — audit trail (ingen pengeflyt). `supabase/migrations/20260430160000_ai_activity_log_valuation_run.sql:1` |
| 145 | `20260430170000_ai_activity_log_order_attributed.sql` | Order → lead_pipeline → social_posts attribution (service-role logging). `supabase/migrations/20260430170000_ai_activity_log_order_attributed.sql:1` |
| 146 | `20260430180000_ai_activity_log_lead_closed.sql` | Lead closed as won (order conversion) — service-role logging. `supabase/migrations/20260430180000_ai_activity_log_lead_closed.sql:1` |
| 147 | `20260430190000_ai_activity_log_pipeline_priorities.sql` | Pipeline prioritization + action execution audit. `supabase/migrations/20260430190000_ai_activity_log_pipeline_priorities.sql:1` |
| 148 | `20260430191000_ai_activity_log_sales_loop.sql` | Sales loop audit: plan + utkast (ingen auto-send). `supabase/migrations/20260430191000_ai_activity_log_sales_loop.sql:1` |
| 149 | `20260430193000_ai_activity_log_closing_suggested.sql` | Closing / møteutkast audit (ingen auto-send). `supabase/migrations/20260430193000_ai_activity_log_closing_suggested.sql:1` |
| 150 | `20260430194500_ai_activity_log_objection.sql` | Innvendingsflyt: generert svar + manuell bekreftelse (ingen auto-send). `supabase/migrations/20260430194500_ai_activity_log_objection.sql:1` |
| 151 | `20260430195500_ai_activity_log_sequence.sql` | Multi-touch sekvens (utkast + audit). `supabase/migrations/20260430195500_ai_activity_log_sequence.sql:1` |
| 152 | `20260430195600_ai_activity_log_revenue_autopilot_run.sql` | Revenue autopilot audit (read-only compute + suggested actions; logged on cron). `supabase/migrations/20260430195600_ai_activity_log_revenue_autopilot_run.sql:1` |
| 153 | `20260430195700_ai_activity_log_multi_channel_analysis.sql` | Multi-channel growth analysis (read-only metrics + suggested allocation; no auto-spend). `supabase/migrations/20260430195700_ai_activity_log_multi_channel_analysis.sql:1` |
| 154 | `20260430195800_ai_activity_log_market_expansion.sql` | Global market expansion analysis (pilot drafts only; no auto-publish). `supabase/migrations/20260430195800_ai_activity_log_market_expansion.sql:1` |
| 155 | `20260430196000_rls_service_role_core_tables.sql` | Defense-in-depth: eksplisitt service_role-tilgang på kjerne tabeller (PostgREST bypasser ofte RLS for service_role; `supabase/migrations/20260430196000_rls_service_role_core_tables.sql:1` |
| 156 | `20260430210000_sre_performance_indexes.sql` | Additive SRE indexes: faster filters on hot paths (IF NOT EXISTS = safe re-run). `supabase/migrations/20260430210000_sre_performance_indexes.sql:1` |
| 157 | `20260430220000_orders_mvo_variants.sql` | Additive: MVO-dimensjoner på ordre (kanal/segment/timing) + ai_activity_log for mvo_learning. `supabase/migrations/20260430220000_orders_mvo_variants.sql:1` |
| 158 | `20260430240000_market_id_columns_global_learning.sql` | Additive: markedsisolering (market_id) + ai_activity_log.global_learning. `supabase/migrations/20260430240000_market_id_columns_global_learning.sql:1` |
| 159 | `20260507170115_add_rls_missing_tables.sql` | Enable RLS for public tables that were exposed without row-level security. `supabase/migrations/20260507170115_add_rls_missing_tables.sql:1` |
| 160 | `20260507172000_normalize_status_enums_uppercase.sql` | Normalize public.order_status and public.company_status to uppercase-only labels. `supabase/migrations/20260507172000_normalize_status_enums_uppercase.sql:1` |
| 161 | `20260507173500_add_system_settings_autopilot_enabled.sql` | Persist Control Tower autopilot state across server restarts. `supabase/migrations/20260507173500_add_system_settings_autopilot_enabled.sql:1` |
| 162 | `20260507235400_create_kitchen_batches.sql` | Canonical kitchen batch status per delivery date, delivery window and location. `supabase/migrations/20260507235400_create_kitchen_batches.sql:1` |
| 163 | `20260507235500_create_day_choices.sql` | Employee meal choice per company/location/user/date. `supabase/migrations/20260507235500_create_day_choices.sql:1` |
| 164 | `20260508005500_create_company_current_agreement_view.sql` | create or replace view public.company_current_agreement as `supabase/migrations/20260508005500_create_company_current_agreement_view.sql:1` |
| 165 | `20260508005600_add_agreements_start_date.sql` | alter table public.agreements `supabase/migrations/20260508005600_add_agreements_start_date.sql:1` |
| 166 | `20260508014000_create_invite_tables.sql` | begin; `supabase/migrations/20260508014000_create_invite_tables.sql:1` |
| 167 | `20260508015500_add_companies_default_location_id.sql` | begin; `supabase/migrations/20260508015500_add_companies_default_location_id.sql:1` |
| 168 | `20260508103300_add_rejected_agreement_status.sql` | alter type public.agreement_status add value if not exists 'REJECTED'; `supabase/migrations/20260508103300_add_rejected_agreement_status.sql:1` |
| 169 | `20260508103400_create_company_registrations.sql` | begin; `supabase/migrations/20260508103400_create_company_registrations.sql:1` |
| 170 | `20260508103500_extend_agreements_review_fields.sql` | alter table public.agreements `supabase/migrations/20260508103500_extend_agreements_review_fields.sql:1` |
| 171 | `20260508103600_extend_company_invites_for_company_admin.sql` | alter table public.company_invites `supabase/migrations/20260508103600_extend_company_invites_for_company_admin.sql:1` |
| 172 | `20260508120900_replace_lp_company_register_pending_agreement.sql` | create or replace function public.lp_company_register( `supabase/migrations/20260508120900_replace_lp_company_register_pending_agreement.sql:1` |
| 173 | `20260508160200_rework_lp_company_register_pending_only.sql` | begin; `supabase/migrations/20260508160200_rework_lp_company_register_pending_only.sql:1` |
| 174 | `20260508185735_company_registration_approve_reject.sql` | Ikke funnet `supabase/migrations/20260508185735_company_registration_approve_reject.sql:1` |
| 175 | `20260508190000_company_registration_approve_reject.sql` | begin; `supabase/migrations/20260508190000_company_registration_approve_reject.sql:1` |
| 176 | `20260508221500_company_registration_approval_flow.sql` | begin; `supabase/migrations/20260508221500_company_registration_approval_flow.sql:1` |
| 177 | `20260509184900_create_menu_visibility_days.sql` | Create the DB mirror used by week menu visibility controls. `supabase/migrations/20260509184900_create_menu_visibility_days.sql:1` |
| 178 | `20260509185000_seed_allergens_dietary_tags.sql` | Seed canonical allergen and dietary tag reference data. `supabase/migrations/20260509185000_seed_allergens_dietary_tags.sql:1` |
| 179 | `20260510143500_add_missing_fk_indexes.sql` | Add missing indexes for public foreign-key columns. `supabase/migrations/20260510143500_add_missing_fk_indexes.sql:1` |

### 6.2 agreements
- Kolonner fra bootstrap: `id uuid primary key`, `company_id uuid not null references companies`, `location_id uuid not null references company_locations`, `tier public.agreement_tier not null default BASIS`, `status public.agreement_status not null default PENDING`, `delivery_days jsonb`, `slot_start`, `slot_end`, `starts_at`, `ends_at`, `created_at`, `updated_at`. `supabase/migrations/20260201000000_legacy_bootstrap_minimal.sql:136-148`
- `agreement_tier` enum opprettes med `BASIS` og `LUXUS`. `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:34-39`
- `agreement_status` enum opprettes med `PENDING`, `ACTIVE`, `TERMINATED`; senere legges `REJECTED` og `PAUSED` til. `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:17-29`, `supabase/migrations/20260320193000_agreements_approval_reject_pause.sql:4-10`
- Constraints/indekser: unik aktiv avtale per company via `agreements_one_active_per_company_uk`. `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:506-508`
- RLS-policy: tenant-bounded select `agreements_tenant_select`. `supabase/migrations/20260325000000_tenant_rls_profiles_id_fix.sql:67-85`
- Review/approval-felter legges til i `20260508103500`. `supabase/migrations/20260508103500_extend_agreements_review_fields.sql:1-11`
- `start_date` legges til og fylles fra `starts_at`. `supabase/migrations/20260508005600_add_agreements_start_date.sql:1-7`
- **tier-feltet:** datatype `public.agreement_tier`, ikke fri tekst; tillatte enumverdier funnet i migrasjon er `BASIS` og `LUXUS`. Innsetting caster `v_tier::public.agreement_tier` etter validering mot `('BASIS','LUXUS')`. `supabase/migrations/20260201000000_legacy_bootstrap_minimal.sql:140`, `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:589-590`, `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:651-668`

### 6.3 Relaterte tabeller
- `orders` opprettes med user/date/status/company/location/slot og unike indekser. `supabase/migrations/20260201000000_legacy_bootstrap_minimal.sql:151-184`
- `day_choices` lagrer ansattes valg per company/location/user/date og har `choice_key`, `note`, `status`, unik `(company_id, location_id, user_id, date)`, RLS enabled, service_role grants og updated_at-trigger. `supabase/migrations/20260507235500_create_day_choices.sql:1-51`
- `agreement_day_slot_rules` FK-er til `companies` og `agreements`, har `day_key`, `slot`, `tier`, unik `(agreement_id, day_key, slot)`, RLS og policies. `supabase/migrations/20260414220000_agreement_day_slot_rules_daymap.sql:7-50`
- `company_current_agreement` view viser aktiv avtale per company med `plan_tier`, `price_per_cuvert_nok`, `delivery_days`, `start_date`, `end_date`. `supabase/migrations/20260508005500_create_company_current_agreement_view.sql:1-20`

### 6.4 Database-funksjoner
- `lp_agreement_create_pending` validerer company/location/tier/delivery_days/price og inserter pending agreement. `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:523-677`
- `lp_materialize_agreement_day_slots` materialiserer `companies.agreement_json.plan.days` til `agreement_day_slot_rules`. `supabase/migrations/20260414220000_agreement_day_slot_rules_daymap.sql:52-139`
- `v_company_current_agreement_daymap` view leser daymap for gjeldende pending/active agreement. `supabase/migrations/20260414220000_agreement_day_slot_rules_daymap.sql:155-190`

## 7. Next.js — meny-routes
| Route | Type | Sanity-data | Supabase-data |
|---|---|---|---|
| `/week` | server component | `getMenuForDates` for superadmin preview og employee client/API | Supabase Auth, `profiles`, `companies`, `requireActiveAgreement` |
| `/menus/week` | server component | `getMenuForDatesAdmin(days)` | Supabase Auth + `profiles.role` superadmin gate |
| `/api/week` | route handler GET | `getMenuForDates(dates)` via `menuContent` | Auth user -> profiles.company_id -> agreements ACTIVE -> day tiers |
| `/api/order*` | route handlers | indirekte via order/window/set-choice helpers | Supabase Auth/profiles/companies/day_choices/orders |

Detaljer: `/week` importerer `getMenuForDates`, `formatDateNO`, `weekRangeISO`, `supabaseServer` og `requireActiveAgreement`. `app/(app)/week/page.tsx:16-24`; superadmin preview henter publiserte menyer for to uker. `app/(app)/week/page.tsx:469-489`; employee-flow validerer SSR auth-cookie, `supabase.auth.getUser`, rolle, `requireActiveAgreement`, `profiles.company_id`, og `companies` status. `app/(app)/week/page.tsx:577-714`

`/menus/week` krever innlogget Supabase-bruker, leser `profiles.role`, redirecter ikke-superadmin til `/week`, og henter alle Sanity-menydager via `getMenuForDatesAdmin`. `app/menus/week/page.tsx:68-83`

`/api/week` leser Supabase Auth user, `profiles.company_id/location_id/role`, aktiv `agreements`-rad, normaliserer tier/delivery_days, henter day tiers, leser Sanity `menuContent` for ukedatoer, og bygger employee week rows. `app/api/week/route.ts:95-149`, `app/api/week/route.ts:160-192`

## 8. Auth-flyt
- Auth-provider er Supabase Auth via `supabaseServer().auth.getUser()` i serverkomponenter og route handlers. `lib/supabase/server.ts:30-31`, `app/api/week/route.ts:95-104`
- API-route guard bruker `getScope(req)` og fallback til Supabase cookie-session for user/email. `lib/http/routeGuard.ts:215-239`, `lib/http/routeGuard.ts:142-156`
- `companyId`/`locationId` kommer fra `profiles.company_id`/`profiles.location_id`, ikke klientpayload, i `/api/week`. `app/api/week/route.ts:100-112`
- `agreementId`/tier hentes server-side fra `agreements` aktiv rad i `/api/week`. `app/api/week/route.ts:114-136`
- Rolle for `/week` kommer fra system-email override eller `user.user_metadata.role` før employee-flow; profiler leses deretter for company. `app/(app)/week/page.tsx:597-608`

## 9. API-endepunkter
| Metode | Path | Formål | Leser | Skriver | Auth |
|---|---|---|---|---|---|
| GET | `/admin/kjokken/orders` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/admin/kjokken/orders/route.ts:1` | Se imports/handler `app/admin/kjokken/orders/route.ts:1` | Ikke kartlagt per felt | Se handler/guard `app/admin/kjokken/orders/route.ts:1` |
| GET | `/api/admin/agreement` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/admin/agreement/route.ts:189` | Se imports/handler `app/api/admin/agreement/route.ts:189` | Ikke kartlagt per felt | Se handler/guard `app/api/admin/agreement/route.ts:189` |
| GET | `/api/admin/agreements/current` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/admin/agreements/current/route.ts:15` | Se imports/handler `app/api/admin/agreements/current/route.ts:15` | Ikke kartlagt per felt | Se handler/guard `app/api/admin/agreements/current/route.ts:15` |
| GET | `/api/admin/agreements` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/admin/agreements/route.ts:10` | Se imports/handler `app/api/admin/agreements/route.ts:10` | Ikke kartlagt per felt | Se handler/guard `app/api/admin/agreements/route.ts:10` |
| GET | `/api/admin/metrics/weekly` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/admin/metrics/weekly/route.ts:43` | Se imports/handler `app/api/admin/metrics/weekly/route.ts:43` | Ikke kartlagt per felt | Se handler/guard `app/api/admin/metrics/weekly/route.ts:43` |
| GET | `/api/admin/orders` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/admin/orders/route.ts:57` | Se imports/handler `app/api/admin/orders/route.ts:57` | Ikke kartlagt per felt | Se handler/guard `app/api/admin/orders/route.ts:57` |
| GET | `/api/agreements/my-latest` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/agreements/my-latest/route.ts:37` | Se imports/handler `app/api/agreements/my-latest/route.ts:37` | Ikke kartlagt per felt | Se handler/guard `app/api/agreements/my-latest/route.ts:37` |
| GET | `/api/agreements` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/agreements/route.ts:17` | Se imports/handler `app/api/agreements/route.ts:17` | Ikke kartlagt per felt | Se handler/guard `app/api/agreements/route.ts:17` |
| POST | `/api/backoffice/ai/cms-menu` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/backoffice/ai/cms-menu/route.ts:51` | Se imports/handler `app/api/backoffice/ai/cms-menu/route.ts:51` | Ikke kartlagt per felt | Se handler/guard `app/api/backoffice/ai/cms-menu/route.ts:51` |
| POST | `/api/backoffice/cms/menu-draft` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/backoffice/cms/menu-draft/route.ts:56` | Se imports/handler `app/api/backoffice/cms/menu-draft/route.ts:56` | Ikke kartlagt per felt | Se handler/guard `app/api/backoffice/cms/menu-draft/route.ts:56` |
| POST | `/api/backoffice/sanity/menu-content/publish` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/backoffice/sanity/menu-content/publish/route.ts:16` | Se imports/handler `app/api/backoffice/sanity/menu-content/publish/route.ts:16` | Ikke kartlagt per felt | Se handler/guard `app/api/backoffice/sanity/menu-content/publish/route.ts:16` |
| POST | `/api/cron/daily-order-summary` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/cron/daily-order-summary/route.ts:88` | Se imports/handler `app/api/cron/daily-order-summary/route.ts:88` | Ikke kartlagt per felt | Se handler/guard `app/api/cron/daily-order-summary/route.ts:88` |
| GET | `/api/cron/kitchen-print` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/cron/kitchen-print/route.ts:87` | Se imports/handler `app/api/cron/kitchen-print/route.ts:87` | Ikke kartlagt per felt | Se handler/guard `app/api/cron/kitchen-print/route.ts:87` |
| GET | `/api/cron/lock-weekplans` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/cron/lock-weekplans/route.ts:24` | Se imports/handler `app/api/cron/lock-weekplans/route.ts:24` | Ikke kartlagt per felt | Se handler/guard `app/api/cron/lock-weekplans/route.ts:24` |
| GET | `/api/cron/week-scheduler` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/cron/week-scheduler/route.ts:63` | Se imports/handler `app/api/cron/week-scheduler/route.ts:63` | Ikke kartlagt per felt | Se handler/guard `app/api/cron/week-scheduler/route.ts:63` |
| GET, POST | `/api/cron/week-visibility` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/cron/week-visibility/route.ts:150` | Se imports/handler `app/api/cron/week-visibility/route.ts:150` | Ikke kartlagt per felt | Se handler/guard `app/api/cron/week-visibility/route.ts:150` |
| POST | `/api/driver/bulk-set` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/driver/bulk-set/route.ts:63` | Se imports/handler `app/api/driver/bulk-set/route.ts:63` | Ikke kartlagt per felt | Se handler/guard `app/api/driver/bulk-set/route.ts:63` |
| POST | `/api/driver/confirm` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/driver/confirm/route.ts:13` | Se imports/handler `app/api/driver/confirm/route.ts:13` | Ikke kartlagt per felt | Se handler/guard `app/api/driver/confirm/route.ts:13` |
| GET | `/api/driver/orders` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/driver/orders/route.ts:24` | Se imports/handler `app/api/driver/orders/route.ts:24` | Ikke kartlagt per felt | Se handler/guard `app/api/driver/orders/route.ts:24` |
| GET | `/api/driver/stops` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/driver/stops/route.ts:97` | Se imports/handler `app/api/driver/stops/route.ts:97` | Ikke kartlagt per felt | Se handler/guard `app/api/driver/stops/route.ts:97` |
| GET | `/api/driver/today` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/driver/today/route.ts:56` | Se imports/handler `app/api/driver/today/route.ts:56` | Ikke kartlagt per felt | Se handler/guard `app/api/driver/today/route.ts:56` |
| GET | `/api/kitchen/batch/get` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/batch/get/route.ts:26` | Se imports/handler `app/api/kitchen/batch/get/route.ts:26` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/batch/get/route.ts:26` |
| GET | `/api/kitchen/batch/list` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/batch/list/route.ts:37` | Se imports/handler `app/api/kitchen/batch/list/route.ts:37` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/batch/list/route.ts:37` |
| POST | `/api/kitchen/batch/reset` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/batch/reset/route.ts:45` | Se imports/handler `app/api/kitchen/batch/reset/route.ts:45` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/batch/reset/route.ts:45` |
| PATCH | `/api/kitchen/batch` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/batch/route.ts:57` | Se imports/handler `app/api/kitchen/batch/route.ts:57` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/batch/route.ts:57` |
| POST | `/api/kitchen/batch/set` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/batch/set/route.ts:82` | Se imports/handler `app/api/kitchen/batch/set/route.ts:82` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/batch/set/route.ts:82` |
| POST | `/api/kitchen/batch/start` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/batch/start/route.ts:41` | Se imports/handler `app/api/kitchen/batch/start/route.ts:41` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/batch/start/route.ts:41` |
| GET | `/api/kitchen/batch/summary` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/batch/summary/route.ts:19` | Se imports/handler `app/api/kitchen/batch/summary/route.ts:19` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/batch/summary/route.ts:19` |
| POST | `/api/kitchen/batch/upsert` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/batch/upsert/route.ts:10` | Se imports/handler `app/api/kitchen/batch/upsert/route.ts:10` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/batch/upsert/route.ts:10` |
| GET | `/api/kitchen/companies` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/companies/route.ts:71` | Se imports/handler `app/api/kitchen/companies/route.ts:71` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/companies/route.ts:71` |
| GET | `/api/kitchen/company` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/company/route.ts:87` | Se imports/handler `app/api/kitchen/company/route.ts:87` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/company/route.ts:87` |
| GET | `/api/kitchen/day` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/day/route.ts:28` | Se imports/handler `app/api/kitchen/day/route.ts:28` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/day/route.ts:28` |
| GET | `/api/kitchen/demand-forecast` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/demand-forecast/route.ts:51` | Se imports/handler `app/api/kitchen/demand-forecast/route.ts:51` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/demand-forecast/route.ts:51` |
| GET, POST | `/api/kitchen/orders/batch-status` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/orders/batch-status/route.ts:85` | Se imports/handler `app/api/kitchen/orders/batch-status/route.ts:85` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/orders/batch-status/route.ts:85` |
| GET | `/api/kitchen/orders` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/orders/route.ts:16` | Se imports/handler `app/api/kitchen/orders/route.ts:16` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/orders/route.ts:16` |
| GET | `/api/kitchen/orders.csv` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/orders.csv/route.ts:22` | Se imports/handler `app/api/kitchen/orders.csv/route.ts:22` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/orders.csv/route.ts:22` |
| GET | `/api/kitchen/report` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/report/route.ts:24` | Se imports/handler `app/api/kitchen/report/route.ts:24` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/report/route.ts:24` |
| GET | `/api/kitchen/report.csv` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/report.csv/route.ts:25` | Se imports/handler `app/api/kitchen/report.csv/route.ts:25` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/report.csv/route.ts:25` |
| GET | `/api/kitchen` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/route.ts:67` | Se imports/handler `app/api/kitchen/route.ts:67` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/route.ts:67` |
| GET | `/api/kitchen/today` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/kitchen/today/route.ts:21` | Se imports/handler `app/api/kitchen/today/route.ts:21` | Ikke kartlagt per felt | Se handler/guard `app/api/kitchen/today/route.ts:21` |
| GET | `/api/me/agreement` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/me/agreement/route.ts:15` | Se imports/handler `app/api/me/agreement/route.ts:15` | Ikke kartlagt per felt | Se handler/guard `app/api/me/agreement/route.ts:15` |
| POST | `/api/order/bulk-set` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/order/bulk-set/route.ts:129` | Se imports/handler `app/api/order/bulk-set/route.ts:129` | Ikke kartlagt per felt | Se handler/guard `app/api/order/bulk-set/route.ts:129` |
| POST | `/api/order/cancel` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/order/cancel/route.ts:169` | Se imports/handler `app/api/order/cancel/route.ts:169` | Ikke kartlagt per felt | Se handler/guard `app/api/order/cancel/route.ts:169` |
| GET, POST, DELETE | `/api/order` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/order/route.ts:24` | Se imports/handler `app/api/order/route.ts:24` | Ikke kartlagt per felt | Se handler/guard `app/api/order/route.ts:24` |
| POST | `/api/order/set-choice` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/order/set-choice/route.ts:266` | Se imports/handler `app/api/order/set-choice/route.ts:266` | Ikke kartlagt per felt | Se handler/guard `app/api/order/set-choice/route.ts:266` |
| POST | `/api/order/set-day` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/order/set-day/route.ts:169` | Se imports/handler `app/api/order/set-day/route.ts:169` | Ikke kartlagt per felt | Se handler/guard `app/api/order/set-day/route.ts:169` |
| GET | `/api/order/week-demand-hints` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/order/week-demand-hints/route.ts:27` | Se imports/handler `app/api/order/week-demand-hints/route.ts:27` | Ikke kartlagt per felt | Se handler/guard `app/api/order/week-demand-hints/route.ts:27` |
| GET | `/api/order/window` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/order/window/route.ts:637` | Se imports/handler `app/api/order/window/route.ts:637` | Ikke kartlagt per felt | Se handler/guard `app/api/order/window/route.ts:637` |
| POST | `/api/orders/cancel` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/cancel/route.ts:111` | Se imports/handler `app/api/orders/cancel/route.ts:111` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/cancel/route.ts:111` |
| POST | `/api/orders/choice` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/choice/route.ts:202` | Se imports/handler `app/api/orders/choice/route.ts:202` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/choice/route.ts:202` |
| GET | `/api/orders/export` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/export/route.ts:50` | Se imports/handler `app/api/orders/export/route.ts:50` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/export/route.ts:50` |
| GET, POST, DELETE | `/api/orders/my` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/my/route.ts:70` | Se imports/handler `app/api/orders/my/route.ts:70` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/my/route.ts:70` |
| GET, POST, DELETE | `/api/orders` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/route.ts:358` | Se imports/handler `app/api/orders/route.ts:358` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/route.ts:358` |
| POST | `/api/orders/set` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/set/route.ts:91` | Se imports/handler `app/api/orders/set/route.ts:91` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/set/route.ts:91` |
| POST, GET | `/api/orders/today` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/today/route.ts:98` | Se imports/handler `app/api/orders/today/route.ts:98` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/today/route.ts:98` |
| POST | `/api/orders/toggle` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/toggle/route.ts:54` | Se imports/handler `app/api/orders/toggle/route.ts:54` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/toggle/route.ts:54` |
| POST | `/api/orders/upsert` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/upsert/route.ts:19` | Se imports/handler `app/api/orders/upsert/route.ts:19` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/upsert/route.ts:19` |
| GET | `/api/orders/week` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/week/route.ts:139` | Se imports/handler `app/api/orders/week/route.ts:139` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/week/route.ts:139` |
| PATCH | `/api/orders/[orderId]/cancel` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/[orderId]/cancel/route.ts:85` | Se imports/handler `app/api/orders/[orderId]/cancel/route.ts:85` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/[orderId]/cancel/route.ts:85` |
| GET | `/api/orders/[orderId]` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/[orderId]/route.ts:72` | Se imports/handler `app/api/orders/[orderId]/route.ts:72` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/[orderId]/route.ts:72` |
| POST | `/api/orders/[orderId]/toggle` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/orders/[orderId]/toggle/route.ts:94` | Se imports/handler `app/api/orders/[orderId]/toggle/route.ts:94` | Ikke kartlagt per felt | Se handler/guard `app/api/orders/[orderId]/toggle/route.ts:94` |
| GET, POST | `/api/superadmin/agreements/list` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/list/route.ts:34` | Se imports/handler `app/api/superadmin/agreements/list/route.ts:34` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/list/route.ts:34` |
| POST, GET | `/api/superadmin/agreements` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/route.ts:97` | Se imports/handler `app/api/superadmin/agreements/route.ts:97` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/route.ts:97` |
| POST, GET, PUT, DELETE | `/api/superadmin/agreements/[agreementId]/activate` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/[agreementId]/activate/route.ts:25` | Se imports/handler `app/api/superadmin/agreements/[agreementId]/activate/route.ts:25` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/[agreementId]/activate/route.ts:25` |
| POST | `/api/superadmin/agreements/[agreementId]/approve` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/[agreementId]/approve/route.ts:34` | Se imports/handler `app/api/superadmin/agreements/[agreementId]/approve/route.ts:34` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/[agreementId]/approve/route.ts:34` |
| POST, GET, PUT, DELETE | `/api/superadmin/agreements/[agreementId]/close` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/[agreementId]/close/route.ts:35` | Se imports/handler `app/api/superadmin/agreements/[agreementId]/close/route.ts:35` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/[agreementId]/close/route.ts:35` |
| POST, GET, PUT, DELETE | `/api/superadmin/agreements/[agreementId]/pause` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/[agreementId]/pause/route.ts:19` | Se imports/handler `app/api/superadmin/agreements/[agreementId]/pause/route.ts:19` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/[agreementId]/pause/route.ts:19` |
| POST | `/api/superadmin/agreements/[agreementId]/pause-ledger` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/[agreementId]/pause-ledger/route.ts:30` | Se imports/handler `app/api/superadmin/agreements/[agreementId]/pause-ledger/route.ts:30` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/[agreementId]/pause-ledger/route.ts:30` |
| POST | `/api/superadmin/agreements/[agreementId]/reject` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/[agreementId]/reject/route.ts:34` | Se imports/handler `app/api/superadmin/agreements/[agreementId]/reject/route.ts:34` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/[agreementId]/reject/route.ts:34` |
| POST, GET, PUT, DELETE | `/api/superadmin/agreements/[agreementId]/resume` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/agreements/[agreementId]/resume/route.ts:19` | Se imports/handler `app/api/superadmin/agreements/[agreementId]/resume/route.ts:19` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/agreements/[agreementId]/resume/route.ts:19` |
| GET, POST | `/api/superadmin/companies/agreement` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/companies/agreement/route.ts:25` | Se imports/handler `app/api/superadmin/companies/agreement/route.ts:25` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/companies/agreement/route.ts:25` |
| POST, GET, PUT, DELETE | `/api/superadmin/companies/[companyId]/agreement/status` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/companies/[companyId]/agreement/status/route.ts:61` | Se imports/handler `app/api/superadmin/companies/[companyId]/agreement/status/route.ts:61` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/companies/[companyId]/agreement/status/route.ts:61` |
| GET | `/api/superadmin/companies/[companyId]/archive/orders` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/companies/[companyId]/archive/orders/route.ts:67` | Se imports/handler `app/api/superadmin/companies/[companyId]/archive/orders/route.ts:67` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/companies/[companyId]/archive/orders/route.ts:67` |
| GET | `/api/superadmin/companies/[companyId]/orders` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/companies/[companyId]/orders/route.ts:78` | Se imports/handler `app/api/superadmin/companies/[companyId]/orders/route.ts:78` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/companies/[companyId]/orders/route.ts:78` |
| POST | `/api/superadmin/company-registrations/[companyId]/create-agreement-draft` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/company-registrations/[companyId]/create-agreement-draft/route.ts:25` | Se imports/handler `app/api/superadmin/company-registrations/[companyId]/create-agreement-draft/route.ts:25` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/company-registrations/[companyId]/create-agreement-draft/route.ts:25` |
| POST | `/api/superadmin/menu-publish` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/menu-publish/route.ts:6` | Se imports/handler `app/api/superadmin/menu-publish/route.ts:6` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/menu-publish/route.ts:6` |
| GET | `/api/superadmin/menus-week` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/menus-week/route.ts:47` | Se imports/handler `app/api/superadmin/menus-week/route.ts:47` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/menus-week/route.ts:47` |
| GET | `/api/superadmin/system/orders/integrity/summary` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/superadmin/system/orders/integrity/summary/route.ts:36` | Se imports/handler `app/api/superadmin/system/orders/integrity/summary/route.ts:36` | Ikke kartlagt per felt | Se handler/guard `app/api/superadmin/system/orders/integrity/summary/route.ts:36` |
| GET | `/api/v1/public/orders` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/v1/public/orders/route.ts:13` | Se imports/handler `app/api/v1/public/orders/route.ts:13` | Ikke kartlagt per felt | Se handler/guard `app/api/v1/public/orders/route.ts:13` |
| GET | `/api/week` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/week/route.ts:86` | Se imports/handler `app/api/week/route.ts:86` | Ikke kartlagt per felt | Se handler/guard `app/api/week/route.ts:86` |
| GET | `/api/weekplan/next` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/weekplan/next/route.ts:33` | Se imports/handler `app/api/weekplan/next/route.ts:33` | Ikke kartlagt per felt | Se handler/guard `app/api/weekplan/next/route.ts:33` |
| POST, GET | `/api/weekplan/publish` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/weekplan/publish/route.ts:60` | Se imports/handler `app/api/weekplan/publish/route.ts:60` | Ikke kartlagt per felt | Se handler/guard `app/api/weekplan/publish/route.ts:60` |
| GET | `/api/weekplan` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/api/weekplan/route.ts:33` | Se imports/handler `app/api/weekplan/route.ts:33` | Ikke kartlagt per felt | Se handler/guard `app/api/weekplan/route.ts:33` |
| GET | `/driver/csv` | Relevant route handler med meny/uke/order/agreement/levering-treff `app/driver/csv/route.ts:55` | Se imports/handler `app/driver/csv/route.ts:55` | Ikke kartlagt per felt | Se handler/guard `app/driver/csv/route.ts:55` |

## 10. Forretningslogikk

### 10.1 Auto-fyll
- Implementert i Sanity custom tool `WeekPlanner`, ikke funnet som Next API eller Supabase function. `studio/src/tools/WeekPlanner.tsx:264-353`
- Retter velges fra `mealIdea`-pool med `isActive == true` og `defined(nutritionPer100g.energyKcal)`. `studio/src/tools/WeekPlanner.tsx:184-216`
- Generatoren scorer margin, nutritionScore, AI learning, costTier, protein/kjøkkenstil/metode, brukshistorikk og allergenbelastning; den krever min. 50 gyldige retter, maks én fisk/suppe/vegetar, og 5 hverdager. `lib/menu-publish/generateWeekMenu.ts:64-73`, `lib/menu-publish/generateWeekMenu.ts:146-240`, `lib/menu-publish/generateWeekMenu.ts:526-562`
- Auto-fyll sperres hvis en eksisterende dag i uken er godkjent. `studio/src/tools/WeekPlanner.tsx:272-275`
- Felter som fylles: description, mealTitle, mealRef, allergens, mayContain, nutritionPer100g, kitchenStyle, costTier, estimatedCostPerPortion, isFishDish/isSoup/isVegetarian, approvedForPublish false, customerVisible false. `studio/src/tools/WeekPlanner.tsx:310-333`

### 10.2 Godkjenning
- `Godkjenn uke 2` sikrer uke 2 finnes, henter 5 `menuDay`, krever 5 hverdager, beskrivelse min. 8 tegn og nutrition energyKcal. `studio/src/tools/WeekPlanner.tsx:356-387`
- Ved godkjenning settes `approvedForPublish: true` og `approvedAt: now`; dokumentet publiseres ikke som draft->published i koden som er funnet. `studio/src/tools/WeekPlanner.tsx:389-399`
- `Trekk godkjenning` setter `approvedForPublish:false`, `customerVisible:false` og unsetter `approvedAt/customerVisibleSetAt`. `studio/src/tools/WeekPlanner.tsx:409-424`

### 10.3 Skjult-flagg
- I WeekPlanner betyr `customerVisible` false badge `Skjult`. `studio/src/tools/WeekPlanner.tsx:480-486`
- Next `menuContent`-filteret skjuler data når verken legacy `isPublished` eller `approvedForPublish && customerVisible` er true. `lib/sanity/queries.ts:56-72`
- `menuDay`-skjemaet har `customerVisible` readOnly og `customerVisibleSetAt`, mens `weekPlan.days[]` også har et separat `hidden` felt. `studio/schemaTypes/menuDay.ts:189-202`, `studio/schemas/weekPlan.ts:332-337`

### 10.4 Margin-beregning
- Sanity WeekPlanner regner margin klient-side i Studio mot konstant `TARGET_PRICE = 90`. `studio/src/tools/WeekPlanner.tsx:8-9`, `studio/src/tools/WeekPlanner.tsx:90-92`
- Generatoren regner margin mot `TARGET_PRICE = 90` og bruker default råvarekost 65 hvis verdi mangler/ugyldig. `lib/menu-publish/generateWeekMenu.ts:64-68`, `lib/menu-publish/generateWeekMenu.ts:83-95`
- `mealIdea` hardkoder `TARGET_PRICE_PER_PORTION = 90`, setter `targetPricePerPortion` readOnly og validerer råvarekost maks 90. `studio/schemaTypes/mealIdea.ts:3-4`, `studio/schemaTypes/mealIdea.ts:102-121`

## 11. Eksisterende tier-/plan-konsepter
| Term | Fil:linje | Kontekst |
|---|---|---|
| Treff | `.tmp/staging_apply/supabase/migrations/20260219000100_enterprise_registration_agreement_order_guards.sql:2` | `-- A+B+C enterprise-safe hardening:` |
| Treff | `.tmp/staging_apply/supabase/migrations/20260219000100_enterprise_registration_agreement_order_guards.sql:27` | `create type public.agreement_tier as enum ('BASIS', 'LUXUS');` |
| Treff | `.tmp/staging_apply/supabase/migrations/20260219000100_enterprise_registration_agreement_order_guards.sql:517` | `p_tier text default 'BASIS',` |
| Treff | `.tmp/staging_apply/supabase/migrations/20260219000100_enterprise_registration_agreement_order_guards.sql:580` | `if v_tier not in ('BASIS', 'LUXUS') then` |
| Treff | `.tmp/staging_apply/supabase/migrations/20260219000100_enterprise_registration_agreement_order_guards.sql:645` | `tier,` |
| Treff | `.tmp/staging_public_schema.sql:22` | `COMMENT ON SCHEMA "public" IS 'standard public schema';` |
| Treff | `.tmp/staging_public_schema.sql:38` | `'BASIS',` |
| Treff | `.tmp/staging_public_schema.sql:39` | `'LUXUS'` |
| Treff | `.tmp/staging_public_schema.sql:261` | `CREATE OR REPLACE FUNCTION "public"."lp_agreement_create_pending"("p_company_id" "uuid", "p_location_id" "uuid" DEFAULT NULL::"uuid", "p_tier" "text" DEFAULT 'BASIS'::"text", "p_de` |
| Treff | `.tmp/staging_public_schema.sql:314` | `if v_tier not in ('BASIS', 'LUXUS') then` |
| Treff | `.tmp/staging_public_schema.sql:379` | `tier,` |
| Treff | `.tmp/staging_public_schema.sql:1018` | `"tier" "public"."agreement_tier" DEFAULT 'BASIS'::"public"."agreement_tier" NOT NULL,` |
| Treff | `.vscode/settings.json:9` | `// Generelt (rolig enterprise-default)` |
| Treff | `AGENTS.md:3` | `Enterprise Command System · Commercial Excellence · System Truth` |
| Treff | `AGENTS.md:9` | `All work is **enterprise-hardening, system integrity, and commercial dominance**.` |
| Treff | `AGENTS.md:26` | `- 'build:enterprise'` |
| Treff | `AGENTS.md:201` | `# C) NON-NEGOTIABLE ENTERPRISE LAW` |
| Treff | `AGENTS.md:203` | `## C3) ENTERPRISE LAW (LOCKED)` |
| Treff | `AGENTS.md:222` | `- 'build:enterprise'` |
| Treff | `AGENTS.md:322` | `- Centered premium card` |
| Treff | `AGENTS.md:454` | `build:enterprise passes` |
| Treff | `AGENTS.md:486` | `npm run build:enterprise` |
| Treff | `AGENTS.md:490` | `L) DEBUGGING STANDARD (LOCKED)` |
| Treff | `AGENTS.md:491` | `L12) DEBUGGING STANDARD` |
| Treff | `AGENTS.md:605` | `This project includes a frozen enterprise lifecycle:` |
| Treff | `AGENTS.md:613` | `Invoice basis (readonly)` |
| Treff | `AGENTS.md:639` | `Q) ENTERPRISE ROADMAP SCOPE (K1–K4) — ALLOWED WORK AFTER FREEZE` |
| Treff | `AGENTS.md:644` | `K1: Enterprise groups / multi-location governance` |
| Treff | `AGENTS.md:851` | `Calm, enterprise tone is mandatory.` |
| Treff | `AGENTS.md:861` | `Headings (H1–H4 and title/heading classes) must use Inter for enterprise clarity.` |
| Treff | `AGENTS_TLDR.md:26` | `- Focus is **enterprise hardening**, not feature building` |
| Treff | `AGENTS_TLDR.md:28` | `- CI Enterprise is the **final authority**` |
| Treff | `AGENTS_TLDR.md:116` | `A change is **DONE only when CI Enterprise is green** on the same commit.` |
| Treff | `AGENTS_TLDR.md:122` | `npm run build:enterprise` |
| Treff | `app/(app)/dashboard/page.tsx:252` | `Plan: <span style={{ color: "var(--text)", fontWeight: 650 }}>Luxus</span>` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:37` | `tier: "BASIS" / "LUXUS" / null;` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:73` | `type PreviewMode = "basis" / "luxus" / "mixed";` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:115` | `function asTier(v: unknown): "BASIS" / "LUXUS" / null {` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:117` | `if (s === "BASIS" // s === "LUXUS") return s;` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:146` | `tier: asTier(d.tier),` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:245` | `function tierChoiceLimit(tier: DayRow["tier"]) {` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:246` | `if (tier === "LUXUS") return 6;` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:247` | `if (tier === "BASIS") return 3;` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:252` | `const limit = tierChoiceLimit(day.tier);` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:253` | `if (day.tier === "LUXUS") return 'Luxus - ${limit} valg';` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:254` | `if (day.tier === "BASIS") return 'Basis - ${limit} valg';` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:259` | `if (day.tier === "LUXUS") return LUXUS_CATEGORY_LABELS;` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:260` | `if (day.tier === "BASIS") return BASIS_CATEGORY_LABELS;` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:273` | `const limit = tierChoiceLimit(day.tier);` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:297` | `function previewTierForDay(mode: PreviewMode, index: number): DayRow["tier"] {` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:298` | `if (mode === "luxus") return "LUXUS";` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:299` | `if (mode === "mixed") return index < 3 ? "BASIS" : "LUXUS";` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:300` | `return "BASIS";` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:303` | `function choicesForTier(tier: DayRow["tier"]): MealChoice[] {` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:304` | `if (!tier) return [];` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:305` | `return (tier === "LUXUS" ? LUXUS_CATEGORY_LABELS : BASIS_CATEGORY_LABELS).map((label) => ({` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:311` | `function buildPreviewDays(mode: PreviewMode = "basis"): DayRow[] {` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:314` | `const tier = previewTierForDay(mode, index);` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:318` | `tier,` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:319` | `allowedChoices: choicesForTier(tier),` |
| Treff | `app/(app)/week/EmployeeWeekClient.tsx:931` | `previewMode = "basis",` |
| Treff | `app/(app)/week/page.tsx:104` | `basis: SuperadminCategoryDayStatus[];` |
| Treff | `app/(app)/week/page.tsx:122` | `type EmployeePreviewMode = "basis" / "luxus" / "mixed";` |
| Treff | `app/(app)/week/page.tsx:126` | `if (raw === "luxus" // raw === "mixed") return raw;` |
| Treff | `app/(app)/week/page.tsx:127` | `return "basis";` |
| Treff | `app/(app)/week/page.tsx:240` | `basis: buildCategoryStatuses(BASIS_MENU_TYPES, menusByCategory),` |
| Treff | `app/(app)/week/page.tsx:350` | `<SuperadminCategoryGroup title="Basis" statuses={status.basis} />` |
| Treff | `app/(app)/week/page.tsx:351` | `<SuperadminCategoryGroup title="Luxus ekstra" statuses={status.luxusExtra} />` |
| Treff | `app/(app)/week/page.tsx:391` | `Basis komplett {counts.basisComplete}/5` |
| Treff | `app/(app)/week/page.tsx:394` | `Luxus komplett {counts.luxusComplete}/5` |
| Treff | `app/(app)/week/page.tsx:402` | `Publiser Salatboks, Påsmurt og Varmmat for Basis. Legg til Sushi, Pokebowl og Thaimat for Luxus.` |
| Treff | `app/(app)/week/page.tsx:418` | `{ mode: "basis", label: "Basis-demo", description: "Salatboks, Påsmurt og Varmmat" },` |
| Treff | `app/(app)/week/page.tsx:419` | `{ mode: "luxus", label: "Luxus-demo", description: "Alle seks kategorier" },` |
| Treff | `app/(app)/week/page.tsx:420` | `{ mode: "mixed", label: "Blandet uke-demo", description: "Basis mandag-onsdag, Luxus torsdag-fredag" },` |
| Treff | `app/(app)/week/page.tsx:433` | `Kontroller hvordan Basis, Luxus og blandet uke ser ut for ansatte. Dette er kun visning og kan ikke sende bestilling.` |
| Treff | `app/(app)/week/page.tsx:521` | `Basis komplett {thisWeekCounts.basisComplete}/5` |
| Treff | `app/(app)/week/page.tsx:524` | `Luxus komplett {thisWeekCounts.luxusComplete}/5` |
| Treff | `app/(app)/week/page.tsx:530` | `Basis komplett {nextWeekCounts.basisComplete}/5` |
| Treff | `app/(app)/week/page.tsx:533` | `Luxus komplett {nextWeekCounts.luxusComplete}/5` |
| Treff | `app/(backoffice)/backoffice/ai/AiTreeNav.tsx:31` | `{ id: "enterprise-dash", label: "Enterprise / inntekt", href: "/backoffice/enterprise" },` |
| Treff | `app/(backoffice)/backoffice/ai/AiTreeNav.tsx:41` | `{ id: "enterprise-ops", label: "Enterprise Ops", href: "/backoffice/ops" },` |
| Treff | `app/(backoffice)/backoffice/ai/overview/page.tsx:69` | `/** Basis-gap ved hendelsen (0–1). */` |
| Treff | `app/(backoffice)/backoffice/automation/page.tsx:161` | `Enterprise Sales AI` |
| Treff | `app/(backoffice)/backoffice/board/page.tsx:63` | `Enterprise-grade system · Deterministiske AI-beslutninger · Sporbar og kontrollert` |
| Treff | `app/(backoffice)/backoffice/business/page.tsx:48` | `← Enterprise Ops` |
| Treff | `app/(backoffice)/backoffice/content/_components/BlockCollapsedPreview.tsx:40` | `return parts.length ? parts.join(" · ") : "Standard layout";` |
| Treff | `app/(backoffice)/backoffice/content/_components/BlockCollapsedPreview.tsx:212` | `const fb = String(flat.emptyFallbackText // "").trim() ? "Tomtilstand: egen tekst" : "Tomtilstand: standard";` |
| Treff | `app/(backoffice)/backoffice/content/_components/blockFieldSchemas.ts:54` | `/** Canonical copy for empty required fields (Norwegian, enterprise tone). */` |
| Treff | `app/(backoffice)/backoffice/content/_components/blockPropertyEditors/HeroBleedPropertyEditor.tsx:27` | `To knapper, sterk visuell flate. For rolig budskap i innholdsbredde: bruk «Hero (standard)» eller «Hero (full bredde)».` |
| Treff | `app/(backoffice)/backoffice/content/_components/blockPropertyEditors/HeroFullPropertyEditor.tsx:27` | `Åpen, trygg forside-følelse. Skiller seg fra standard-hero (innholdsbredde) og fra kant-til-kant-hero (kampanje/dramatikk).` |
| Treff | `app/(backoffice)/backoffice/content/_components/blockPropertyEditors/HeroPropertyEditor.tsx:10` | `/** Standard hero — innholdsbredden. Data-type: 'hero'. U91: 'contentData' + tom 'settingsData'. */` |
| Treff | `app/(backoffice)/backoffice/content/_components/blockPropertyEditors/HeroPropertyEditor.tsx:173` | `Standard-hero har ingen egne layout-innstillinger — alt budskap og media ligger i innholdslaget.` |
| Treff | `app/(backoffice)/backoffice/content/_components/CmsBlockDesignSection.tsx:23` | `const LAYOUTS: BlockLayout[] = ["standard", "full", "split"];` |
| Treff | `app/(backoffice)/backoffice/content/_components/CmsBlockDesignSection.tsx:38` | `const layout = cfg.layout ?? "standard";` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx:74` | `tone?: "enterprise" / "warm" / "neutral";` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx:228` | `const [pageBuilderTone, setPageBuilderTone] = useState<"enterprise" / "warm" / "neutral">("enterprise");` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx:1041` | `onChange={(e) => setPageBuilderTone(e.target.value as "enterprise" / "warm" / "neutral")}` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx:1043` | `<option value="enterprise">Enterprise</option>` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx:1099` | `pageBuilderTone !== "enterprise" //` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentDetailDocumentShellBar.tsx:126` | `data-lp-content-detail-document-actions-tier="primary"` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentSeoPanel.tsx:231` | `Verdier som sendes til søkemotorer og deling. Tomme felt får standard/fallback.` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentSeoPanel.tsx:268` | `<dd className="truncate text-[13px]">{ogImage // "(standard fra innstillinger)"}</dd>` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentSeoPanel.tsx:374` | `tomt brukes standard fra Global &gt; Innhold og innstillinger.` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentTopbar.tsx:30` | `/** When true, variant is part of a scheduled release (enterprise visibility). */` |
| Treff | `app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks.ts:176` | `max != null ? 'maks ${max}' : "maks standard",` |
| Treff | `app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks.ts:178` | `String(flat.emptyFallbackText ?? "").trim() ? "Egen tomtilstand" : "Standard tomtilstand",` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx:42` | `/** På '/backoffice/content/[id]': dev-HUD av som standard; slå på med '?lpDebugHud=1' eller 'localStorage lp-content-debug-hud=1'. */` |
| Treff | `app/(backoffice)/backoffice/content/_components/contentWorkspaceEditorConstants.ts:12` | `closeup: "Nærbilde av premium mat og råvarer",` |
| Treff | `app/(backoffice)/backoffice/content/_components/contentWorkspaceEditorConstants.ts:44` | `subtitle: "Raskt, enkelt og premium for travle team",` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalHeaderShell.tsx:83` | `{ id: "superadmin" as const, title: "Superadmin header", desc: "Systemadministrasjon. Faner: Kontrollsenter, CFO, Konsern, Firma, ESG, Systemhelse, Revisjon.", headerTitle: "Supera` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalMainViewShell.tsx:78` | `defaultValue="Standard"` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalMainViewShell.tsx:94` | `Vises i standard Meta-tittel og som logo-tekst (skjules hvis logo er lagt til).` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalMainViewShell.tsx:104` | `<span className="font-medium text-[rgb(var(--lp-text))]">Standard delingsbilde</span>` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalMainViewShellCont.tsx:80` | `Brukes som standard liste for påmeldinger hvis ikke annet er angitt.` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalNavigationShellPanelsCont.tsx:69` | `Overstyrer standard overskrift definert i ordboken.` |
| Treff | `app/(backoffice)/backoffice/content/_components/contentWorkspaceImagePromptShell.ts:51` | `Nærbilde av premium mat og råvarer,` |
| Treff | `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx:227` | `Disse flatene beholdes for kontekst, men skjules som standard for å redusere inspector-støy.` |
| Treff | `app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx:39` | `plan?: "basis" / "luxus";` |
| Treff | `app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx:65` | `plan: planProp = "luxus",` |
| Treff | `app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx:71` | `const [planDraft, setPlanDraft] = useState<"basis" / "luxus">(planProp === "basis" ? "basis" : "luxus");` |
| Treff | `app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx:78` | `setPlanDraft(planProp === "basis" ? "basis" : "luxus");` |
| Treff | `app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx:412` | `onChange={(e) => setPlanDraft(e.target.value === "basis" ? "basis" : "luxus")}` |
| Treff | `app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx:414` | `<option value="luxus">Luxus</option>` |
| Treff | `app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx:415` | `<option value="basis">Basis</option>` |
| Treff | `app/(backoffice)/backoffice/content/_components/editorBlockTypes.ts:11` | `/** U91: Hero — content vs settings er eksplisitte lag (settings tom for standard-hero). */` |
| Treff | `app/(backoffice)/backoffice/content/_components/EditorEnterpriseInsightsPanel.tsx:35` | `const res = await fetch('/api/backoffice/enterprise/page-insights?pageId=${encodeURIComponent(pageId)}', {` |
| Treff | `app/(backoffice)/backoffice/content/_components/GlobalDesignSystemSection.tsx:31` | `default: "Standard (alle typer)",` |
| Treff | `app/(backoffice)/backoffice/content/_components/InsertAiBlockModal.tsx:83` | `Beskriv innholdet eller la feltet stå tomt for en standard blokk. Blokken settes inn` |
| Treff | `app/(backoffice)/backoffice/content/_components/OutboundPanel.tsx:54` | `/** Standard produkt-/kampanjelenke i e-post */` |
| Treff | `app/(backoffice)/backoffice/content/_components/OutboundPanel.tsx:294` | `msg += " Oppfølging planlagt (én per lead, min. 30 døgn, standard 60 døgn).";` |
| Treff | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts:642` | `tone: "enterprise",` |
| Treff | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts:891` | `tone?: "enterprise" / "warm" / "neutral";` |
| Treff | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceInspectorPanels.tsx:558` | `Sidenavn brukes som standard hvis ingenting er fylt inn.` |
| Treff | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceInspectorPanels.tsx:699` | `Sidenavn brukes som standard hvis ingenting er fylt inn.` |
| Treff | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceInspectorPanels.tsx:839` | `Bilde som brukes når siden deles på sosiale medier. Bruk minst 1200×630 px. Hvis tomt brukes standard fra Global &gt; Innhold og innstillinger.` |
| Treff | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceInspectorPanels.tsx:936` | `<p className="text-xs text-[rgb(var(--lp-muted))]">Overstyrer standard nodenavn som brukes i URL.</p>` |
| Treff | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceInspectorPanels.tsx:1161` | `<p className="text-xs text-[rgb(var(--lp-muted))]">Overstyr standard innholdsretning fra Global &gt; Innhold og innstillinger.</p>` |
| Treff | `app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx:358` | `Tips: velg en side i treet til venstre for detaljredigering. Standard innholdsoversikt ligger på{" "}` |
| Treff | `app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx:369` | `const tier = opportunityImpact(o.priority);` |
| Treff | `app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx:375` | `{impactEmoji(tier)}` |
| Treff | `app/(backoffice)/backoffice/enterprise/page.tsx:6` | `import { buildEnterpriseDashboardPayload } from "@/lib/ai/enterprise/buildDashboardPayload";` |
| Treff | `app/(backoffice)/backoffice/enterprise/page.tsx:7` | `import { fetchRecentEnterpriseLogs } from "@/lib/ai/enterprise/enterpriseLog";` |
| Treff | `app/(backoffice)/backoffice/enterprise/page.tsx:28` | `loadError = e instanceof Error ? e.message : "Kunne ikke laste enterprise-data.";` |
| Treff | `app/(backoffice)/backoffice/enterprise/page.tsx:34` | `<h1 className="text-2xl font-semibold tracking-tight text-slate-900">Enterprise — inntekt og margin</h1>` |
| Treff | `app/(backoffice)/backoffice/global/page.tsx:56` | `← Enterprise Ops` |
| Treff | `app/(backoffice)/backoffice/observability/page.tsx:58` | `← Enterprise Ops` |
| Treff | `app/(backoffice)/backoffice/ops/page.tsx:58` | `<h1 className="font-heading text-xl font-semibold text-slate-900">Enterprise Ops</h1>` |
| Treff | `app/(backoffice)/backoffice/system/page.tsx:51` | `← Enterprise Ops` |
| Treff | `app/admin/agreement/page.tsx:52` | `function formatTierLabel(value: AgreementPageData["pricing"]["planTier"]) {` |
| Treff | `app/admin/agreement/page.tsx:54` | `return value === "LUXUS" ? "Luxus" : "Basis";` |
| Treff | `app/admin/agreement/page.tsx:94` | `const hasTier = Boolean(day?.tier);` |
| Treff | `app/admin/agreement/page.tsx:99` | `{hasTier ? (day?.tier === "LUXUS" ? "Luxus" : "Basis") : "Ikke i avtalen"}` |
| Treff | `app/admin/agreement/page.tsx:127` | `{day?.tier ? (day.tier === "LUXUS" ? "Luxus" : "Basis") : "Ikke i avtalen"}` |
| Treff | `app/admin/agreement/page.tsx:195` | `<div className="mt-2 text-sm text-[rgb(var(--lp-text))]">Tier: {formatTierLabel(data.pricing.planTier)}</div>` |
| Treff | `app/admin/dashboard/MyLunchCard.tsx:28` | `tierToday: "BASIS" / "LUXUS" / null;` |
| Treff | `app/admin/dashboard/MyLunchCard.tsx:110` | `<div className="text-xs text-[rgb(var(--lp-muted))]">Tier: {tierToday ?? "—"}</div>` |
| Treff | `app/admin/menus/MenusClient.tsx:63` | `// Avbryt forrige request (enterprise: ingen “race conditions”)` |
| Treff | `app/admin/menus/MenusClient.tsx:159` | `// Enterprise: publiser deterministisk i rekkefølge (Man–Fre)` |
| Treff | `app/admin/menus/page.tsx:63` | `// Superadmin-only (enterprise)` |
| Treff | `app/admin/menus/page.tsx:88` | `{/* Enterprise support hook (audit + RID) */}` |
| Treff | `app/admin/orders/page.tsx:71` | `// company_admin må ha company_id (enterprise gate håndteres ellers på /admin)` |
| Treff | `app/admin/orders/page.tsx:107` | `{/* Enterprise note */}` |
| Treff | `app/api/accept-invite/complete/route.ts:155` | `"Firmaet mangler standard-lokasjon. Kontakt support/superadmin.",` |
| Treff | `app/api/admin/agreement/route.ts:13` | `import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";` |
| Treff | `app/api/admin/agreement/route.ts:55` | `function normTier(v: any): Tier / null {` |
| Treff | `app/api/admin/agreement/route.ts:57` | `if (s === "BASIS" // s === "LUXUS") return s as Tier;` |
| Treff | `app/api/admin/agreement/route.ts:150` | `function buildWeekPlan(status: AgreementStatus, deliveryDays: string[], rulesByDay: Map<DayKey, { tier: Tier }>) {` |
| Treff | `app/api/admin/agreement/route.ts:155` | `const hasTier = Boolean(rule?.tier);` |
| Treff | `app/api/admin/agreement/route.ts:168` | `tier: hasRule ? rule?.tier ?? null : null,` |
| Treff | `app/api/admin/agreement/route.ts:278` | `.select("id,company_id,status,tier,price_per_meal_nok,delivery_days,starts_at,ends_at,created_at,updated_at")` |
| Treff | `app/api/admin/agreement/route.ts:291` | `plan_tier: row.tier ?? null,` |
| Treff | `app/api/admin/agreement/route.ts:329` | `const rulesByDay = new Map<DayKey, { tier: Tier }>();` |
| Treff | `app/api/admin/agreement/route.ts:332` | `for (const [dayKey, tier] of Object.entries(dayTiers)) {` |
| Treff | `app/api/admin/agreement/route.ts:334` | `const normalizedTier = normTier(tier);` |
| Treff | `app/api/admin/agreement/route.ts:336` | `rulesByDay.set(normalizedDay, { tier: normalizedTier });` |
| Treff | `app/api/admin/agreement/route.ts:421` | `planTier: normTier(agreementRow?.plan_tier ?? null),` |
| Treff | `app/api/admin/employees/audit/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/invite/route.ts:12` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/invite/route.ts:204` | `if (!def.ok) return jsonErr(rid, "Kunne ikke hente standard-lokasjon.", 500, { code: "DEFAULT_LOCATION_LOOKUP_FAILED", detail: def.error });` |
| Treff | `app/api/admin/employees/invite/route.ts:206` | `return jsonErr(rid, "Firmaet mangler standard-lokasjon. Kontakt support/superadmin.", 409, { code: "MISSING_DEFAULT_LOCATION", detail: {` |
| Treff | `app/api/admin/employees/invites/resend/route.ts:12` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/invites/revoke/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/invites/route.ts:9` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/invites/stats/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/list/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/resend-invite/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/route.ts:93` | `// ✅ Enterprise-flat payload (client kan lese direkte)` |
| Treff | `app/api/admin/employees/set-disabled/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/employees/[userId]/disable/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/insight/route.ts:11` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/invite/route.ts:221` | `if (!def.ok) return jsonErr(rid, "Kunne ikke hente standard-lokasjon.", 500, { code: "DEFAULT_LOCATION_LOOKUP_FAILED", detail: def.error });` |
| Treff | `app/api/admin/invite/route.ts:223` | `return jsonErr(rid, "Firmaet mangler standard-lokasjon. Kontakt support/superadmin.", 409, { code: "MISSING_DEFAULT_LOCATION", detail: {` |
| Treff | `app/api/admin/invites/route.ts:293` | `return jsonErr(rid, "Firmaet mangler gyldig standard-lokasjon.", 409, { code: "MISSING_LOCATION", detail: {` |
| Treff | `app/api/admin/invoices/csv/route.ts:42` | `if (s === "BASIS" // s === "LUXUS") return s as PlanTier;` |
| Treff | `app/api/admin/invoices/csv/route.ts:75` | `tier: (row as any).tier ?? null,` |
| Treff | `app/api/admin/invoices/csv/route.ts:304` | `{ date: string; location_id: string / null; slot: string / null; tier: PlanTier; unit: number; qty: number }` |
| Treff | `app/api/admin/invoices/csv/route.ts:320` | `const tier = asPlanTier(tierRaw);` |
| Treff | `app/api/admin/invoices/csv/route.ts:321` | `if (!tier) {` |
| Treff | `app/api/admin/invoices/csv/route.ts:323` | `return jsonErr(rid, "Kunne ikke løse plan-tier for dato (forventer BASIS/LUXUS).", 500, {` |
| Treff | `app/api/admin/invoices/csv/route.ts:325` | `detail: { date: dateISO, tier: tierRaw },` |
| Treff | `app/api/admin/invoices/csv/route.ts:329` | `const unit = Number(PRICE_PER_TIER[tier] ?? 0);` |
| Treff | `app/api/admin/invoices/csv/route.ts:333` | `const key = [dateISO, location_id ?? "", slot ?? "", tier].join("/");` |
| Treff | `app/api/admin/invoices/csv/route.ts:336` | `else buckets.set(key, { date: dateISO, location_id, slot, tier, unit, qty: 1 });` |
| Treff | `app/api/admin/invoices/csv/route.ts:363` | `plan_tier: b.tier,` |
| Treff | `app/api/admin/locations/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/me/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/metrics/daily/route.ts:11` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/metrics/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/metrics/summary/route.ts:11` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/metrics/weekly/route.ts:11` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/orders/route.ts:12` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/admin/orders/route.ts:139` | `// ✅ Enterprise-hardening: aldri knekk klient med error-shape på dette endepunktet.` |
| Treff | `app/api/admin/orders/route.ts:221` | `// ✅ Enterprise-hardening: også her – aldri returner en shape som kan knekke UI` |
| Treff | `app/api/admin/users/route.ts:10` | `// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)` |
| Treff | `app/api/agreements/route.ts:55` | `// Enterprise: returner ok:true med warning` |
| Treff | `app/api/agreements/route.ts:74` | `// Enterprise: aldri knekk UI` |
| Treff | `app/api/ai/analyze/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/automation/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/block/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/block/route.ts:65` | `- Skriv som en premium delikatessebutikk` |
| Treff | `app/api/ai/block/route.ts:111` | `"You are an expert copywriter for premium food and delicatessen products. Return only the rewritten text, without headings, prefixes, or explanation.";` |
| Treff | `app/api/ai/block/score/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/business-engine/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/continue/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/copilot/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/dashboard/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/decision/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/design/analyze/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/design/generate/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/experiments/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/generate/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/growth/ads/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/growth/funnel/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/growth/seo/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/image/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/inline/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/insights/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/layout/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/learn/route.ts:1` | `// @enterprise-exclude` |
| Treff | `app/api/ai/optimize/route.ts:1` | `// @enterprise-exclude` |

## 12. Datoformatering

### 12.1 Alle formatere og bruksområder
| Fil:linje | Format produsert | Kontekst |
|---|---|---|
| `app/(app)/home/page.tsx:9` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";` |
| `app/(app)/home/page.tsx:30` | Ukjent | `function dayNameNO(dateISO: string) {` |
| `app/(app)/home/page.tsx:36` | ISO internt | `// YYYY-MM-DD kan sammenlignes som string` |
| `app/(app)/home/page.tsx:56` | DD-MM-YYYY i helperen (se avvik) | `{dayNameNO(m.date)} • {formatDateNO(m.date)}` |
| `app/(app)/home/page.tsx:186` | Ukjent | `<span className="lp-chip">{dayNameNO(today)}</span>` |
| `app/(app)/home/page.tsx:187` | DD-MM-YYYY i helperen (se avvik) | `<span className="lp-chip">{formatDateNO(today)}</span>` |
| `app/(app)/week/bestillingsprofil/page.tsx:17` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatTimeNO, formatWeekdayNO } from "@/lib/date/format";` |
| `app/(app)/week/bestillingsprofil/page.tsx:202` | DD-MM-YYYY i helperen (se avvik) | `? '${formatDateNO(pastSum.sisteRegistrerteLeveringsdato)} · ${formatWeekdayNO(pastSum.sisteRegistrerteLeveringsdato)}'` |
| `app/(app)/week/bestillingsprofil/page.tsx:210` | DD-MM-YYYY i helperen (se avvik) | `? '${formatDateNO(pastSum.sisteKansellerteLeveringsdato)} · ${formatWeekdayNO(pastSum.sisteKansellerteLeveringsdato)}'` |
| `app/(app)/week/bestillingsprofil/page.tsx:225` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(sistOpp.delivery_date_iso)} · {formatWeekdayNO(sistOpp.delivery_date_iso)}` |
| `app/(app)/week/bestillingsprofil/page.tsx:231` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(sistOpp.sort_at.slice(0, 10))} kl. {formatTimeNO(sistOpp.sort_at)}` |
| `app/(app)/week/bestillingsprofil/page.tsx:259` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(it.delivery_date_iso)} · {formatWeekdayNO(it.delivery_date_iso)}` |
| `app/(app)/week/EmployeeWeekClient.tsx:8` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";` |
| `app/(app)/week/EmployeeWeekClient.tsx:282` | DD-MM-YYYY i helperen (se avvik) | `return '${weekday} ${formatDateNO(day.date)}'.trim();` |
| `app/(app)/week/EmployeeWeekClient.tsx:424` | Ukjent | `/** Raskere overgang når brukeren ofte bestiller samme ukedag — fortsatt eksplisitt trykk. */` |
| `app/(app)/week/EmployeeWeekClient.tsx:520` | DD-MM-YYYY i helperen (se avvik) | `{weekdayLabel} · {formatDateNO(day.date)}` |
| `app/(app)/week/EmployeeWeekClient.tsx:666` | DD-MM-YYYY i helperen (se avvik) | `aria-label={'${weekdayLabel} ${formatDateNO(day.date)}'}` |
| `app/(app)/week/EmployeeWeekClient.tsx:1637` | DD-MM-YYYY i helperen (se avvik) | `<span className="mt-1 block text-[11px] font-medium text-neutral-500">{formatDateNO(day.date).split(".")[0]}</span>` |
| `app/(app)/week/EmployeeWeekClient.tsx:1680` | DD-MM-YYYY i helperen (se avvik) | `{weekdayLabel} {formatDateNO(day.date)}` |
| `app/(app)/week/min-dag/page.tsx:17` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";` |
| `app/(app)/week/min-dag/page.tsx:62` | DD-MM-YYYY i helperen (se avvik) | `<dd className="font-medium text-neutral-900">{todayIso ? formatDateNO(todayIso) : "—"}</dd>` |
| `app/(app)/week/min-dag/page.tsx:108` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(date)} · {weekdayNb}` |
| `app/(app)/week/mine-lunsjendringer/page.tsx:17` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatTimeNO } from "@/lib/date/format";` |
| `app/(app)/week/mine-lunsjendringer/page.tsx:138` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(it.sort_at.slice(0, 10))} kl. {formatTimeNO(it.sort_at)}` |
| `app/(app)/week/mine-registrerte-dager/page.tsx:17` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";` |
| `app/(app)/week/mine-registrerte-dager/page.tsx:75` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(date)} · {weekdayNb}` |
| `app/(app)/week/mine-registrerte-dager/page.tsx:255` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(it.delivery_date_iso)}` |
| `app/(app)/week/ordre/[date]/page.tsx:17` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatTimeNO, formatWeekdayNO } from "@/lib/date/format";` |
| `app/(app)/week/ordre/[date]/page.tsx:42` | DD-MM-YYYY i helperen (se avvik) | `const title = isIsoDate(d) ? 'Ordre ${formatDateNO(d)} – Lunchportalen' : "Ordre – Lunchportalen";` |
| `app/(app)/week/ordre/[date]/page.tsx:138` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(dateIso)}` |
| `app/(app)/week/ordre/[date]/page.tsx:226` | DD-MM-YYYY i helperen (se avvik) | `Det finnes ingen rad i ordretabellen for deg på {formatDateNO(dateIso)}. Endringer i bestillingsvinduet (ønske` |
| `app/(app)/week/ordre/[date]/page.tsx:241` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(primary.sort_at.slice(0, 10))} kl. {formatTimeNO(primary.sort_at)}` |
| `app/(app)/week/ordre/[date]/page.tsx:266` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(it.sort_at.slice(0, 10))} kl. {formatTimeNO(it.sort_at)}` |
| `app/(app)/week/page.tsx:21` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";` |
| `app/(app)/week/page.tsx:346` | DD-MM-YYYY i helperen (se avvik) | `{weekday} <span className="text-neutral-300">-</span> {formatDateNO(date)}` |
| `app/(app)/week/page.tsx:375` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(block.dates[0] ?? "")} - {formatDateNO(block.dates[block.dates.length - 1] ?? "")}` |
| `app/(app)/week/tidligere-lunsjdager/page.tsx:17` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatTimeNO, formatWeekdayNO } from "@/lib/date/format";` |
| `app/(app)/week/tidligere-lunsjdager/page.tsx:92` | DD-MM-YYYY i helperen (se avvik) | `Dine tidligere dager med ordrelinje i den operative ordretabellen (leveringsdato før {formatDateNO(todayIso)}). Samme` |
| `app/(app)/week/tidligere-lunsjdager/page.tsx:143` | DD-MM-YYYY i helperen (se avvik) | `Uke fra {formatDateNO(g.weekStartIso)} · {formatWeekdayNO(g.weekStartIso)}` |
| `app/(app)/week/tidligere-lunsjdager/page.tsx:153` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(it.delivery_date_iso)}` |
| `app/(app)/week/tidligere-lunsjdager/page.tsx:166` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(it.sort_at.slice(0, 10))} kl. {formatTimeNO(it.sort_at)}` |
| `app/(backoffice)/backoffice/ai/overview/page.tsx:467` | locale string | `Siste syklus {new Date(posSnapshot.lastRunAt).toLocaleString("nb-NO")}` |
| `app/(backoffice)/backoffice/ai/overview/page.tsx:627` | locale string | `{e.at ? new Date(e.at).toLocaleString("nb-NO") : "–"}` |
| `app/(backoffice)/backoffice/ai/overview/page.tsx:807` | locale string | `{created ? new Date(created).toLocaleString("nb-NO") : "–"}` |
| `app/(backoffice)/backoffice/ai/overview/page.tsx:840` | locale string | `UTC: {new Date(data.period_bounds_utc.start).toLocaleString("nb-NO")} –{" "}` |
| `app/(backoffice)/backoffice/ai/overview/page.tsx:841` | locale string | `{new Date(data.period_bounds_utc.end).toLocaleString("nb-NO")}` |
| `app/(backoffice)/backoffice/ai/page.tsx:158` | locale string | `const formatDate = (s: string / null) => (s ? new Date(s).toLocaleString("nb-NO") : "–");` |
| `app/(backoffice)/backoffice/ai/page.tsx:249` | Ukjent | `<td className="py-1.5 pr-2 text-slate-600">{formatDate(j.next_run_at)}</td>` |
| `app/(backoffice)/backoffice/ai/page.tsx:305` | Ukjent | `<td className="py-1.5 pr-2 text-slate-600">{formatDate(h.createdAt)}</td>` |
| `app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx:673` | locale string | `{new Date(d.timestamp).toLocaleString("nb-NO")} —{" "}` |
| `app/(backoffice)/backoffice/content/_components/ContentCroPanel.tsx:68` | locale string | `Sist kjørt: {new Date(croRecommendationsState.lastRunAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}` |
| `app/(backoffice)/backoffice/content/_components/ContentInfoPanel.tsx:22` | Ukjent | `formatDate: (value: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentInfoPanel.tsx:33` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentInfoPanel.tsx:142` | Ukjent | `<dd className="text-sm text-[rgb(var(--lp-text))]">{formatDate(page?.created_at)}</dd>` |
| `app/(backoffice)/backoffice/content/_components/ContentInfoPanel.tsx:146` | Ukjent | `<dd className="text-sm text-[rgb(var(--lp-text))]">{formatDate(page?.updated_at)}</dd>` |
| `app/(backoffice)/backoffice/content/_components/ContentInfoPanel.tsx:150` | Ukjent | `<dd className="text-sm text-[rgb(var(--lp-text))]">{formatDate(page?.published_at)}</dd>` |
| `app/(backoffice)/backoffice/content/_components/ContentRecoveryPanel.tsx:8` | Ukjent | `formatDate: (value: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentRecoveryPanel.tsx:21` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentRecoveryPanel.tsx:66` | Ukjent | `? 'Sist forsøkt: ${formatDate(outboxData.savedAtLocal)}'` |
| `app/(backoffice)/backoffice/content/_components/ContentRecoveryPanel.tsx:69` | Ukjent | `? ' · Sist sett på server: ${formatDate(outboxData.updatedAtSeen)}'` |
| `app/(backoffice)/backoffice/content/_components/ContentRecoveryPanel.tsx:118` | Ukjent | `<span>{formatDate(outboxData.savedAtLocal)}</span>` |
| `app/(backoffice)/backoffice/content/_components/ContentRecoveryPanel.tsx:120` | Ukjent | `<span>{outboxData.updatedAtSeen ? formatDate(outboxData.updatedAtSeen) : "—"}</span>` |
| `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx:24` | Ukjent | `formatDate?: (value: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx:35` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx:38` | Ukjent | `const showSavedFeedback = !saving && !saveError && lastSavedAt != null && formatDate;` |
| `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx:39` | Ukjent | `const savedLabel = showSavedFeedback ? formatDate(lastSavedAt) : null;` |
| `app/(backoffice)/backoffice/content/_components/ContentSeoPanel.tsx:135` | locale string | `Sist analysert: {new Date(seoRecommendationsState.lastScoredAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}` |
| `app/(backoffice)/backoffice/content/_components/ContentSeoPanel.tsx:222` | locale string | `Sist sjekket: {new Date(diagnosticsLastRun).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}. Kjør sidediagnostikk i AI-fanen for å oppdatere.` |
| `app/(backoffice)/backoffice/content/_components/ContentSidePanel.tsx:36` | Ukjent | `formatDate: (value: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentSidePanel.tsx:59` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentSidePanel.tsx:131` | Ukjent | `<dd>{formatDate(page?.created_at)}</dd>` |
| `app/(backoffice)/backoffice/content/_components/ContentSidePanel.tsx:135` | Ukjent | `<dd>{formatDate(page?.updated_at)}</dd>` |
| `app/(backoffice)/backoffice/content/_components/ContentSidePanel.tsx:139` | Ukjent | `<dd>{formatDate(page?.published_at)}</dd>` |
| `app/(backoffice)/backoffice/content/_components/ContentSidePanel.tsx:169` | Ukjent | `formatDate={formatDate}` |
| `app/(backoffice)/backoffice/content/_components/ContentTopbar.tsx:29` | Ukjent | `formatDate?: (value: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentTopbar.tsx:52` | Ukjent | `formatDate: _formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentTopStatusPanel.tsx:13` | Ukjent | `formatDate: (value: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentTopStatusPanel.tsx:38` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentTopStatusPanel.tsx:117` | Ukjent | `<span>Oppdatert {formatDate(page.updated_at)}</span>` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspace.helpers.ts:7` | Ukjent | `import { formatDateTimeNO } from "@/lib/date/format";` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspace.helpers.ts:55` | Ukjent | `export function formatDate(v: string / null / undefined): string {` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspace.helpers.ts:58` | Ukjent | `return formatDateTimeNO(raw) // raw;` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx:73` | Ukjent | `formatDate={ec.formatDate}` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx:40` | locale string | `return date.toLocaleString("nb-NO", {` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeProps.ts:61` | Ukjent | `formatDate: (v: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeProps.ts:190` | Ukjent | `formatDate: i.formatDate,` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts:79` | Ukjent | `/ "formatDate"` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts:255` | Ukjent | `formatDate: (v: string / null / undefined) => string,` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts:285` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellViewModel.ts:15` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellViewModel.ts:134` | Ukjent | `formatDateFn: formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorChrome.types.ts:45` | Ukjent | `formatDate: (v: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorModeStrip.tsx:19` | Ukjent | `formatDate: (v: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorModeStrip.tsx:38` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorModeStrip.tsx:165` | Ukjent | `<span className="tabular-nums">Oppdatert {formatDate(pageUpdatedAt)}</span>` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHeaderChrome.tsx:46` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHeaderChrome.tsx:98` | Ukjent | `formatDate={formatDate}` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHeaderChrome.tsx:110` | Ukjent | `formatDate={formatDate}` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceOutboxRecoveryBanner.tsx:16` | Ukjent | `formatDate: (v: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceOutboxRecoveryBanner.tsx:30` | Ukjent | `formatDate,` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceOutboxRecoveryBanner.tsx:62` | Ukjent | `? 'Sist forsøkt: ${formatDate(outboxData.savedAtLocal)}'` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceOutboxRecoveryBanner.tsx:64` | Ukjent | `{outboxData.updatedAtSeen ? ' · Sist sett på server: ${formatDate(outboxData.updatedAtSeen)}' : ""}` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceOutboxRecoveryBanner.tsx:111` | Ukjent | `<span>{formatDate(outboxData.savedAtLocal)}</span>` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceOutboxRecoveryBanner.tsx:113` | Ukjent | `<span>{outboxData.updatedAtSeen ? formatDate(outboxData.updatedAtSeen) : "—"}</span>` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspacePresentationSelectors.ts:6` | Ukjent | `import { formatDateTimeNO } from "./_stubs";` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspacePresentationSelectors.ts:24` | Ukjent | `export function formatDate(v: string / null / undefined): string {` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspacePresentationSelectors.ts:27` | Ukjent | `return formatDateTimeNO(raw) // raw;` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspacePresentationSelectors.ts:37` | Ukjent | `formatDateFn: (v: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspacePresentationSelectors.ts:45` | Ukjent | `const { saveState, dirty, isOffline, lastSavedAt, lastError, formatDateFn } = params;` |
| `app/(backoffice)/backoffice/content/_components/contentWorkspacePresentationSelectors.ts:80` | Ukjent | `detail: lastSavedAt ? 'Sist lagret ${formatDateFn(lastSavedAt)}' : undefined,` |
| `app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx:144` | locale string | `const t = new Date(lastRunAt).toLocaleString("nb-NO");` |
| `app/(backoffice)/backoffice/content/_components/EditorAutonomyPanel.tsx:44` | locale string | `return n >= 1000 ? n.toLocaleString("nb-NO") : String(n);` |
| `app/(backoffice)/backoffice/content/_components/EditorGtmDashboardPanel.tsx:160` | locale string | `<div className="text-lg font-semibold">{metrics.revenueNok.toLocaleString("nb-NO")}</div>` |
| `app/(backoffice)/backoffice/content/_components/OutboundPanel.tsx:23` | Ukjent | `import { formatDateTimeNO } from "@/lib/date/format";` |
| `app/(backoffice)/backoffice/content/_components/OutboundPanel.tsx:414` | Ukjent | `Planlagt {formatDateTimeNO(typeof p.time === "number" ? new Date(p.time).toISOString() : String(p.time))}:{" "}` |
| `app/(backoffice)/backoffice/content/_components/SocialContentCalendar.tsx:419` | locale string | `{new Date(p.scheduledAt).toLocaleString("nb-NO", {` |
| `app/(backoffice)/backoffice/content/_components/useContentSaveStatus.ts:13` | Ukjent | `formatDateFn: (v: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/useContentSaveStatus.ts:24` | Ukjent | `formatDateFn,` |
| `app/(backoffice)/backoffice/content/_components/useContentSaveStatus.ts:81` | Ukjent | `detail: lastSavedAt ? 'Sist lagret ${formatDateFn(lastSavedAt)}' : undefined,` |
| `app/(backoffice)/backoffice/content/_components/useContentSaveStatus.ts:98` | Ukjent | `formatDateFn: (v: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/useContentSaveStatus.ts:125` | Ukjent | `formatDateFn,` |
| `app/(backoffice)/backoffice/content/_components/useContentSaveStatus.ts:198` | Ukjent | `formatDateFn,` |
| `app/(backoffice)/backoffice/content/_components/useContentSaveStatus.ts:209` | Ukjent | `formatDateFn,` |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceInspectorPanels.tsx:17` | Ukjent | `import { formatDate, safeObj, safeStr } from "./contentWorkspace.helpers";` |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceInspectorPanels.tsx:1009` | Ukjent | `<dd className="text-[rgb(var(--lp-text))]">{formatDate(page?.updated_at)}</dd>` |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts:98` | Ukjent | `import { formatDate, normalizeSlug, safeStr } from "./contentWorkspacePresentationSelectors";` |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts:2314` | Ukjent | `editor: [statusLabel, statusLine, supportSnapshot, supportCopyFeedback, canPublish, canUnpublish, selectedId, publishDisabledTitle, unpublishDisabledTitle, copySupportSnapshot, per` |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceWorkflow.ts:22` | Ukjent | `formatDateFn: (v: string / null / undefined) => string;` |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceWorkflow.ts:62` | Ukjent | `formatDateFn,` |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceWorkflow.ts:92` | Ukjent | `formatDateFn,` |
| `app/(backoffice)/backoffice/content/_components/_stubs.ts:23` | Ukjent | `export { formatDateTimeNO } from "@/lib/date/format";` |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx:22` | Ukjent | `import { fetchContentTreeEnvelope } from "./fetchContentTree";` |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx:185` | Ukjent | `const applyTreeEnvelope = useCallback((env: TreeFetchEnvelope) => {` |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx:215` | Ukjent | `const result = await fetchContentTreeEnvelope();` |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx:228` | Ukjent | `applyTreeEnvelope(result.envelope);` |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx:235` | Ukjent | `}, [applyTreeEnvelope, clearTreeFailureState]);` |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx:637` | Ukjent | `const result = await fetchContentTreeEnvelope();` |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx:645` | Ukjent | `applyTreeEnvelope(result.envelope);` |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx:670` | Ukjent | `}, [applyTreeEnvelope, closeCreateDialog, createDialog, onSelectNode, router]);` |
| `app/(backoffice)/backoffice/content/_tree/fetchContentTree.ts:10` | Ukjent | `export async function fetchContentTreeEnvelope(): Promise<FetchContentTreeResult> {` |
| `app/(backoffice)/backoffice/content/_workspace/ContentRootAutoEnter.tsx:5` | Ukjent | `import { fetchContentTreeEnvelope } from "../_tree/fetchContentTree";` |
| `app/(backoffice)/backoffice/content/_workspace/ContentRootAutoEnter.tsx:34` | Ukjent | `const tree = await fetchContentTreeEnvelope();` |
| `app/(backoffice)/backoffice/experiments/page.tsx:6` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO } from "@/lib/date/format";` |
| `app/(backoffice)/backoffice/experiments/page.tsx:178` | DD-MM-YYYY i helperen (se avvik) | `{formatDateNO(row.created_at.slice(0, 10))}` |
| `app/(backoffice)/backoffice/experiments/[id]/page.tsx:192` | locale string | `{new Date(detail.created_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}` |
| `app/(backoffice)/backoffice/experiments/[id]/page.tsx:200` | locale string | `{new Date(detail.updated_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}` |
| `app/(backoffice)/backoffice/experiments/[id]/page.tsx:208` | locale string | `{new Date(detail.started_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}` |
| `app/(backoffice)/backoffice/experiments/[id]/page.tsx:216` | locale string | `{new Date(detail.completed_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}` |
| `app/(backoffice)/backoffice/forms/page.tsx:83` | Ukjent | `const formatDate = (s: string / null / undefined) =>` |
| `app/(backoffice)/backoffice/forms/page.tsx:84` | locale string | `s ? new Date(s).toLocaleString("nb-NO") : "—";` |
| `app/(backoffice)/backoffice/forms/page.tsx:192` | Ukjent | `{formatDate(f.updated_at)}` |
| `app/(backoffice)/backoffice/forms/[id]/page.tsx:220` | Ukjent | `const formatDateTime = (s: string) =>` |
| `app/(backoffice)/backoffice/forms/[id]/page.tsx:221` | locale string | `new Date(s).toLocaleString("nb-NO");` |
| `app/(backoffice)/backoffice/forms/[id]/page.tsx:532` | Ukjent | `{formatDateTime(s.created_at)}` |
| `app/(backoffice)/backoffice/intelligence/page.tsx:109` | locale string | `<p className="mt-1 text-xs text-slate-500">Oppdatert {new Date(data.generatedAt).toLocaleString("nb-NO")}</p>` |
| `app/(backoffice)/backoffice/intelligence/page.tsx:213` | locale string | `<td className="p-2 whitespace-nowrap">{new Date(e.timestamp).toLocaleString("nb-NO")}</td>` |
| `app/(backoffice)/backoffice/media/page.tsx:842` | locale string | `{new Date(item.created_at).toLocaleString("nb-NO")}` |
| `app/(backoffice)/backoffice/releases/page.tsx:201` | locale string | `const formatDate = (s: string / null) => (s ? new Date(s).toLocaleString("nb-NO") : "—");` |
| `app/(backoffice)/backoffice/releases/page.tsx:263` | Ukjent | `{r.publish_at && <span className="ml-2 text-xs text-slate-400"> — {formatDate(r.publish_at)}</span>}` |
| `app/(backoffice)/backoffice/releases/page.tsx:281` | Ukjent | `<p className="text-xs text-slate-500">{detail.release.publish_at ? 'Publiseres: ${formatDate(detail.release.publish_at)}' : "Ikke planlagt"}</p>` |
| `app/(backoffice)/backoffice/settings/system/page.tsx:410` | locale string | `Sist oppdatert {new Date(settings.updated_at).toLocaleString("nb-NO")}` |
| `app/admin/agreement/page.tsx:15` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO, formatDateTimeNO } from "@/lib/date/format";` |
| `app/admin/agreement/page.tsx:36` | Ukjent | `function formatDate(value: string / null) {` |
| `app/admin/agreement/page.tsx:38` | DD-MM-YYYY i helperen (se avvik) | `return formatDateNO(value);` |
| `app/admin/agreement/page.tsx:43` | Ukjent | `return formatDateTimeNO(value);` |
| `app/admin/agreement/page.tsx:163` | Ukjent | `const endDateLabel = data.binding.endDate ? formatDate(data.binding.endDate) : "Løpende";` |
| `app/admin/agreement/page.tsx:203` | Ukjent | `<div className="mt-2 text-sm text-[rgb(var(--lp-text))]">Start: {formatDate(data.binding.startDate)}</div>` |
| `app/admin/audit/AuditClient.tsx:5` | Ukjent | `import { formatDateTimeSecondsNO } from "@/lib/date/format";` |
| `app/admin/audit/AuditClient.tsx:40` | Ukjent | `return formatDateTimeSecondsNO(ts);` |
| `app/admin/dagens-brukere/page.tsx:13` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO } from "@/lib/date/format";` |
| `app/admin/dagens-brukere/page.tsx:91` | DD-MM-YYYY i helperen (se avvik) | `subtitle={'Kun lesing for ${formatDateNO(roster.date_iso)} — eget firma. Samme ordrelesing som kjøkken (ACTIVE + dagvalg).'}` |
| `app/admin/dagens-levering/page.tsx:13` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO } from "@/lib/date/format";` |
| `app/admin/dagens-levering/page.tsx:93` | DD-MM-YYYY i helperen (se avvik) | `subtitle={'Kun lesing for ${formatDateNO(roster.date_iso)} — eget firma. Samme operative ordregrunnlag som kjøkken.'}` |
| `app/admin/dashboard/MyLunchCard.tsx:8` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO } from "@/lib/date/format";` |
| `app/admin/dashboard/MyLunchCard.tsx:98` | DD-MM-YYYY i helperen (se avvik) | `const dateLabel = myOrder?.date ? formatDateNO(myOrder.date) : "I dag";` |
| `app/admin/history/page.tsx:13` | DD-MM-YYYY i helperen (se avvik) | `import { formatDateNO } from "@/lib/date/format";` |
| `app/admin/history/page.tsx:227` | DD-MM-YYYY i helperen (se avvik) | `<dd className="text-neutral-900">{formatDateNO(it.operative_date_iso)}</dd>` |
| `app/admin/insights/AdminInsightsClient.tsx:235` | Ukjent | `<div className="text-xs font-semibold text-neutral-700">Etterspørsel per ukedag (snitt)</div>` |
| `app/admin/kjokken/kitchenClient.tsx:10` | ISO internt | `// iso er YYYY-MM-DD. Bruk "T00:00:00" og returner ny ISO-dato (YYYY-MM-DD).` |
| `app/admin/kjokken/kitchenClient.tsx:18` | Intl-basert; se options | `const parts = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO_TZ }).formatToParts(new Date());` |

### 12.2 Datoformat-avvik som må fikses
| Fil:linje | Nåværende format | Forventet format |
|---|---|---|
| `lib/date/format.ts:37` | `formatDateNO` returnerer `DD-MM-YYYY` med bindestrek | `dd.MM.yyyy` |
| `lib/date/format.ts:49` | `formatDateTimeNO` returnerer `DD-MM-YYYY HH:mm` | dato-del `dd.MM.yyyy` |
| `lib/date/format.ts:92` | `formatDateTimeSecondsNO` returnerer `DD-MM-YYYY HH:mm:ss` | dato-del `dd.MM.yyyy` |
| `app/menus/week/page.tsx:115` | viser ukedag + kort dato `dd. mmm` og separat `DD-MM-YYYY` | meny/uke: tre-bokstavs ukedag + `dd.MM.yyyy` |
| `app/(app)/week/page.tsx:345` | viser full ukedag + `formatDateNO` | meny/uke: tre-bokstavs ukedag + `dd.MM.yyyy` |
| `studio/src/tools/WeekPlanner.tsx:478` | viser bare `dd.MM.yyyy` uten ukedag | meny/uke: tre-bokstavs ukedag + `dd.MM.yyyy` |

## 13. CSS-filer og styling-system

Umbraco `wwwroot` CSS-filer funnet og klasser:

- `umbraco17/lunchportalen/wwwroot/css/benefits.css`: `.lp-benefits-card`, `.lp-benefits-card--dark`, `.lp-benefits-card__icon`, `.lp-benefits-card__tag`, `.lp-benefits-card__text`, `.lp-benefits-card__title`, `.lp-benefits-cards`, `.lp-benefits-compare`, `.lp-benefits-compare__after`, `.lp-benefits-compare__before`, `.lp-benefits-compare__card`, `.lp-benefits-compare__label`, `.lp-benefits-cta`, `.lp-benefits-cta__actions`, `.lp-benefits-cta__btn`, `.lp-benefits-cta__btn--primary`, `.lp-benefits-cta__btn--secondary`, `.lp-benefits-cta__eyebrow`, `.lp-benefits-cta__heading`, `.lp-benefits-cta__inner`, `.lp-benefits-cta__text`, `.lp-benefits-cta__trust`, `.lp-benefits-grid`, `.lp-benefits-list`, `.lp-benefits-page`, `.lp-benefits-point`, `.lp-benefits-point__dot`, `.lp-benefits-point__text`, `.lp-benefits-point__title`, `.lp-benefits-points`, `.lp-benefits-section`, `.lp-benefits-section--delivery`, `.lp-benefits-section--economy`, `.lp-benefits-section--employees`, `.lp-benefits-section--kitchen`, `.lp-benefits-section--leadership`, `.lp-benefits-section__content`, `.lp-benefits-section__eyebrow`, `.lp-benefits-section__heading`, `.lp-benefits-section__inner`, `.lp-benefits-section__media`, `.lp-benefits-section__text`, `.lp-benefits-stat`, `.lp-benefits-stat__label`, `.lp-benefits-stat__number`, `.lp-benefits-stats`, `.lp-hero`, `.lp-hero__body`, `.lp-hero__content`, `.lp-hero__heading`, `.lp-hero__lead`, `.lp-hero__subheading`, `.lp-hero__title`, `.lp-page-hero`, `.lp-page-hero__body`, `.lp-page-hero__heading`, `.lp-page-hero__lead`, `.lp-page-hero__subheading`, `.lp-page-hero__text`
- `umbraco17/lunchportalen/wwwroot/css/contact.css`: `.ds-h2`, `.ds-how-body`, `.ds-how-title`, `.lp-benefit-card`, `.lp-benefits-hero`, `.lp-benefits-section`, `.lp-contact-card`, `.lp-contact-form`, `.lp-contact-form-block`, `.lp-contact-form-block__content`, `.lp-contact-form-block__details`, `.lp-contact-form-block__eyebrow`, `.lp-contact-form-block__inner`, `.lp-contact-form__grid`, `.lp-contact-form__message`, `.lp-contact-hero`, `.lp-contact-page`, `.lp-contact-section`, `.lp-cta-band`, `.lp-cta-band__heading`, `.lp-cta-band__text`, `.lp-demo-booking`, `.lp-demo-card`, `.lp-demo-final`, `.lp-demo-lead`, `.lp-demo-preview`, `.lp-demo-step`, `.lp-demo-steps`, `.lp-demo-video`, `.lp-feature`, `.lp-feature__content`, `.lp-feature__heading`, `.lp-feature__inner`, `.lp-feature__text`, `.lp-hero`, `.lp-hero__body`, `.lp-hero__content`, `.lp-hero__heading`, `.lp-hero__lead`, `.lp-hero__subheading`, `.lp-lp-hero__lead`, `.lp-lp-hero__title`, `.lp-page-hero`, `.lp-page-hero__body`, `.lp-page-hero__heading`, `.lp-page-hero__lead`, `.lp-page-hero__subheading`, `.lp-page-hero__text`, `.lp-pricing-card`, `.lp-pricing-hero`, `.lp-pricing-section`, `.lp-value-prop-item__text`, `.lp-value-prop-item__title`, `.lp-value-props__heading`
- `umbraco17/lunchportalen/wwwroot/css/demo-page-blocks.css`: `.ds-btn--primary`, `.ds-btn--secondary`, `.forEach`, `.is-visible`, `.lp-demo-booking`, `.lp-demo-booking-grid`, `.lp-demo-card`, `.lp-demo-card-grid`, `.lp-demo-card__badge`, `.lp-demo-checks`, `.lp-demo-eyebrow`, `.lp-demo-eyebrow--light`, `.lp-demo-fake-line`, `.lp-demo-fake-row`, `.lp-demo-fake-screen`, `.lp-demo-fake-top`, `.lp-demo-final`, `.lp-demo-final-card`, `.lp-demo-final-card__actions`, `.lp-demo-final-card__cta`, `.lp-demo-final-card__sec`, `.lp-demo-final-card__trust`, `.lp-demo-form`, `.lp-demo-form__btn-spinner`, `.lp-demo-form__err`, `.lp-demo-form__status`, `.lp-demo-inner`, `.lp-demo-lead`, `.lp-demo-preview`, `.lp-demo-quote`, `.lp-demo-quote__attribution`, `.lp-demo-quote__avatar`, `.lp-demo-quote__logo`, `.lp-demo-quote__meta`, `.lp-demo-quote__stars`, `.lp-demo-quote__text`, `.lp-demo-step`, `.lp-demo-step__badge`, `.lp-demo-steps`, `.lp-demo-steps-grid`, `.lp-demo-testimonial`, `.lp-demo-video`, `.lp-demo-video-frame`, `.lp-demo-video-grid`, `.lp-demo-video__chip`, `.lp-demo-video__chip-text`, `.lp-demo-video__duration`, `.lp-demo-video__el`, `.lp-demo-video__play-btn`, `.lp-demo-video__play-icon`, `.lp-demo-video__player`, `.lp-hero`, `.lp-hero__btn--primary`, `.lp-hero__btn--secondary`, `.lp-hero__title`, `.lp-hero__visual`, `.lp-page-hero`, `.lp-page-hero__heading`, `.lp-page-hero__media`, `.lp-reveal`, `.lp-reveal-group`
- `umbraco17/lunchportalen/wwwroot/css/design-system.css`: `.ds-block-grid`, `.ds-body`, `.ds-btn`, `.ds-btn--primary`, `.ds-btn--secondary`, `.ds-card`, `.ds-card__text`, `.ds-card__title`, `.ds-cards-3`, `.ds-container`, `.ds-cta--align-center`, `.ds-cta--align-left`, `.ds-cta--align-split`, `.ds-cta--color-blue`, `.ds-cta--color-dark`, `.ds-cta--color-green`, `.ds-cta--color-navy`, `.ds-cta--glass-none`, `.ds-cta--glass-soft`, `.ds-cta--glass-strong`, `.ds-cta--theme-blue`, `.ds-cta--theme-dark`, `.ds-cta--theme-light`, `.ds-cta--transparency-high`, `.ds-cta--transparency-medium`, `.ds-cta--transparency-none`, `.ds-cta--transparency-subtle`, `.ds-cta--width-default`, `.ds-cta--width-full`, `.ds-cta--width-narrow`, `.ds-cta--width-wide`, `.ds-cta-band`, `.ds-cta-band__actions`, `.ds-cta-band__content`, `.ds-eyebrow`, `.ds-fade-up`, `.ds-h2`, `.ds-hero`, `.ds-hero--center`, `.ds-hero--left`, `.ds-hero--lg`, `.ds-hero--md`, `.ds-hero--overlay-medium`, `.ds-hero--right`, `.ds-hero--text-center`, `.ds-hero--text-left`, `.ds-hero--text-right`, `.ds-hero--xl`, `.ds-hero__actions`, `.ds-hero__bg`, `.ds-hero__bg--fallback`, `.ds-hero__content`, `.ds-hero__eyebrow-wrap`, `.ds-hero__lead`, `.ds-hero__overlay`, `.ds-hero__title`, `.ds-hero__trust`, `.ds-hero__trust-item`, `.ds-how-body`, `.ds-how-button`, `.ds-how-list`, `.ds-how-media`, `.ds-how-row`, `.ds-how-text`, `.ds-how-title`, `.ds-lead`, `.ds-motion-fade`, `.ds-motion-glow`, `.ds-motion-lift`, `.ds-motion-none`, `.ds-page`, `.ds-section`, `.ds-section--cta`, `.ds-section--glass`, `.ds-section--how`, `.ds-section--social-proof`, `.ds-section--surface`, `.ds-social-proof__grid`, `.ds-social-proof__item`, `.ds-social-proof__label`, `.ds-social-proof__value`, `.ds-step__number`, `.ds-surface`, `.ds-text-limit`, `.lp-footer__actions`, `.lp-footer__bottom`, `.lp-footer__brand`, `.lp-footer__col`, `.lp-footer__cta`, `.lp-footer__eyebrow`, `.lp-footer__links`, `.lp-footer__login`, `.lp-footer__text`, `.lp-footer__title`, `.lp-header`
- `umbraco17/lunchportalen/wwwroot/css/footer.css`: `.lp-footer`, `.lp-footer__actions`, `.lp-footer__bottom`, `.lp-footer__brand`, `.lp-footer__col`, `.lp-footer__col--contact`, `.lp-footer__cta`, `.lp-footer__eyebrow`, `.lp-footer__inner`, `.lp-footer__links`, `.lp-footer__login`, `.lp-footer__text`, `.lp-footer__title`, `.lp-footer__top`
- `umbraco17/lunchportalen/wwwroot/css/header.css`: `.ds-hero`, `.ds-hero__content`, `.ds-page`, `.lp-btn--ghost`, `.lp-btn--primary`, `.lp-hamburger`, `.lp-header`, `.lp-header--hidden`, `.lp-header__actions`, `.lp-header__cta`, `.lp-header__inner`, `.lp-header__login`, `.lp-header__logo`, `.lp-header__right`, `.lp-hero`, `.lp-logo`, `.lp-logo-img`, `.lp-mobile-menu`, `.lp-mobile-menu__cta`, `.lp-mobile-menu__link`, `.lp-mobile-menu__login`, `.lp-mobile-menu__nav`, `.lp-nav`, `.lp-nav__link`, `.lp-nav__list`
- `umbraco17/lunchportalen/wwwroot/css/hero.css`: `.ds-btn`, `.lp-container`, `.lp-eyebrow`, `.lp-eyebrow__dot`, `.lp-hero`, `.lp-hero__actions`, `.lp-hero__bg`, `.lp-hero__body`, `.lp-hero__content`, `.lp-hero__heading`, `.lp-hero__inner`, `.lp-hero__overlay`, `.lp-hero__sub`, `.lp-hero__trust`, `.lp-social-proof`, `.lp-social-proof__fact`, `.lp-social-proof__facts`, `.lp-social-proof__inner`, `.lp-trust-pill`
- `umbraco17/lunchportalen/wwwroot/css/kom-i-gang.css`: `.kig-btn`, `.kig-btn--dark`, `.kig-btn--full`, `.kig-btn--outline`, `.kig-btn--yellow`, `.kig-checklist`, `.kig-checklist__icon`, `.kig-checklist__item`, `.kig-container`, `.kig-contract`, `.kig-contract__inner`, `.kig-contract__kicker`, `.kig-contract__term`, `.kig-contract__term--highlighted`, `.kig-contract__term-highlight`, `.kig-contract__term-icon`, `.kig-contract__term-label`, `.kig-contract__term-note`, `.kig-contract__term-value`, `.kig-contract__terms`, `.kig-contract__text`, `.kig-contract__title`, `.kig-eyebrow`, `.kig-form`, `.kig-form-card`, `.kig-form-card__title`, `.kig-form-section`, `.kig-form-section__heading`, `.kig-form-section__heading--em`, `.kig-form-section__inner`, `.kig-form-section__sub`, `.kig-form-success`, `.kig-form-success__icon`, `.kig-form-success__text`, `.kig-form-success__title`, `.kig-form__err`, `.kig-form__field`, `.kig-form__input`, `.kig-form__input--error`, `.kig-form__label`, `.kig-form__note`, `.kig-form__status`, `.kig-hero`, `.kig-hero__actions`, `.kig-hero__heading`, `.kig-hero__heading--outline`, `.kig-hero__heading--solid`, `.kig-hero__heading--yellow`, `.kig-hero__sub`, `.kig-notice-box`, `.kig-notice-box__heading`, `.kig-notice-box__lbl`, `.kig-notice-box__row`, `.kig-notice-box__val`, `.kig-page`, `.kig-section-heading`, `.kig-section-tag`, `.kig-stats`, `.kig-stats__cell`, `.kig-stats__label`, `.kig-stats__value`, `.kig-step-card`, `.kig-step-card__desc`, `.kig-step-card__num`, `.kig-step-card__title`, `.kig-steps`, `.kig-steps__grid`, `.kig-testimonial`, `.kig-testimonial__avatar`, `.kig-testimonial__inner`, `.kig-testimonial__meta-sub`, `.kig-testimonial__meta-title`, `.kig-testimonial__quote`, `.kig-testimonial__source`
- `umbraco17/lunchportalen/wwwroot/css/landing-page-blocks.css`: `.ds-h2`, `.ds-how-body`, `.ds-how-title`, `.lp-benefit-card`, `.lp-benefits-hero`, `.lp-benefits-section`, `.lp-contact-card`, `.lp-contact-hero`, `.lp-contact-section`, `.lp-cta-band`, `.lp-cta-band__heading`, `.lp-cta-band__inner`, `.lp-cta-band__text`, `.lp-demo-booking`, `.lp-demo-card`, `.lp-demo-final`, `.lp-demo-lead`, `.lp-demo-preview`, `.lp-demo-step`, `.lp-demo-steps`, `.lp-demo-video`, `.lp-faq-answer`, `.lp-faq-block`, `.lp-faq-heading`, `.lp-faq-inner`, `.lp-faq-item`, `.lp-faq-question`, `.lp-faq-subheading`, `.lp-feature-block`, `.lp-feature-block--image-left`, `.lp-feature-heading`, `.lp-feature-image`, `.lp-feature-inner`, `.lp-feature-text-body`, `.lp-logo-item`, `.lp-logos-block`, `.lp-logos-grid`, `.lp-logos-heading`, `.lp-logos-inner`, `.lp-lp-app-window`, `.lp-lp-badge`, `.lp-lp-badge--br`, `.lp-lp-badge--tl`, `.lp-lp-badge__lbl`, `.lp-lp-badge__num`, `.lp-lp-btn-arrow`, `.lp-lp-btn-ghost`, `.lp-lp-btn-primary`, `.lp-lp-deadline-lbl`, `.lp-lp-deadline-val`, `.lp-lp-deco-circle`, `.lp-lp-delivery-dot`, `.lp-lp-delivery-txt`, `.lp-lp-hero`, `.lp-lp-hero__cta-row`, `.lp-lp-hero__image`, `.lp-lp-hero__inner`, `.lp-lp-hero__lead`, `.lp-lp-hero__title`, `.lp-lp-hero__title-gold`, `.lp-lp-hero__title-outline`, `.lp-lp-hero__visual`, `.lp-lp-logo-pill`, `.lp-lp-logos`, `.lp-lp-logos__lbl`, `.lp-lp-logos__pills`, `.lp-lp-menu-check`, `.lp-lp-menu-icon`, `.lp-lp-menu-item`, `.lp-lp-menu-item--selected`, `.lp-lp-menu-label`, `.lp-lp-menu-left`, `.lp-lp-menu-name`, `.lp-lp-menu-section`, `.lp-lp-menu-sub`, `.lp-lp-mockup-wrap`, `.lp-lp-play-icon`, `.lp-lp-stat`, `.lp-lp-stat__lbl`, `.lp-lp-stat__val`, `.lp-lp-stats`, `.lp-lp-tag`, `.lp-lp-tag__dot`, `.lp-lp-tag__text`, `.lp-lp-win-bar`, `.lp-lp-win-body`, `.lp-lp-win-cta`, `.lp-lp-win-cta__cancel`, `.lp-lp-win-cta__order`, `.lp-lp-win-date`, `.lp-lp-win-deadline`, `.lp-lp-win-delivery`, `.lp-lp-win-dot`, `.lp-lp-win-head`, `.lp-lp-win-title`, `.lp-lp-win-url`, `.lp-page-hero__heading`, `.lp-page-hero__lead`, `.lp-pricing-badge`, `.lp-pricing-block`, `.lp-pricing-card`, `.lp-pricing-card--highlighted`, `.lp-pricing-grid`, `.lp-pricing-heading`, `.lp-pricing-hero`, `.lp-pricing-inner`, `.lp-pricing-section`, `.lp-pricing-subheading`, `.lp-social-proof`, `.lp-social-proof__avatar`, `.lp-social-proof__fact`, `.lp-social-proof__facts`, `.lp-social-proof__grid`, `.lp-social-proof__inner`, `.lp-social-proof__name`, `.lp-social-proof__person`, `.lp-social-proof__quote`, `.lp-social-proof__quote-card`, `.lp-social-proof__quote-mark`, `.lp-social-proof__role`
- `umbraco17/lunchportalen/wwwroot/css/losningen-page-blocks.css`: `.ls-cta-band`, `.ls-cta-band__actions`, `.ls-cta-band__btn-primary`, `.ls-cta-band__btn-sec`, `.ls-cta-band__card`, `.ls-cta-band__heading`, `.ls-cta-band__text`, `.ls-cta-band__trust`, `.ls-eyebrow`, `.ls-eyebrow--light`, `.ls-faq`, `.ls-faq__a`, `.ls-faq__header`, `.ls-faq__icon`, `.ls-faq__item`, `.ls-faq__list`, `.ls-faq__q`, `.ls-feature`, `.ls-feature--reverse`, `.ls-feature__body`, `.ls-feature__checks`, `.ls-feature__media`, `.ls-feature__tag`, `.ls-feature__title`, `.ls-features`, `.ls-h2`, `.ls-how`, `.ls-inner`, `.ls-lead`, `.ls-logos`, `.ls-logos__item`, `.ls-logos__item--placeholder`, `.ls-logos__label`, `.ls-logos__track`, `.ls-mockup`, `.ls-mockup__avatar`, `.ls-mockup__badge`, `.ls-mockup__badge--gray`, `.ls-mockup__badge--green`, `.ls-mockup__body`, `.ls-mockup__btn-ghost`, `.ls-mockup__btn-primary`, `.ls-mockup__check`, `.ls-mockup__check--empty`, `.ls-mockup__chrome`, `.ls-mockup__count-lbl`, `.ls-mockup__count-num`, `.ls-mockup__cta-row`, `.ls-mockup__date`, `.ls-mockup__deadline`, `.ls-mockup__deadline-val`, `.ls-mockup__dots`, `.ls-mockup__emoji`, `.ls-mockup__item`, `.ls-mockup__item--selected`, `.ls-mockup__item-left`, `.ls-mockup__item-name`, `.ls-mockup__item-sub`, `.ls-mockup__kitchen-count`, `.ls-mockup__kitchen-footer`, `.ls-mockup__kitchen-item`, `.ls-mockup__kitchen-left`, `.ls-mockup__kitchen-name`, `.ls-mockup__kitchen-total`, `.ls-mockup__kitchen-total-num`, `.ls-mockup__label`, `.ls-mockup__row-item`, `.ls-mockup__row-name`, `.ls-mockup__section-label`, `.ls-mockup__stat`, `.ls-mockup__stat-lbl`, `.ls-mockup__stat-num`, `.ls-mockup__stat-num--gold`, `.ls-mockup__stat-row`, `.ls-mockup__svinn-badge`, `.ls-mockup__topbar`, `.ls-mockup__url`, `.ls-reveal`, `.ls-reveal-group`, `.ls-stat-card`, `.ls-stat-card__lbl`, `.ls-stat-card__val`, `.ls-step`, `.ls-step__badge`, `.ls-step__body`, `.ls-step__content`, `.ls-step__left`, `.ls-step__line`, `.ls-step__title`, `.ls-steps`, `.ls-testimonial`, `.ls-testimonial__attribution`, `.ls-testimonial__avatar`, `.ls-testimonial__grid`, `.ls-testimonial__logo`, `.ls-testimonial__name`, `.ls-testimonial__quote`, `.ls-testimonial__role`, `.ls-testimonial__stars`, `.ls-testimonial__stats`, `.ls-testimonial__text`, `.ls-value-card`, `.ls-value-card__body`, `.ls-value-card__icon`, `.ls-value-card__title`, `.ls-value-grid`, `.ls-value-props`
- `umbraco17/lunchportalen/wwwroot/css/om-oss.css`: `.oa-btn-primary`, `.oa-btn-sec`, `.oa-cta-band`, `.oa-cta-band__actions`, `.oa-cta-band__card`, `.oa-cta-band__heading`, `.oa-cta-band__text`, `.oa-cta-band__trust`, `.oa-eyebrow`, `.oa-eyebrow--light`, `.oa-h2`, `.oa-inner`, `.oa-lead`, `.oa-model`, `.oa-model-step`, `.oa-model-step__num`, `.oa-model-step__text`, `.oa-model-step__title`, `.oa-model__result`, `.oa-model__result-icon`, `.oa-model__result-sub`, `.oa-model__result-text`, `.oa-model__steps`, `.oa-pos-card`, `.oa-pos-card__after`, `.oa-pos-card__before`, `.oa-pos-card__label`, `.oa-positioning`, `.oa-positioning__grid`, `.oa-problem-card`, `.oa-problem-card__icon`, `.oa-problem-card__text`, `.oa-problem-card__title`, `.oa-reveal`, `.oa-reveal-group`, `.oa-stat-card`, `.oa-stat-card__label`, `.oa-stat-card__number`, `.oa-sustain-point`, `.oa-sustain-point__dot`, `.oa-sustain-point__text`, `.oa-sustain-point__title`, `.oa-sustainability`, `.oa-sustainability__grid`, `.oa-sustainability__points`, `.oa-sustainability__stats`, `.oa-value-card`, `.oa-value-card--dark`, `.oa-value-card__tag`, `.oa-value-card__title`, `.oa-value-list`, `.oa-values`, `.oa-values__grid`, `.oa-why`, `.oa-why__grid`, `.oa-why__problems`, `.oa-why__statement`, `.oa-why__statement-label`, `.oa-why__statement-sub`, `.oa-why__statement-text`
- `umbraco17/lunchportalen/wwwroot/css/priser-page-blocks.css`: `.lp-block-grid`, `.pr-billing-toggle`, `.pr-billing-toggle__lbl`, `.pr-billing-toggle__save`, `.pr-check`, `.pr-cta-band`, `.pr-cta-band__actions`, `.pr-cta-band__btn-primary`, `.pr-cta-band__btn-sec`, `.pr-cta-band__card`, `.pr-cta-band__heading`, `.pr-cta-band__text`, `.pr-cta-band__trust`, `.pr-dash`, `.pr-eyebrow`, `.pr-eyebrow--light`, `.pr-faq`, `.pr-faq__a`, `.pr-faq__header`, `.pr-faq__icon`, `.pr-faq__item`, `.pr-faq__list`, `.pr-faq__q`, `.pr-feature-table`, `.pr-feature-table__category`, `.pr-feature-table__col--featured`, `.pr-feature-table__col--plan`, `.pr-feature-table__col-label`, `.pr-feature-table__head`, `.pr-feature__cell`, `.pr-feature__cell--featured`, `.pr-feature__label`, `.pr-feature__row`, `.pr-feature__text`, `.pr-feature__text--featured`, `.pr-features`, `.pr-h2`, `.pr-hiw-grid`, `.pr-hiw-step`, `.pr-hiw-step__body`, `.pr-hiw-step__number`, `.pr-hiw-step__title`, `.pr-how-it-works`, `.pr-inner`, `.pr-lead`, `.pr-plan`, `.pr-plan--featured`, `.pr-plan__amount`, `.pr-plan__badge`, `.pr-plan__badge-save`, `.pr-plan__cta`, `.pr-plan__desc`, `.pr-plan__features`, `.pr-plan__header`, `.pr-plan__month-est`, `.pr-plan__name`, `.pr-plan__price`, `.pr-plan__unit`, `.pr-plans`, `.pr-plans__footer`, `.pr-plans__grid`, `.pr-reveal`, `.pr-reveal-group`, `.pr-toggle-thumb`, `.pr-toggle-track`

Etterspurte `wwwroot/css/fordeler.css` ble ikke funnet; `umbraco17/lunchportalen/Views/fordelerPage.cshtml` finnes som view. `umbraco17/lunchportalen/Views/fordelerPage.cshtml:1`

Next/app CSS-filer funnet under `app/styles`:
- `app/styles/ds/benefits.css`: `.lp-benefits-card`, `.lp-benefits-card--dark`, `.lp-benefits-card__icon`, `.lp-benefits-card__tag`, `.lp-benefits-card__text`, `.lp-benefits-card__title`, `.lp-benefits-cards`, `.lp-benefits-compare`, `.lp-benefits-compare__after`, `.lp-benefits-compare__before`, `.lp-benefits-compare__card`, `.lp-benefits-compare__label`, `.lp-benefits-cta`, `.lp-benefits-cta__actions`, `.lp-benefits-cta__btn`, `.lp-benefits-cta__btn--primary`, `.lp-benefits-cta__btn--secondary`, `.lp-benefits-cta__eyebrow`, `.lp-benefits-cta__heading`, `.lp-benefits-cta__inner`, `.lp-benefits-cta__text`, `.lp-benefits-cta__trust`, `.lp-benefits-grid`, `.lp-benefits-list`, `.lp-benefits-page`, `.lp-benefits-point`, `.lp-benefits-point__dot`, `.lp-benefits-point__text`, `.lp-benefits-point__title`, `.lp-benefits-points`, `.lp-benefits-section`, `.lp-benefits-section--delivery`, `.lp-benefits-section--economy`, `.lp-benefits-section--employees`, `.lp-benefits-section--kitchen`, `.lp-benefits-section--leadership`, `.lp-benefits-section__content`, `.lp-benefits-section__eyebrow`, `.lp-benefits-section__heading`, `.lp-benefits-section__inner`, `.lp-benefits-section__media`, `.lp-benefits-section__text`, `.lp-benefits-stat`, `.lp-benefits-stat__label`, `.lp-benefits-stat__number`, `.lp-benefits-stats`, `.lp-hero`, `.lp-hero__body`, `.lp-hero__content`, `.lp-hero__heading`, `.lp-hero__lead`, `.lp-hero__subheading`, `.lp-hero__title`, `.lp-page-hero`, `.lp-page-hero__body`, `.lp-page-hero__heading`, `.lp-page-hero__lead`, `.lp-page-hero__subheading`, `.lp-page-hero__text`
- `app/styles/ds/contact.css`: `.ds-h2`, `.ds-how-body`, `.ds-how-title`, `.lp-benefit-card`, `.lp-benefits-hero`, `.lp-benefits-section`, `.lp-contact-card`, `.lp-contact-form`, `.lp-contact-form-block`, `.lp-contact-form-block__content`, `.lp-contact-form-block__details`, `.lp-contact-form-block__eyebrow`, `.lp-contact-form-block__inner`, `.lp-contact-form__grid`, `.lp-contact-form__message`, `.lp-contact-hero`, `.lp-contact-page`, `.lp-contact-section`, `.lp-cta-band`, `.lp-cta-band__heading`, `.lp-cta-band__text`, `.lp-demo-booking`, `.lp-demo-card`, `.lp-demo-final`, `.lp-demo-lead`, `.lp-demo-preview`, `.lp-demo-step`, `.lp-demo-steps`, `.lp-demo-video`, `.lp-feature`, `.lp-feature__content`, `.lp-feature__heading`, `.lp-feature__inner`, `.lp-feature__text`, `.lp-hero`, `.lp-hero__body`, `.lp-hero__content`, `.lp-hero__heading`, `.lp-hero__lead`, `.lp-hero__subheading`, `.lp-lp-hero__lead`, `.lp-lp-hero__title`, `.lp-page-hero`, `.lp-page-hero__body`, `.lp-page-hero__heading`, `.lp-page-hero__lead`, `.lp-page-hero__subheading`, `.lp-page-hero__text`, `.lp-pricing-card`, `.lp-pricing-hero`, `.lp-pricing-section`, `.lp-value-prop-item__text`, `.lp-value-prop-item__title`, `.lp-value-props__heading`
- `app/styles/ds/demo-page-blocks.css`: `.ds-btn--primary`, `.ds-btn--secondary`, `.forEach`, `.is-visible`, `.lp-demo-booking`, `.lp-demo-booking-grid`, `.lp-demo-card`, `.lp-demo-card-grid`, `.lp-demo-card__badge`, `.lp-demo-checks`, `.lp-demo-eyebrow`, `.lp-demo-eyebrow--light`, `.lp-demo-fake-line`, `.lp-demo-fake-row`, `.lp-demo-fake-screen`, `.lp-demo-fake-top`, `.lp-demo-final`, `.lp-demo-final-card`, `.lp-demo-final-card__actions`, `.lp-demo-final-card__cta`, `.lp-demo-final-card__sec`, `.lp-demo-final-card__trust`, `.lp-demo-form`, `.lp-demo-form__btn-spinner`, `.lp-demo-form__err`, `.lp-demo-form__status`, `.lp-demo-inner`, `.lp-demo-lead`, `.lp-demo-preview`, `.lp-demo-quote`, `.lp-demo-quote__attribution`, `.lp-demo-quote__avatar`, `.lp-demo-quote__logo`, `.lp-demo-quote__meta`, `.lp-demo-quote__stars`, `.lp-demo-quote__text`, `.lp-demo-step`, `.lp-demo-step__badge`, `.lp-demo-steps`, `.lp-demo-steps-grid`, `.lp-demo-testimonial`, `.lp-demo-video`, `.lp-demo-video-frame`, `.lp-demo-video-grid`, `.lp-demo-video__chip`, `.lp-demo-video__chip-text`, `.lp-demo-video__duration`, `.lp-demo-video__el`, `.lp-demo-video__play-btn`, `.lp-demo-video__play-icon`, `.lp-demo-video__player`, `.lp-hero`, `.lp-hero__btn--primary`, `.lp-hero__btn--secondary`, `.lp-hero__title`, `.lp-hero__visual`, `.lp-page-hero`, `.lp-page-hero__heading`, `.lp-page-hero__media`, `.lp-reveal`, `.lp-reveal-group`
- `app/styles/ds/design-system.css`: `.ds-block-grid`, `.ds-body`, `.ds-btn`, `.ds-btn--primary`, `.ds-btn--secondary`, `.ds-card`, `.ds-card__text`, `.ds-card__title`, `.ds-cards-3`, `.ds-container`, `.ds-cta--align-center`, `.ds-cta--align-left`, `.ds-cta--align-split`, `.ds-cta--color-blue`, `.ds-cta--color-dark`, `.ds-cta--color-green`, `.ds-cta--color-navy`, `.ds-cta--glass-none`, `.ds-cta--glass-soft`, `.ds-cta--glass-strong`, `.ds-cta--theme-blue`, `.ds-cta--theme-dark`, `.ds-cta--theme-light`, `.ds-cta--transparency-high`, `.ds-cta--transparency-medium`, `.ds-cta--transparency-none`, `.ds-cta--transparency-subtle`, `.ds-cta--width-default`, `.ds-cta--width-full`, `.ds-cta--width-narrow`, `.ds-cta--width-wide`, `.ds-cta-band`, `.ds-cta-band__actions`, `.ds-cta-band__content`, `.ds-eyebrow`, `.ds-fade-up`, `.ds-h2`, `.ds-hero`, `.ds-hero--center`, `.ds-hero--left`, `.ds-hero--lg`, `.ds-hero--md`, `.ds-hero--overlay-medium`, `.ds-hero--right`, `.ds-hero--text-center`, `.ds-hero--text-left`, `.ds-hero--text-right`, `.ds-hero--xl`, `.ds-hero__actions`, `.ds-hero__bg`, `.ds-hero__bg--fallback`, `.ds-hero__content`, `.ds-hero__eyebrow-wrap`, `.ds-hero__lead`, `.ds-hero__overlay`, `.ds-hero__title`, `.ds-hero__trust`, `.ds-hero__trust-item`, `.ds-how-body`, `.ds-how-button`, `.ds-how-list`, `.ds-how-media`, `.ds-how-row`, `.ds-how-text`, `.ds-how-title`, `.ds-lead`, `.ds-motion-fade`, `.ds-motion-glow`, `.ds-motion-lift`, `.ds-motion-none`, `.ds-page`, `.ds-section`, `.ds-section--cta`, `.ds-section--glass`, `.ds-section--how`, `.ds-section--social-proof`, `.ds-section--surface`, `.ds-social-proof__grid`, `.ds-social-proof__item`, `.ds-social-proof__label`, `.ds-social-proof__value`, `.ds-step__number`, `.ds-surface`, `.ds-text-limit`, `.lp-footer__actions`, `.lp-footer__bottom`, `.lp-footer__brand`, `.lp-footer__col`, `.lp-footer__cta`, `.lp-footer__eyebrow`, `.lp-footer__links`, `.lp-footer__login`, `.lp-footer__text`, `.lp-footer__title`, `.lp-header`
- `app/styles/ds/footer.css`: `.lp-footer`, `.lp-footer__actions`, `.lp-footer__bottom`, `.lp-footer__brand`, `.lp-footer__col`, `.lp-footer__col--contact`, `.lp-footer__cta`, `.lp-footer__eyebrow`, `.lp-footer__inner`, `.lp-footer__links`, `.lp-footer__login`, `.lp-footer__text`, `.lp-footer__title`, `.lp-footer__top`
- `app/styles/ds/header.css`: `.ds-hero`, `.ds-hero__content`, `.ds-page`, `.lp-btn--ghost`, `.lp-btn--primary`, `.lp-hamburger`, `.lp-header`, `.lp-header--hidden`, `.lp-header__actions`, `.lp-header__cta`, `.lp-header__inner`, `.lp-header__login`, `.lp-header__logo`, `.lp-header__right`, `.lp-hero`, `.lp-logo`, `.lp-logo-img`, `.lp-mobile-menu`, `.lp-mobile-menu__cta`, `.lp-mobile-menu__link`, `.lp-mobile-menu__login`, `.lp-mobile-menu__nav`, `.lp-nav`, `.lp-nav__link`, `.lp-nav__list`
- `app/styles/ds/hero.css`: `.ds-btn`, `.lp-container`, `.lp-eyebrow`, `.lp-eyebrow__dot`, `.lp-hero`, `.lp-hero__actions`, `.lp-hero__bg`, `.lp-hero__body`, `.lp-hero__content`, `.lp-hero__heading`, `.lp-hero__inner`, `.lp-hero__overlay`, `.lp-hero__sub`, `.lp-hero__trust`, `.lp-social-proof`, `.lp-social-proof__fact`, `.lp-social-proof__facts`, `.lp-social-proof__inner`, `.lp-trust-pill`
- `app/styles/ds/kom-i-gang.css`: `.kig-btn`, `.kig-btn--dark`, `.kig-btn--full`, `.kig-btn--outline`, `.kig-btn--yellow`, `.kig-checklist`, `.kig-checklist__icon`, `.kig-checklist__item`, `.kig-container`, `.kig-contract`, `.kig-contract__inner`, `.kig-contract__kicker`, `.kig-contract__term`, `.kig-contract__term--highlighted`, `.kig-contract__term-highlight`, `.kig-contract__term-icon`, `.kig-contract__term-label`, `.kig-contract__term-note`, `.kig-contract__term-value`, `.kig-contract__terms`, `.kig-contract__text`, `.kig-contract__title`, `.kig-eyebrow`, `.kig-form`, `.kig-form-card`, `.kig-form-card__title`, `.kig-form-section`, `.kig-form-section__heading`, `.kig-form-section__heading--em`, `.kig-form-section__inner`, `.kig-form-section__sub`, `.kig-form-success`, `.kig-form-success__icon`, `.kig-form-success__text`, `.kig-form-success__title`, `.kig-form__err`, `.kig-form__field`, `.kig-form__input`, `.kig-form__input--error`, `.kig-form__label`, `.kig-form__note`, `.kig-form__status`, `.kig-hero`, `.kig-hero__actions`, `.kig-hero__heading`, `.kig-hero__heading--outline`, `.kig-hero__heading--solid`, `.kig-hero__heading--yellow`, `.kig-hero__sub`, `.kig-notice-box`, `.kig-notice-box__heading`, `.kig-notice-box__lbl`, `.kig-notice-box__row`, `.kig-notice-box__val`, `.kig-page`, `.kig-section-heading`, `.kig-section-tag`, `.kig-stats`, `.kig-stats__cell`, `.kig-stats__label`, `.kig-stats__value`, `.kig-step-card`, `.kig-step-card__desc`, `.kig-step-card__num`, `.kig-step-card__title`, `.kig-steps`, `.kig-steps__grid`, `.kig-testimonial`, `.kig-testimonial__avatar`, `.kig-testimonial__inner`, `.kig-testimonial__meta-sub`, `.kig-testimonial__meta-title`, `.kig-testimonial__quote`, `.kig-testimonial__source`
- `app/styles/ds/landing-page-blocks.css`: `.ds-h2`, `.ds-how-body`, `.ds-how-title`, `.lp-benefit-card`, `.lp-benefits-hero`, `.lp-benefits-section`, `.lp-contact-card`, `.lp-contact-hero`, `.lp-contact-section`, `.lp-cta-band`, `.lp-cta-band__heading`, `.lp-cta-band__inner`, `.lp-cta-band__text`, `.lp-demo-booking`, `.lp-demo-card`, `.lp-demo-final`, `.lp-demo-lead`, `.lp-demo-preview`, `.lp-demo-step`, `.lp-demo-steps`, `.lp-demo-video`, `.lp-faq-answer`, `.lp-faq-block`, `.lp-faq-heading`, `.lp-faq-inner`, `.lp-faq-item`, `.lp-faq-question`, `.lp-faq-subheading`, `.lp-feature-block`, `.lp-feature-block--image-left`, `.lp-feature-heading`, `.lp-feature-image`, `.lp-feature-inner`, `.lp-feature-text-body`, `.lp-logo-item`, `.lp-logos-block`, `.lp-logos-grid`, `.lp-logos-heading`, `.lp-logos-inner`, `.lp-lp-app-window`, `.lp-lp-badge`, `.lp-lp-badge--br`, `.lp-lp-badge--tl`, `.lp-lp-badge__lbl`, `.lp-lp-badge__num`, `.lp-lp-btn-arrow`, `.lp-lp-btn-ghost`, `.lp-lp-btn-primary`, `.lp-lp-deadline-lbl`, `.lp-lp-deadline-val`, `.lp-lp-deco-circle`, `.lp-lp-delivery-dot`, `.lp-lp-delivery-txt`, `.lp-lp-hero`, `.lp-lp-hero__cta-row`, `.lp-lp-hero__image`, `.lp-lp-hero__inner`, `.lp-lp-hero__lead`, `.lp-lp-hero__title`, `.lp-lp-hero__title-gold`, `.lp-lp-hero__title-outline`, `.lp-lp-hero__visual`, `.lp-lp-logo-pill`, `.lp-lp-logos`, `.lp-lp-logos__lbl`, `.lp-lp-logos__pills`, `.lp-lp-menu-check`, `.lp-lp-menu-icon`, `.lp-lp-menu-item`, `.lp-lp-menu-item--selected`, `.lp-lp-menu-label`, `.lp-lp-menu-left`, `.lp-lp-menu-name`, `.lp-lp-menu-section`, `.lp-lp-menu-sub`, `.lp-lp-mockup-wrap`, `.lp-lp-play-icon`, `.lp-lp-stat`, `.lp-lp-stat__lbl`, `.lp-lp-stat__val`, `.lp-lp-stats`, `.lp-lp-tag`, `.lp-lp-tag__dot`, `.lp-lp-tag__text`, `.lp-lp-win-bar`, `.lp-lp-win-body`, `.lp-lp-win-cta`, `.lp-lp-win-cta__cancel`, `.lp-lp-win-cta__order`, `.lp-lp-win-date`, `.lp-lp-win-deadline`, `.lp-lp-win-delivery`, `.lp-lp-win-dot`, `.lp-lp-win-head`, `.lp-lp-win-title`, `.lp-lp-win-url`, `.lp-page-hero__heading`, `.lp-page-hero__lead`, `.lp-pricing-badge`, `.lp-pricing-block`, `.lp-pricing-card`, `.lp-pricing-card--highlighted`, `.lp-pricing-grid`, `.lp-pricing-heading`, `.lp-pricing-hero`, `.lp-pricing-inner`, `.lp-pricing-section`, `.lp-pricing-subheading`, `.lp-social-proof`, `.lp-social-proof__avatar`, `.lp-social-proof__fact`, `.lp-social-proof__facts`, `.lp-social-proof__grid`, `.lp-social-proof__inner`, `.lp-social-proof__name`, `.lp-social-proof__person`, `.lp-social-proof__quote`, `.lp-social-proof__quote-card`, `.lp-social-proof__quote-mark`, `.lp-social-proof__role`
- `app/styles/ds/priser-page-blocks.css`: `.lp-block-grid`, `.pr-billing-toggle`, `.pr-billing-toggle__lbl`, `.pr-billing-toggle__save`, `.pr-check`, `.pr-cta-band`, `.pr-cta-band__actions`, `.pr-cta-band__btn-primary`, `.pr-cta-band__btn-sec`, `.pr-cta-band__card`, `.pr-cta-band__heading`, `.pr-cta-band__text`, `.pr-cta-band__trust`, `.pr-dash`, `.pr-eyebrow`, `.pr-eyebrow--light`, `.pr-faq`, `.pr-faq__a`, `.pr-faq__header`, `.pr-faq__icon`, `.pr-faq__item`, `.pr-faq__list`, `.pr-faq__q`, `.pr-feature-table`, `.pr-feature-table__category`, `.pr-feature-table__col--featured`, `.pr-feature-table__col--plan`, `.pr-feature-table__col-label`, `.pr-feature-table__head`, `.pr-feature__cell`, `.pr-feature__cell--featured`, `.pr-feature__label`, `.pr-feature__row`, `.pr-feature__text`, `.pr-feature__text--featured`, `.pr-features`, `.pr-h2`, `.pr-hiw-grid`, `.pr-hiw-step`, `.pr-hiw-step__body`, `.pr-hiw-step__number`, `.pr-hiw-step__title`, `.pr-how-it-works`, `.pr-inner`, `.pr-lead`, `.pr-plan`, `.pr-plan--featured`, `.pr-plan__amount`, `.pr-plan__badge`, `.pr-plan__badge-save`, `.pr-plan__cta`, `.pr-plan__desc`, `.pr-plan__features`, `.pr-plan__header`, `.pr-plan__month-est`, `.pr-plan__name`, `.pr-plan__price`, `.pr-plan__unit`, `.pr-plans`, `.pr-plans__footer`, `.pr-plans__grid`, `.pr-reveal`, `.pr-reveal-group`, `.pr-toggle-thumb`, `.pr-toggle-track`

Styling-system: Tailwind er konfigurert i `tailwind.config.cjs` og PostCSS i `postcss.config.cjs`; Next-sider bruker Tailwind utility classes i TSX, og CSS ligger også som plain CSS i `app/styles/ds`. `tailwind.config.cjs:1`, `postcss.config.cjs:1`, `app/(app)/week/page.tsx:718`

## 14. Umbraco-laget
- Umbraco .csproj-treff:
  - `Umbraco/Umbraco.csproj:3`: `<TargetFramework>net10.0</TargetFramework>`
  - `Umbraco/Umbraco.csproj:11`: `<PackageReference Include="Umbraco.Cms" />`
  - `Umbraco/Umbraco.csproj:16`: `<PackageReference Include="Umbraco.Cms.DevelopmentMode.Backoffice" Version="*" Condition="'$(Configuration)' == 'Debug'" />`
  - `Umbraco/Umbraco.csproj:20`: `<PackageReference Update="Umbraco.Cms.DevelopmentMode.Backoffice" ExcludeAssets="all" />`
  - `Umbraco/Umbraco.csproj:41`: `<!-- Azure / clean clone: publish must include umbraco/Data so |DataDirectory|/Umbraco.sqlite.db can be created (see Umbraco-CMS #19948). -->`
  - `umbraco17/lunchportalen/lunchportalen.csproj:4`: `<TargetFramework>net10.0</TargetFramework>`
  - `umbraco17/lunchportalen/lunchportalen.csproj:21`: `<PackageReference Include="Umbraco.Cms" />`
  - `umbraco17/lunchportalen/lunchportalen.csproj:22`: `<PackageReference Include="SeoToolkit.Umbraco" />`
  - `umbraco17/lunchportalen/lunchportalen.csproj:23`: `<PackageReference Include="SeoToolkit.Umbraco.Sitemap" />`
- Dokumenttyper/views funnet under `umbraco17/lunchportalen/Views`: `benefits.cshtml`, `contact.cshtml`, `demoPage.cshtml`, `fordelerPage.cshtml`, `HomePage.cshtml`, `komIGangPage.cshtml`, `LandingPage.cshtml`, `losningenPage.cshtml`, `omOssPage.cshtml`, `pricing.cshtml`, `_ViewImports.cshtml`
- `_Layout.cshtml` finnes. `umbraco17/lunchportalen/Views/Partials/_Layout.cshtml:1`
- `_Header.cshtml` finnes. `umbraco17/lunchportalen/Views/Partials/_Header.cshtml:1`
- Steder hvor Umbraco snakker med Supabase/Sanity:
  - Ikke funnet

## 15. Hull og uavklarte spørsmål
- Det finnes to Sanity-modeller for uke/meny: `weekPlan`-skjema og `menuDay`/`menuContent`-basert operativ flyt; `/api/week` sier eksplisitt at `weekPlan` ikke er operativ sannhet. `studio/schemas/weekPlan.ts:64-67`, `studio/schemaTypes/menuDay.ts:3-7`, `app/api/week/route.ts:1-3`
- Studio `Ukeplan` oppretter `menuDay`, mens Next employee API leser `menuContent`; sammenhengen mellom disse er ikke funnet i WeekPlanner-koden. `studio/src/tools/WeekPlanner.tsx:245-258`, `app/api/week/route.ts:165-192`
- `menuContent` TypeScript-type inkluderer `title` og `tier`, men Sanity-skjemaet for `menuContent` definerer bare `date`, `description`, `allergens`, `isPublished`. `lib/sanity/queries.ts:15-24`, `studio/schemaTypes/menuContent.ts:8-55`
- `formatDateNO`-navnet tilsier norsk dato, men produserer bindestrekformat; dette avviker fra datoformatregelen. `lib/date/format.ts:37-40`
- `BASIS/LUXUS` finnes som agreement enum, mens `STANDARD/PREMIUM/BUDGET` finnes som Sanity kostnadsnivå; beslutning trengs før tier-begrep kobles på tvers. `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:34-39`, `studio/schemaTypes/mealIdea.ts:123-137`
- `customerVisible` finnes i `menuDay`, `menuContent` queries og `weekPlan`, men `weekPlan.days[].hidden` er separat og Next-filteret for `menuContent` bruker ikke `hidden`. `studio/schemaTypes/menuDay.ts:189-202`, `lib/sanity/queries.ts:56-72`, `studio/schemas/weekPlan.ts:332-337`
- Umbraco og Next har parallelle CSS/designsystem-filer (`umbraco17/lunchportalen/wwwroot/css/*` og `app/styles/ds/*`), som kan v?re duplisering. `umbraco17/lunchportalen/wwwroot/css/design-system.css:1`, `app/styles/ds/design-system.css:1`

## 16. Endringer etter denne rapporten

- **Bug-fix (admin-audit):** `lib/server/kitchen/loadOperativeKitchenOrders.ts` fjernet lowercase 'active' fra order_status filter. Bugen forårsaket "invalid input value for enum order_status" på /admin Oversikt, Dagens brukere, Dagens levering. Identifisert i docs/audit/admin-flow-architecture.md seksjon 5.
- **Patch 1 (post-audit):** POST /api/superadmin/agreements og POST /api/superadmin/company-registrations/[companyId]/create-agreement-draft returnerer nå 410 FLOW_DEPRECATED. UI-knappen er deaktivert. Den eneste tillatte flyten er nå pending company_registration → superadmin approve/reject. Koden er beholdt men inaktiv; faktisk sletting i senere opprydningspatch.
- **Patch 5 (post-audit):** Etablert `lib/auth/agreementStatus.ts` som eneste sannhet for "aktiv avtale" og "billing hold". `lib/auth/scope.ts`, `lib/auth/getScopeServer.ts` og `requireActiveAgreement` migrert til å bruke felles helper. Reason-koder skilt: `AGREEMENT_NOT_ACTIVE` vs `BILLING_HOLD`.
- **Patch 3 (post-audit, MAJOR):** Tre-tier meny-system kobles ende-til-ende i /week: /api/order/window leverer kategori-data fra menuDay basert på agreement.tier; /week UI viser kategori-valg per dag (3 for BASIS, 6 for LUXUS/ENTERPRISE); /week UI sender choice_key i bestilling; /api/order/set-day validerer fail-closed (CHOICE_REQUIRED / INVALID_CHOICE); fallback til legacy getMenusByMealTypesWithFetchStatus beholdt midlertidig for datoer uten menuDay-data; /meny-PR slettet (ble erstattet av integrasjon i /week).
- 2026-05-12: `weekPlan` ble slettet etter live-verifisering av 0 dokumenter i Sanity production og tom backup-dump i `docs/audit/sanity-dump/weekPlan.ndjson`. Se `docs/audit/sanity-live-state.md:17`, `docs/audit/sanity-live-state.md:69-73`.
- **Fase 2 (weekPlan slettet):** `weekPlan`-modellen fullstendig fjernet.
- **Fase 3a:** Meny-lesing flyttet fra `menuContent` til `menuDay` via `lib/cms/menuDay.ts`.
- **Fase 3b:** `menuContent`-skjema, kode, publish-broker og 5 Sanity-dokumenter slettet. Se `docs/audit/sanity-delete-log.md`.
- **Fase 6:** `menuDay` utvidet med `planTier` (BASIS/LUXUS/ENTERPRISE) og `category` (paasmurt/salat/sushi/pokebowl/thai/varmrett). Dokument-ID-format endret til `menuDay-{date}-{planTier}-{category}`. Eksisterende 10 dokumenter beholder gammel ID og null-verdier på nye felter — ryddes manuelt eller via senere migrasjons-script.
- **Fase 7:** Supabase `agreement_tier`-enum utvidet med `ENTERPRISE`. TypeScript-typer i `EmployeeWeekClient.tsx`, `lib/agreements/normalize.ts`, og invoices-CSV oppdatert. `PRICE_PER_TIER.ENTERPRISE = 170`. `tierChoiceLimit("ENTERPRISE") = 6` (samme som LUXUS).
- **Fase 7b:** `lp_company_registration_approve` og `lp_materialize_agreement_day_slots` oppdatert til å akseptere ENTERPRISE. Sammen med fase 7 er nå alle DB-funksjoner i `supabase/migrations/` som validerer eller materialiserer tier-whitelist synkronisert.
- **Fase 8:** Seed-script `scripts/sanity/seed-menu-week.ts` som genererer 75 menuDay-dokumenter (15 BASIS + 30 LUXUS + 30 ENTERPRISE) per eksempel-uke. Idempotent via `createIfNotExists`. `mealIdea`-valg er deterministisk men midlertidig — full kategori-aware logikk i fase 9.
- **Fase 9:** Ny `/meny`-side bygget som server component. Henter innlogget brukers bedrifts-tier fra Supabase og kaller `getMenuForDateAndPlan` per ukedag. Viser plan-spesifikke kategorier (3 for BASIS, 6 for LUXUS/ENTERPRISE). Mobile-first med ds-*-tokens. Tom-state håndtert.
- **Fase 9a-1:** `mealIdea`-skjemaet utvidet med optional `category`-felt (samme verdier som menuDay.category). Eksisterende 1000 dokumenter beholder null. AI-klassifisering kommer i fase 9a-2.
