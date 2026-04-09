# DELETE / ARCHIVE / REFACTOR — matrise

**Dato:** 2026-03-28  
**Regel:** Ingen sletting før avhengighetskart er verifisert i egen PR; denne tabellen er **anbefaling** og **rekkefølge**, ikke utført arbeid.

Kolonner: **Fil / mappe** | **Status** | **Hvorfor** | **Dependencies (utdrag)** | **Risiko** | **Anbefalt rekkefølge**

---

## A) Auth, middleware, roller

| Fil / mappe | Status | Hvorfor | Dependencies | Risiko | Rekkefølge |
|-------------|--------|---------|--------------|--------|------------|
| `middleware.ts` | **KEEP** (minimal endring) | Kant-auth for cookie; eksplisitt bypass for `/api/*` (unntatt auth-endepunkter), `/login`. Frozen per AGENTS.md for endringer. | Alle beskyttede ruter under `isProtectedPath`. | Høy ved endring — login loops, åpne hull. | — |
| `lib/auth/role.ts` | **REFACTOR** | Én eksport for landing/next; må synkroniseres med `getAuthContext` sin normalisering. | `app/api/auth/post-login/route.ts` importerer `allowNextForRole`, `landingForRole`. | Middels — påvirker alle roller. | Etter avtale om én normaliseringsfunksjon. |
| `lib/auth/getAuthContext.ts` | **REFACTOR** | Intern `normalizeRole` dupliserer `lib/auth/role.ts`. | `getScope`, layouts, API-guards. | Middels. | Samme som over — **merge** normalisering (ikke to kilder). |
| `src/components/registration/RoleGate.tsx` | **REFACTOR / DEPRECATE (gradvis)** | Parallell rolle-sjekk; bred employee-surface hvis utvidet uten server-sannhet. | Importert fra `PublicRegistrationFlow` e.l. | Lav–middels — må ikke overstyre server guards. | Etter dokumentert kontrakt for klient-gates. |

---

## B) Uke, bestilling, cron

| Fil / mappe | Status | Hvorfor | Dependencies | Risiko | Rekkefølge |
|-------------|--------|---------|--------------|--------|------------|
| `app/api/week/route.ts` | **REFACTOR / MERGE** | Én av to uke-API-er; bruker `company_current_agreement` + Sanity weekPlan. | `EmployeeWeekClient` indirekte via uke-fetch (verifiser klientkall); `lib/cms/weekPlan` re-export. | Høy — live Week UI. | **Sent** — kun etter kontrakt-frys og tester. |
| `app/api/weekplan/route.ts` | **REFACTOR / MERGE** | Annen kontrakt; leser `agreement_json` direkte. | `components/week/WeekMenuReadOnly.tsx` bruker `/api/weekplan/next`; andre klienter mulig. | Høy. | Samme batch som `/api/week`. |
| `app/api/order/window/route.ts` | **KEEP** | Operativ sannhet for bestillingsvindu, men inneholder legacy `agreement.weekplan?.tiers`. | `lib/week/availability`, `getCurrentAgreementState`, CMS. | Høy. | Kun målrettet opprydding i **legacy-gren** når avtale er migrert. |
| `lib/week/availability.ts` | **REFACTOR** | Dupliserer Oslo-tid vs `lib/date/oslo.ts`; fredag 14:00/torsdag 08:00-regler. | `order/window`, ev. andre. | Middels — tidsavvik. | Etter beslutning i `WEEK_SOURCE_OF_TRUTH_DECISION.md`. |
| `lib/date/oslo.ts` | **KEEP** | Dato/tid-fasit for mye av appen. | Cron, API, formatering. | Høy ved «flytting». | — |
| `app/api/cron/week-visibility/route.ts` | **REFACTOR** | `menuContent`-synlighet + DB-speil; **minutt-presis** fredag 14:00 vs kontinuerlig logikk i `availability.ts`. | Sanity write, `menu_visibility_days`, audit. | Høy — synlighet i prod. | Etter harmonisering av tids-semantikk. |
| `app/api/cron/lock-weekplans/route.ts` | **DEPRECATE / ARKIV (vurder)** | Låser Sanity `weekPlan` når dagens dato finnes i `days`; **ikke** samme som `menuContent`-flyt. | Kalt fra `week-scheduler`. | Middels — kjøkken/ukeplan-arbeidsflyt i Studio. | Etter at `weekPlan` sin rolle er avklart. |
| `app/api/cron/week-scheduler/route.ts` | **KEEP** | Orkestrerer cron-vinduer (10 min). | Kaller `week-visibility`, `lock-weekplans`. | Middels. | Oppdater når under-ruter konsolideres. |
| `lib/sanity/weekplan.ts` | **KEEP / REFACTOR** | GROQ for `weekPlan`; kjerne for Studio-basert ukeplan. | `lib/cms/weekPlan.ts` re-export, `/api/week`, `/api/weekplan`. | Middels. | Behold til migrasjon er klar. |
| `lib/cms/weekPlan.ts` | **KEEP** | Tynn re-export — bra grensesnitt, men skjuler at impl er `lib/sanity/weekplan.ts`. | API-ruter. | Lav. | — |

