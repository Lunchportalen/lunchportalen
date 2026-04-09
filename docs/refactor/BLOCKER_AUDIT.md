# Blocker-audit — CMS-ledet kjerne (bevisbasert)

**Dato:** 2026-03-28  
**Formål:** Kartlegge dobbel sannhet, rolle-blokkeringer og parallelle spor uten å endre kode.  
**Metode:** Lesing av nøkkelfiler + `rg`-treff på `weekPlan`, `agreement_json`, fredag 14:00, komponent-aliaser.

---

## 1. Dobbelt sannhet — uke / meny / synlighet

### 1.1 To API-flater for «uke»-data (forskjellige avtalekilder)

| Filsti | Innhold |
|--------|---------|
| `app/api/week/route.ts` | Henter aktiv avtale fra `company_current_agreement`, Sanity `fetchCurrentWeekPlan` / `fetchNextOpenWeekPlan`, egen `startOfWeekISO` + `isUnlocked` for torsdag 08:00. Kommentar sier «GET /api/weekplan» men filen er `app/api/week/route.ts`. |
| `app/api/weekplan/route.ts` | Henter `companies.agreement_json` for `week_pattern` / `cutoff` / `prices`, deretter `fetchNextPublishedWeekPlan` (alias av `fetchNextOpenWeekPlan`). Ingen `company_current_agreement`. |

**Bevis:** `app/api/week/route.ts` linjer 145–180 vs `app/api/weekplan/route.ts` linjer 58–78.  
**Konsekvens:** Samme domene (ukeplan + avtale) kan gi **forskjellig** tier/cutoff avhengig av hvilket endepunkt klienten bruker.

### 1.2 Operativ bestilling vs Sanity `weekPlan`

| Lag | Kilde |
|-----|--------|
| `app/api/order/window/route.ts` | `getCurrentAgreementState` (`lib/agreement/currentAgreement.ts`), `companies.agreement_json` for `meal_contract`, CMS `getProductPlan` / `getMenusByMealTypes`, valg fra avtale-CMS med fallback `agreement.weekplan?.tiers` (legacy). |
| `lib/sanity/weekplan.ts` | GROQ mot `_type=="weekPlan"` (status `current` / `open`, `customerVisible`). |
| `app/api/cron/week-visibility/route.ts` | Patchede dokumenter: `_type=="menuContent"` (ikke `weekPlan`), speilet til `menu_visibility_days` i Supabase. |

**Konsekvens:** «Hva er uken?» er ikke én entitet: **avtale/daymap** (Supabase), **ukeplan-dokument** (Sanity `weekPlan`), **daglig meny** (`menuContent`) og **DB-speil** (`menu_visibility_days`) opptrer samtidig.

### 1.3 Fredag 14:00 — flere semantikker

| Filsti | Oppførsel |
|--------|-----------|
| `lib/week/availability.ts` | `isAfterFriday1400`: fredag **fra og med** 14:00 + helg → «etter fredag». Brukes av `canSeeThisWeek` / `visibleWeekStarts`. Importert fra `app/api/order/window/route.ts` (`canSeeNextWeek`, `weekStartMon`). |
| `app/api/cron/week-visibility/route.ts` | `isFri1400`: kun når `weekday === "Fri" && hh === 14 && mi === 0` (ett minutt-presist). |
| `app/api/cron/week-scheduler/route.ts` | `inWindow(..., "Friday", 14, 10)`: kaller **`/api/cron/lock-weekplans`**, ikke `week-visibility`. |

**Konsekvens:** App-API bruker **kontinuerlig** fredag-gate; én cron-jobb er **minutt-presis**; aggregator-cron har **10-min vindu** og ulike sideeffekter. Risiko for avvik mellom UI/API og batch-jobb.

### 1.4 `lib/date/oslo.ts` vs `lib/week/availability.ts`

`lib/date/oslo.ts` header hevder «SINGLE SOURCE OF TRUTH», mens `lib/week/availability.ts` dupliserer Oslo-tidsdeling (`Intl`, `makeOsloDate`, ukedag-mapping) for ukesregler.

**Bevis:** `lib/date/oslo.ts` linje 4–12; `lib/week/availability.ts` linje 1–86.

---

## 2. Rollemodell og gate — blokkeringer / avvik

### 2.1 Én sannhet for post-login (OK)

`app/api/auth/post-login/route.ts` bruker `allowNextForRole` og `landingForRole` fra `lib/auth/role.ts` (kommentar linje 80–84).

### 2.2 `getAuthContext` dupliserer rollenormalisering

