# FULL REPO AUDIT V2 — Exhaustive file / folder / placement audit

**Dato:** 2026-03-29  
**Scope:** Hele repo (kildekode, config, docs, scripts, infra-artifakter) med eksplisitte ekskluderinger: `node_modules`, `.next`, `dist`, `coverage`, `build`, cache — jf. instruks.  
**Sannhetskilde:** Faktiske filer og konfig i working tree. Eldre rapporter (`docs/audit/full-system/*`) er **historisk referanse** der de avviker — avvik dokumenteres her.  
**Endringer i leveransen:** Kun nye/oppdaterte dokumenter under `docs/audit/` — **ingen** kodeendringer.

---

## 1. Executive summary

### 1.1 Hva repoet faktisk er nå

- **Monolittisk Next.js 15 App Router**-applikasjon (`app/`, **~1113** filer) med **stor** `lib/`-flate (**~2052** filer) for auth, CMS, AI, billing, uke/ordre, m.m.
- **Supabase** (`supabase/`, **~162** filer) som DB- og migrasjonslag.
- **Dual UI-rot:** `components/` (**~233** filer) og `src/components/` (**~17** filer) med **alias-prioritet** som favoriserer `src/components` ved navnekollisjon.
- **Backoffice CMS** under `app/(backoffice)/backoffice/**` med omfattende `_components/`-flate.
- **Kontrolltårn:** `app/admin`, `app/superadmin`, `app/kitchen`, `app/driver`, pluss **mange** eksperimentelle/«growth»-flater i `app/api` og backoffice.
- **Sanity Studio** i `studio/**` ( **ekskludert** fra `tsc` via `tsconfig` `exclude` ).
- **Enterprise gates** i `package.json` (`build:enterprise`, `ci:platform-guards`, SEO-skript).

### 1.2 Forbedret siden baseline (kode som sannhet)

Basert på `docs/hardening/RESOLVED_BASELINE_ITEMS.md` + stikkprøver:

| Tema | Status |
|------|--------|
| Fredag **15:00** for ukesynlighet | **RESOLVED_SINCE_BASELINE** — `lib/week/availability.ts` (se baseline-doc) |
| Employee `next` allowlist (kun `/week`) | **RESOLVED_SINCE_BASELINE** — `allowNextForRole` (se baseline-doc) |

### 1.3 Fortsatt åpent (høydepunkter)

- **TypeScript `strict: false`** — `tsconfig.json`.
- **Middleware uten rolle** — kun `sb-access-token` cookie for beskyttede **paths** (sider); API må selv enforce.
- **API sprawl** — **~561** `route.ts` under `app/api`.
- **Cron sprawl** — **56+** cron `route.ts` filer vs **9** Vercel-scheduled crons.
- **Worker** — **stub** for flere jobbtyper i `workers/worker.ts`.
- **Komponentduplikater** — overlappende filer i `components/` og `src/components/`.

### 1.4 De 15 viktigste funnene

1. **~4583** sporbare filer (ekskl. tunge mapper) — høy kompleksitet.
2. **`@/components`** resolver **`src/components` først** — systematisk **skyggelegging** av `components/`.
3. **571** forekomster av `route.ts` (Next API + routes) — navigasjons- og review-kostnad.
4. **246** basename-kollisjoner — indikerer duplikat-navn på tvers av trær.
5. **`middleware.ts`** lar **nesten all `/api/*`** passere uten cookie-gate — **API = eget ansvar**.
6. **`vercel.json`** scheduler **9** crons — resten av cron-ruter er **ikke** automatisk forklart.
7. **Trippel ESG** API-yte: `admin` / `backoffice` / `superadmin`.
8. **`app/(app)/week/page.tsx`** finnes — gammel `(portal)/week` er **ikke** sannhet i treet nå.
9. **`app/api/something`** — eksplisitt **contract / demo** route, ikke generisk produkt.
10. **`lib/system/routeRegistry.ts`** — delvis **enterprise proof**, ikke full dekning.
11. **`workers/worker.ts`** — **aktiv** outbox-retry, men **stub** for e-post/AI/eksperiment.
12. **`studio/**` + `archive/**`** ekskludert fra `tsc` — egen risiko for type-glidning.
13. **Rot-nivå** — **40+** policy/GRC `.md` filer utenfor `docs/` — dokumentasjonsrot.
14. **`docs/audit/full-system/*`** — omfattende tidligere audit — **supersedes** delvis av V2.
15. **Vitest** — **212** filer / **1191** tester **PASS** (2026-03-29).

### 1.5 De 15 største risikoene