---

## C) Data: avtaler og JSON

| Fil / mappe | Status | Hvorfor | Dependencies | Risiko | Rekkefølge |
|-------------|--------|---------|--------------|--------|------------|
| `lib/agreement/currentAgreement.ts` | **KEEP** | «Daymap» som operativ sannhet for uke/bestilling (kommentarer i fil). | `order/window`, admin. | Høy. | Aldri slett uten migrasjon. |
| `companies.agreement_json` (kolonne) | **KEEP** | `meal_contract`, legacy mønstre; mange API-er. | Onboarding, superadmin, `order/window`. | Høy. | — |
| `company_current_agreement` (view/RPC) | **KEEP** | Brukt som fasit i `app/api/week/route.ts`. | Employee week API. | Høy. | — |

---

## D) Sanity Studio

| Fil / mappe | Status | Hvorfor | Dependencies | Risiko | Rekkefølge |
|-------------|--------|---------|--------------|--------|------------|
| `studio/schemas/weekPlan.ts` | **DEPRECATE (innhold)** / **KEEP (skjema til migrasjon ferdig)** | Dokumenterer `becomesCurrentAt` fredag 14:00; felt kan være **ønsket sannhet** men ikke konsistent med runtime. | Studio, GROQ, cron. | Middels. | Ikke slett før data migrert. |
| `studio/tools/weekPlanner/WeekPlanner.tsx` | **SPLIT / MERGE** | Dublert konsept med `studio/src/tools/WeekPlanner.tsx`. | `deskStructure.ts` | Lav–middels. | Tidlig **etter** avklaring av hvilket verktøy som er fasit. |
| `studio/src/tools/WeekPlanner.tsx` | **SPLIT / MERGE** | Samme som over. | `studio/src/structure.ts` | Samme. | Samme. |

---

## E) Komponenter og alias

| Fil / mappe | Status | Hvorfor | Dependencies | Risiko | Rekkefølge |
|-------------|--------|---------|--------------|--------|------------|
| `tsconfig.json` paths `@/components/*` | **REFACTOR** | To rotmapper (`./components/*`, `./src/components/*`) — risiko for skyggefiler. | Hele appen. | Middels. | Planlegg **én canonical mappe** + midlertidig re-export. |
| `components/**` (rot) | **KEEP** | Hovedbulk av UI (~240 filer under `components/`). | App, layouts. | Høy ved rot-flytting. | Gradvis. |
| `src/components/nav/HeaderShell.tsx` | **KEEP** | Kanonisk server-header (AGENTS.md). | `(app)/layout`, `(public)/layout`. | **KRITISK** — ikke slett. | — |
| `components/nav/HeaderShellView.tsx` | **KEEP** | Presentasjonslag — del av kanonisk header. | `HeaderShell`, layouts. | Høy. | — |

---

## F) Backoffice content workspace

| Fil / mappe | Status | Hvorfor | Dependencies | Risiko | Rekkefølge |
|-------------|--------|---------|--------------|--------|------------|
| `app/(backoffice)/backoffice/content/_components/**` (201 filer) | **SPLIT** | Monolitt; mange `ContentWorkspace*`, `Editor*`, paneler — vanskelig å vedlikeholde én CMS-kjerne. | `contentWorkspace.*.ts`, API actions, CMS. | Høy ved «big bang». | Faser: domener (workspace chrome / editor / AI / preview). |

---

## G) Workers

| Fil / mappe | Status | Hvorfor | Dependencies | Risiko | Rekkefølge |
|-------------|--------|---------|--------------|--------|------------|
| `workers/worker.ts` | **KEEP** | Kø + cron-proxy til outbox; ikke uke-sannhet direkte. | `lib/infra/queue`, env. | Middels. | — |

---

## H) Øvrige ruter (employee / superadmin)

| Fil / mappe | Status | Hvorfor | Dependencies | Risiko | Rekkefølge |
|-------------|--------|---------|--------------|--------|------------|
| `app/menus/week/page.tsx` | **KEEP** | Superadmin-only meny-oversikt; `redirect` til `/week` for ikke-superadmin. | Sanity `menuContent`. | Lav for employee — allerede begrenset. | — |
| `app/min-side/page.tsx` | **KEEP** | Smart redirect; bruker `getScope`, ikke middleware. | Auth. | Lav. | Ved innstramming av employee-flater — vurder om `/min-side` skal inn i `middleware` (frozen — krever egen godkjenning). |

---

### Forklaring av statusverdier

- **KEEP** — behold som fasit inntil videre.  
- **REFACTOR** — behold fil/mappe, endre struktur eller konsolider med annen kilde.  
- **SPLIT** — del opp i moduler uten å duplisere domene.  
- **DEPRECATE** — ikke utvid; planlegg utfasing.  
- **ARCHIVE** — flytt til `archive/` med tydelig README (ingen sletting før varsel).  
- **DELETE** — kun etter migrasjon og grønn CI — **ikke anbefalt i første bølge** for rader merket KEEP/REFACTOR over.