`lib/auth/getAuthContext.ts` definerer **egen** `normalizeRole` (linje 198–205) med alias (`companyadmin`, `kjokken`, `sjafor`) i tillegg til `lib/auth/role.ts` `normalizeRole`.

**Konsekvens:** To normaliseringsstier; endring i én fil kan gi **inkonsistent** `AuthRole` vs `Role`.

### 2.3 Middleware vs employee allowlist

- `middleware.ts` `isProtectedPath` inkluderer `/orders`, `/week`, men **ikke** `/min-side`, `/dashboard`, `/home` (linje 24–34).
- `lib/auth/role.ts` `allowNextForRole` for employee tillater `/week`, `/orders`, `/min-side` (linje 33–40).

**Bevis:** `middleware.ts` 24–34; `lib/auth/role.ts` 33–40.  
**Konsekvens:** Kant-beskyttelse og «next»-allowlist er **ikke samme mengde**; `/min-side` er avhengig av **server-side** `getScope` i `app/min-side/page.tsx` (linje 17–28), ikke av middleware.

### 2.4 `src/components/registration/RoleGate.tsx`

Ekstra klient/rolle-sjekk ved siden av server guards — må holdes konsistent med `getAuthContext` / layouts (risiko for **parallel sannhet** hvis utvidet).

---

## 3. CMS som hovedenhet — blokkeringer

### 3.1 Stor monolitt i backoffice content

`app/(backoffice)/backoffice/content/_components/` inneholder **201 filer** (telling 2026-03-28).

**Konsekvens:** Høy kognitiv last, vanskelig å etablere én «CMS workspace»-grense uten modularisering (splitt foreslått i matrix, ikke utført).

### 3.2 To Studio-spor for «Ukeplan»

| Filsti |
|--------|
| `studio/deskStructure.ts` → `studio/tools/weekPlanner/WeekPlanner.tsx` |
| `studio/src/structure.ts` → `studio/src/tools/WeekPlanner.tsx` |

**Konsekvens:** To innganger til lignende konsept i Studio; risiko for **dobbelt vedlikehold** og forvirring om hvilket verktøy som er fasit.

### 3.3 Offentlig header: server + view-modell

- `src/components/nav/HeaderShell.tsx` (server) + `components/nav/HeaderShellView.tsx` (presentasjon) + `lib/layout/globalHeaderFromCms.ts` — bevisst **delt** mønster (OK), men `tsconfig` `paths` kan tillate skyggefiler under `components/` vs `src/components/` (se matrix).

---

## 4. tsconfig — duplikat komponentrot

```json
"@/components/*": ["./components/*", "./src/components/*"],
"@/lib/*": ["./lib/*", "./src/lib/*"]
```

**Filsti:** `tsconfig.json` linje 21–26.

**Konsekvens:** Samme importsti kan teoretisk resolve til **to mapper**; i dag ligger f.eks. `HeaderShell` kun under `src/components/nav/HeaderShell.tsx` (importert som `@/components/nav/HeaderShell` fra `app/(public)/layout.tsx`, `app/(app)/layout.tsx`), mens `components/nav/` har `HeaderShellView.tsx` — **sårbarhet** hvis noen legger en duplikat `components/nav/HeaderShell.tsx`.

---

## 5. `workers/worker.ts`

Redis-kø, stubber for `send_email` / `ai_generate` / `experiment_run`; kaller `retry_outbox` via `/api/cron/outbox`. **Ikke** direkte uke-sannhet, men **infrastruktur** som må med i migrasjonsplan ved omlegging av jobber.

---

## 6. Oppsummering av blokkerende mønstre

1. To uke-API-er med ulik avtalekilde (`/api/week` vs `/api/weekplan`).  
2. `weekPlan` (Sanity) vs `menuContent` + cron vs `availability.ts` for synlighet og tid.  
3. Fredag 14:00 implementert ulikt (kontinuerlig vs cron-minutt vs scheduler-vindu).  
4. `agreement_json` vs `company_current_agreement` som sannhet for ulike flyter.  
5. `getAuthContext.normalizeRole` vs `lib/auth/role.normalizeRole`.  
6. Middleware beskyttet sti-mengde ≠ `allowNextForRole` for employee.  
7. `tsconfig` flate komponent-/lib-stier → risiko for duplikatfiler.  
8. 201 filer i `content/_components` uten klar modulgrense.  
9. To Studio week planner-innganger.  
10. `lib/date/oslo` «SSOT»-claim mot duplisert tid i `lib/week/availability.ts`.

---

*Neste steg:* se `DELETE_ARCHIVE_REFACTOR_MATRIX.md`, `WEEK_SOURCE_OF_TRUTH_DECISION.md`, `SAFE_REMOVAL_PLAN.md`.