1. **API angrepsflate** (mengde + uklar eierskap).
2. **Middleware** erstatter ikke API-autorisasjon.
3. **`strict: false`** — type-hull.
4. **Cron-ruter uten** dokumentert trigger.
5. **Worker stub** — stille manglende funksjon.
6. **Duplikat komponent-trær** — feil import ved fremtidig refaktor.
7. **ESG duplikat** endepunkter — feil tenant/rolle ved vedlikehold.
8. **Social/SEO growth** — mange innganger — scope-lekkasje risiko.
9. **Outbox** — avhengig av secrets + Redis — **OPS**.
10. **Sanity studio** utenfor `tsc` — inkonsistent typing.
11. **Policy-dokumenter** i rot — **DOC_DRIFT**.
12. **Eksperimentelle `app/api` namespaces** (`chaos`, `god-mode` cron-navn) — **produksjons eksponering** må verifiseres.
13. **Skaleringsbevis** — ikke del av denne audit; **SCALE_RISK** åpen.
14. **Rot-artifakter** (`dead-files.json`, `queue.json`, …) — kan forvirre operatører.
15. **Pilot-scope** — ingen automatisk «go» uten menneskelig **API/cron** avklaring.

---

## 2. Complete repo map

### 2.1 Toppnivå (utdrag)

Se detaljtabell i `FOLDER_AND_PLACEMENT_MAP.md`. Største kataloger: **`lib`**, **`app`**, **`docs`**, **`components`**, **`tests`**, **`supabase`**.

### 2.2 Viktigste undermapper

| Sti | Rolle |
|-----|-------|
| `app/api` | HTTP API — **største** sikkerhetsflate |
| `app/(backoffice)/backoffice` | CMS / growth / AI kontrollpanel |
| `app/superadmin`, `app/admin` | Kontrolltårn |
| `lib/auth`, `lib/http` | Auth + route guards |
| `lib/cms`, `lib/week`, `lib/billing` | Kjerne-domener |
| `supabase/migrations` | DB sannhet over tid |

### 2.3 Canonical vs transitional vs legacy

Samlet i **`CANONICAL_VS_TRANSITIONAL_MAP.md`** og **`FOLDER_AND_PLACEMENT_MAP.md`**.

---

## 3. File placement audit

### 3.1 Riktig plassert (typisk)

- Next routes under `app/**`.
- Delt logikk under `lib/**`.
- Tester under `tests/**`.
- Migrasjoner under `supabase/migrations/**`.

### 3.2 Problematiske plasseringer

| Sak | Kommentar |
|-----|-----------|
| Policy `.md` i repo-rot | Burde på sikt samles under `docs/` |
| `evidence/**` store filer | Ikke runtime — operasjonell hygiene |
| `page.duplicate.tsx` | Navn antyder teknisk gjeld |

### 3.3 Burde flyttes senere (ikke nå)

- Rot `.md` policyfiler → `docs/compliance/` ( **ARCHIVE_LATER** / **REFACTOR_LATER** ).

---

## 4. Duplicate / shadow / alias audit

Se **`DUPLICATE_AND_SHADOW_REPORT.md`** — oppsummert: **alias-skygge**, **ESG triplet**, **komponentduplikater**.

---

## 5. Runtime boundary audit

Se **`CMS_BOUNDARY_AND_RUNTIME_BOUNDARY_REPORT.md`**.

---

## 6. Security / route / role audit

Se **`API_SURFACE_AND_GATING_REPORT.md`**.

**Kort:** Middleware = **cookie for sider**; `scopeOr401` / `requireRoleOr403` = **API**.

---

## 7. Cron / worker / outbox audit

Se **`CRON_WORKER_AND_OUTBOX_REPORT.md`**.

---

## 8. CMS audit

| Del | Status |
|-----|--------|
| Content tree / pages / media / preview | **ACTIVE** — stor flate, god test-dekning (se `tests/cms`, `tests/api`) |
| Social/SEO/ESG i CMS-kontekst | **TRANSITIONAL** — flere «surfaces» |

---

## 9. Control towers audit

| Flate | Kilde | Merknad |
|-------|-------|---------|
| Company admin | `app/admin/**` | **ACTIVE** |
| Kitchen | `app/kitchen/**` | **ACTIVE** (read-only produksjon — policy) |
| Driver | `app/driver/**` | **ACTIVE** |
| Superadmin | `app/superadmin/**` | **ACTIVE** + mange labs |

---

## 10. Docs drift audit

Se **`DOCS_DRIFT_REPORT.md`**.

---

## 11. Scale / performance audit

| Tema | Bevist / ikke |
|------|----------------|
| Build + lint gates | **Bevist** — `build:enterprise` PASS |
| Load / 50k samtidig | **Ikke bevist** — **NEEDS_REVERIFICATION** |
| DB hotspots | Krever produksjons telemetri — **ikke** del av V2 |
| Caching | Delvis (Next headers i `next.config.ts` for `/og/*`) |

---

## 12. Delta from baseline

| Baseline item | Current status | Evidence | Kommentar |
|---------------|----------------|----------|-----------|
| Employee only `/week` (next) | **Forbedret** | `docs/hardening/RESOLVED_BASELINE_ITEMS.md` | **RESOLVED_SINCE_BASELINE** |
| Friday 15:00 | **Forbedret** | `lib/week/availability.ts` (referert i baseline-doc) | **RESOLVED_SINCE_BASELINE** |
| Single source of truth for Week | **Delvis** | `lib/week/*`, `app/(app)/week` | **STILL_OPEN** — flere visninger (`menus/week`, `today`) eksisterer |
| Content tree | **ACTIVE** | `app/api/backoffice/content/tree` | **CANONICAL** |
| Media library | **ACTIVE** | `app/api/backoffice/media` | **CANONICAL** |
| Company admin tower | **ACTIVE** | `app/admin` | **CANONICAL** |
| Kitchen tower | **ACTIVE** | `app/kitchen` | **CANONICAL** |
| Driver tower | **ACTIVE** | `app/driver` | **CANONICAL** |
| Superadmin tower | **ACTIVE** | `app/superadmin` | **CANONICAL** + scope creep risiko |
| Social calendar | **ACTIVE** | `app/(backoffice)/backoffice/social`, `app/api/social` | **TRANSITIONAL** |
| SEO growth surface | **ACTIVE** | `seo-growth` backoffice + scripts | **TRANSITIONAL** |
| ESG surface | **ACTIVE** | Flere API + cron | **DUPLICATE** / **TRANSITIONAL** |
| Middleware/auth boundary | **Uendret prinsipp** | `middleware.ts` | **STILL_OPEN** — ingen rolle |
| Strict typing | **Av** | `tsconfig.json` `"strict": false` | **STILL_OPEN_FROM_BASELINE** |
| Worker stubs | **Finnes** | `workers/worker.ts` | **STILL_OPEN_FROM_BASELINE** |
| API sprawl | **Høy** | ~561 `app/api/**/route.ts` | **STILL_OPEN_FROM_BASELINE** |
| Scale readiness | **Ubevist** | — | **NEEDS_REVERIFICATION** |

---

## 13. Action matrix

| Item | Type | Risk | Effort | Recommendation | Timing |
|------|------|------|--------|----------------|--------|
| API inventory + eierskap | **REVERIFY** | Høy | Middels | Register + markering av pilot-scope | Før pilot |
| Middleware rolle (sider) | **HARDEN** | Middels | Høy | Avklar mot AGENTS.md — **ikke** gjort i V2 | Etter vedtak |
| `strict: true` (fasevis) | **HARDEN** | Middels | Høy | Per mappe | Post-pilot |
| Cron dokumentasjon | **REVERIFY** | Middels | Lav | Tabell: scheduled vs manual | Før pilot |
| Worker stubs | **HARDEN** | Middels | Middels | Implementer eller disable | Før bred live |
| Komponent duplikater | **REFACTOR_LATER** | Middels | Høy | Én rot-policy | Etter vedtak |
| Rot-policy `.md` | **ARCHIVE_LATER** | Lav | Middels | Flytt til `docs/` | Vedlikehold |
| ESG API konsolidering | **MERGE_LATER** | Middels | Høy | Design + roller | Planlagt |
| `studio` typing | **REVERIFY** | Lav | Middels | Egen tsconfig eller inkluder | Backlog |
| `build:enterprise` behold | **KEEP** | — | — | Fortsett som gate | Nå |

---

## VEDLEGG A — TOP 50 HOTSPOTS

Filer/mapper som gir raskest forståelse av systemet **nå** (lest / åpnet i V2):

1. `middleware.ts`
2. `next.config.ts`
3. `vercel.json`
4. `package.json` (scripts / gates)
5. `tsconfig.json` (paths, strict)
6. `app/layout.tsx` (rot)
7. `app/(public)/page.tsx`
8. `app/(public)/[slug]/page.tsx`
9. `app/(app)/week/page.tsx`
10. `app/(app)/layout.tsx`
11. `app/admin/layout.tsx`
12. `app/superadmin/layout.tsx`
13. `app/(backoffice)/backoffice/layout.tsx`
14. `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx`
15. `lib/http/routeGuard.ts`
16. `lib/auth/scope.ts` / `getScopeServer`
17. `lib/auth/post-login` (via `app/api/auth/post-login/route.ts`)
18. `app/api/auth/post-login/route.ts`
19. `app/api/auth/login/route.ts`
20. `lib/week/availability.ts`
21. `lib/billing/*` (fakturering — stikkprøve)
22. `lib/cms/*` (kjerne CMS)
23. `lib/system/routeRegistry.ts`
24. `lib/system/health.ts` (hvis superadmin health)
25. `app/api/orders/**` (utvalg)
26. `app/api/order/**`
27. `app/api/backoffice/content/pages/[id]/route.ts`
28. `app/api/backoffice/media/items/route.ts`
29. `app/api/cron/outbox/route.ts`
30. `app/api/cron/lock-weekplans/route.ts`
31. `workers/worker.ts`
32. `lib/infra/queue.ts` / `lib/infra/redis.ts`
33. `components/nav/HeaderShell.tsx` / `src/components/nav/HeaderShell.tsx`
34. `components/layout/PublicLayout.tsx`
35. `supabase/migrations` (siste 5 filer)
36. `lib/types/database.ts`
37. `docs/hardening/GO_LIVE_READINESS_CHECKLIST.md`
38. `docs/hardening/RESOLVED_BASELINE_ITEMS.md`
39. `docs/phase2b/CONTENT_TREE_SOURCE_OF_TRUTH.md`
40. `docs/phase2d/SOCIAL_SOURCE_OF_TRUTH.md`
41. `docs/phase2d/SEO_SOURCE_OF_TRUTH.md`
42. `docs/phase2d/ESG_SOURCE_OF_TRUTH.md`
43. `scripts/audit-api-routes.mjs`
44. `scripts/ci/api-contract-enforcer.mjs`
45. `playwright.config.ts`
46. `vitest.config.ts`
47. `tests/tenant-isolation.test.ts`
48. `tests/api/routeGuardConsistency.test.ts`
49. `tests/cms/contentWorkspaceStability.smoke.test.ts`
50. `AGENTS.md` (policy låst)

---

## VEDLEGG B — SUPPORTING EVIDENCE (utdrag)

| Filsti | Område | Funn | Seksjon |
|--------|--------|------|---------|
| `tsconfig.json` L21–32 | Alias | `@/components` → `src` først | §4, §13 |
| `tsconfig.json` L8 | Strict | `"strict": false` | §1, §12 |
| `middleware.ts` L14–20 | MW | API stort sett bypass | §6 |
| `middleware.ts` L86–99 | MW | Cookie redirect | §6 |
| `vercel.json` | Cron | 9 schedules | §7 |
| `workers/worker.ts` L49–79 | Worker | Stub jobs | §7 |
| `app/api/something/route.ts` L1–16 | API | Contract route | §8, ORPHAN rapport |
| `docs/hardening/RESOLVED_BASELINE_ITEMS.md` L10–18 | Baseline | 15:00 + employee next | §12 |
| `lib/system/routeRegistry.ts` L33–60 | API registry | Orders paths | §6 |

Full maskinlogg: `FULL_REPO_AUDIT_V2_EXECUTION_LOG.md`.

---

## VEDLEGG C — PILOT BLOCKERS

| Kategori | Elementer |
|----------|-----------|
| **Må lukkes før pilot (prosess / menneske)** | Eksplisitt liste over **hvilke** API-navnerom er i pilot; bekreft **cron** subset; bekreft **superadmin** labs av/på. |
| **Bør lukkes før bred live** | API inventory; worker stubs; strict TS; cron cleanup. |
| **Kan vente** | Rot `.md` flytting; full komponent-konsolidering. |

**Automatiske gates:** `typecheck`, `build:enterprise`, `test:run` — **PASS** 2026-03-29 (se execution log).

---

## Lenker til øvrige V2-dokumenter

- `FOLDER_AND_PLACEMENT_MAP.md`
- `CANONICAL_VS_TRANSITIONAL_MAP.md`
- `DUPLICATE_AND_SHADOW_REPORT.md`
- `ORPHAN_AND_DEAD_CODE_REPORT.md`
- `DOCS_DRIFT_REPORT.md`
- `API_SURFACE_AND_GATING_REPORT.md`
- `CRON_WORKER_AND_OUTBOX_REPORT.md`
- `COMPONENT_ROOT_AND_ALIAS_REPORT.md`
- `CMS_BOUNDARY_AND_RUNTIME_BOUNDARY_REPORT.md`
- `GO_LIVE_RISK_REGISTER_V2.md`
- `FULL_REPO_AUDIT_V2_EXECUTION_LOG.md`
- `FULL_REPO_AUDIT_V2_CHANGED_FILES.md`
- `FULL_REPO_AUDIT_V2_NEXT_STEPS.md`
