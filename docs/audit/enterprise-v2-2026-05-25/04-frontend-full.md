# Fase D — Frontend Full Deep

**Audit:** Enterprise v2 · **Dato:** 2026-05-25  
**Metode:** READ-ONLY · fil-åpnet + script-inventar (`scripts/audit/d1-frontend-inventory.mjs`, `d3-ts-perf-scan.mjs`, `audit-v4.cjs`)  
**Status:** SUB D.1 + D.2 + D.3 **COMPLETE** → STOP-PUNKT D

**Gate (C-RLS-01 mini-verify):** 0/10 UNTRACKED → **P1 beholdt**, Fase D fortsatt (se [03-backend-full.md §C.3.4](./03-backend-full.md)).

**Artifacts:**

- `.tmp/d1-frontend-inventory.json` — pages/routes/auth/loading counts
- `.tmp/d3-ts-scan.json` — `: any`, `@ts-ignore`, `<img>` vs `<Image>`
- `.tmp/d3-next-build.log` — `npm run build:enterprise` output (bundle sizes)
- `audit-v4.cjs` console output — AST supplement (§D.2.5)

---

## Coverage-ledger (Fase D)

| Sub | Scope | Filer åpnet / scannet | Coverage |
| --- | --- | ---: | ---: |
| **D.1** | Routes + page-struktur | 207 `page.tsx` + 543 `route.ts` (Tier 1 deep 12) | 100% count · T1 deep |
| **D.2** | Components + a11y | 321 `components/**/*.tsx` stratifisert | T1 sample deep · T2/T3 inventory |
| **D.3** | Perf + bundle + cross-cutting | `perf/`, `scripts/k6`, build log, TS scan | 100% scope |

---

# SUB D.1 — Routes + page-struktur

## D.1.1 Inventar (script-verifisert)

| Metrikk | Verdi | Bevis |
| --- | ---: | --- |
| `app/**/page.tsx` | **207** | `d1-frontend-inventory.mjs` |
| `app/**/route.ts` | **543** | *(550 glob inkl. `lib/supabase/route.ts` m.fl.; script teller kun `app/`)* |
| `loading.tsx` | **2** | `app/admin/loading.tsx`, `app/superadmin/firms/loading.tsx` |
| `error.tsx` | **3** | `app/error.tsx`, `app/admin/error.tsx`, `app/superadmin/firms/error.tsx` |
| `not-found.tsx` | **1** | root |

### Pages per segment

| Segment | Pages | Merknad |
| --- | ---: | --- |
| superadmin | 58 | Størst admin-flate |
| backoffice | 28 | CMS/Bellissima |
| admin | 27 | company_admin |
| employee-app `(app)` | 10 | `/week`, `/home`, `/dashboard` |
| leverandor | 14 | provider portal |
| auth | 6 | login, registrering, forgot-password |
| public | 2+ | `(public)/`, slug pages |
| kitchen / driver / onboarding / other | rest | Operative + CRO |

---

## D.1.2 Auth-pattern (route.ts)

**Middleware (`middleware.ts` L86–120):** Fail-closed for `/api/*` — session cookie required unless `isApiAuthAllowlisted()`. Protected page paths (`/week`, `/admin`, `/kitchen`, …) redirect to `/login?next=`.

| Auth-signal (heuristikk grep) | route.ts count | % av 543 |
| --- | ---: | ---: |
| `inline-auth` (getUser/getSession/require*) | 364+ | ~67% |
| `helper` (`routeGuard`, `getAuthContext`, …) | 39+ | ~7% |
| `service/cron` (CRON_SECRET, admin client) | 23+ | ~4% |
| `none-detected` | **100** | ~18% |
| `unknown` | 1 | — |

**Tolkning:** De fleste routes har **inline** Supabase `getUser()` + role checks. **`lib/http/routeGuard.ts`** (`scopeOr401`, `requireRoleOr403`) brukes på sensitive writes (f.eks. `POST /api/orders` L20). 100 «none-detected» er **ikke** nødvendigvis uauth — mange er public webhooks, health, eller cron med egen secret inne i handler (middleware allowlist + route gate).

**Kanonical auth flows (fil-åpnet):**

| Route | Pattern | Bevis |
| --- | --- | --- |
| `GET /api/auth/me` | `getAuthContext` helper → `{ ok, rid, data }` | `app/api/auth/me/route.ts` L14–50 |
| `GET/POST /api/auth/post-login` | Canonical resolver + `allowNextForRole` + agreement gate | L273–395 GET, L108–270 POST |
| `POST /api/orders` | `scopeOr401` + `requireRoleOr403` + `lp_idem_begin` | `app/api/orders/route.ts` L20+ |
| Pages | Server `getUser()` / layout guards, **not** client session guess | week, kitchen, admin samples |

| ID | Sev | Funn |
| --- | --- | --- |
| D-AUTH-01 | P2 | Auth-pattern **fragmentert** (inline vs routeGuard vs withRole) — ingen sentral route registry |
| D-AUTH-02 | P2 | 100 routes uten grep-treff — krever manuell allowlist-audit (cron/public) |

---

## D.1.3 Tier 1 DEEP — kritiske user-facing

### Login — `app/(auth)/login/page.tsx`

| Aspekt | Vurdering |
| --- | --- |
| Auth | Server `getAuthContext()` → redirect `homeForRole` **unless** `?code=` (fail recovery, no loop) L37–48 |
| Mobile | Delegert til `AuthShell` + `LoginForm` (premium card, full-bleed) — page har **ingen** egne `md:` breakpoints |
| Loop safety | `code` param blocks auto-redirect — aligns with E5 |
| UTF-8 | «Logg inn», «Glemt passord?» ✓ |

### Week — `app/(app)/week/page.tsx` + `EmployeeWeekClient.tsx`

| Aspekt | Vurdering |
| --- | --- |
| Auth | Cookie jar check → `getUser()` → `requireActiveAgreement()` L564–584 |
| Superadmin branch | Separate preview UI (707 LOC page — **P2** size) L580–582, L447–553 |
| Mobile | Page: `mx-auto`, `px-4`, `md:`/`lg:` i preview; **EmployeeWeekClient** (~2300 LOC): `useMediaQuery`, touch targets, idempotency keys — **mobile-critical** (S1.1) |
| Fail-closed | Missing profile → `/status?code=PROFILE_MISSING` or read-only client L587–620 |
| Billing hold | `computeBillingHold` reads legacy columns with schema comment L656–664 — **known debt** |

### Kitchen — `app/kitchen/page.tsx`

| Aspekt | Vurdering |
| --- | --- |
| Auth | Hard gate: session → profile → disabled → role → company/location → active agreement L66–173 |
| Forbidden UX | `BlockedState` read-only (not redirect) for wrong role L112–122 — **fail-closed UI** ✓ |
| Mobile | `PageSection` + `md:block` sidebar; print headers separate L192–213 |
| S3 compliance | Read-only production view via `KitchenRuntimeClient` |

### Admin orders — `app/admin/orders/page.tsx`

| Aspekt | Vurdering |
| --- | --- |
| Auth | Inline `getUser()` + email role + profile role L46–50 |
| Mobile | `mx-auto`, `px-4`, `md:grid-cols-*` |
| Duplication | Role helpers duplicate middleware/layout pattern L18–43 — **P2** |

### Dashboard — `app/(app)/dashboard/page.tsx`

| Aspekt | Vurdering |
| --- | --- |
| Auth | **Ingen server auth gate** i page — demo data hardcoded L160–163 |
| Mobile | Inline `style={{}}` grid `repeat(4,…)` — **sannsynlig overflow på 360px** (S1.1 risk) |
| Status | **Prototype/demo** — not production employee dashboard |

| ID | Sev | Funn |
| --- | --- | --- |
| D-PAGE-01 | **P1** | `(app)/dashboard` — **MOCK** demo, public (verifisert §D.1.4) |
| D-PAGE-02 | P2 | `week/page.tsx` 707 LOC — superadmin preview embedded in employee route file |
| D-PAGE-03 | P2 | Role resolution duplicated across admin/kitchen/week pages |

---

## D.1.4 D-PAGE-01 verifisering (2026-05-25)

**Scope:** `app/(app)/dashboard/page.tsx` + `app/(app)/layout.tsx` · prod curl · parallel routes.

### Data-klassifisering

| Kilde | Klassifisering | Bevis |
| --- | --- | --- |
| Firma, KPI, avtale, faktura | **MOCK** | L160–163: `companyName = "Acme AS"`, hardkodede tall `84`/`11`/`3`, kommentar «Demo-data — kobles mot deres ekte API/SSR senere» |
| Supabase / profiles / orders | **Ingen** | Ingen `supabaseServer`, ingen `.from(`, ingen API-fetch for business data |
| CMS overlay (`getOverlayBySlug`, `getDesignSettings`) | **HALV** | L151–158: kan hente Sanity/overlay slots; **påvirker ikke** KPI/firma-tall |
| Auth gate i page | **Ingen** | Ingen `getUser()` / redirect |

**Samlet:** **MOCK** (business surface). Ikke LIVE prod-data.

### Layout / middleware

| Lag | Oppførsel |
| --- | --- |
| `app/(app)/layout.tsx` | `enforceEmployeeWeekOnlyOnAppShell()` — redirecter **kun** `employee` **away from** non-week paths; anonyme og andre roller passeres |
| `middleware.ts` L26–37 | `isProtectedPath()` inkluderer `/week`, `/admin`, `/kitchen`, … — **`/dashboard` er IKKE listet** |
| Prod curl headers | `HTTP 200`, `X-Lp-Mw-Skip-Auth: 1` |

### Parallelle dashboard-ruter

| Path | Auth | Data | Rolle |
| --- | --- | --- | --- |
| `app/(app)/dashboard/page.tsx` → `/dashboard` | **Ingen** (public) | **MOCK** | Demo/prototype |
| `app/admin/dashboard/page.tsx` → `/admin/dashboard` | `getUser()` + redirect | **LIVE** (`/api/admin/metrics/*`, company scope) | company_admin |
| `app/api/admin/dashboard/route.ts` | route guard | LIVE API | admin |
| `app/api/superadmin/dashboard/route.ts` | superadmin | LIVE | superadmin |

**Ingen** `/(authenticated)/dashboard` eller annen duplikat employee-dashboard.

### Prod curl — anonym bruker

```http
GET https://app.lunchportalen.no/dashboard
→ 200 OK · X-Lp-Mw-Skip-Auth: 1
```

**Synlig innhold (HTML):** «Acme AS», status ACTIVE, KPI «Bestillinger i dag: 84», «Aktive lokasjoner: 3», CTAs til `/week` og `/admin/people`. Ser ut som ekte firmadata — **men er statisk mock**.

### Beslutning

| Regel | Resultat |
| --- | --- |
| LIVE prod-data → P0, stopp Fase E | **NEI** — ingen tenant-data eksponert |
| HALV → P1, fortsett | Delvis (overlay HALV, core MOCK) |
| **MOCK → P1, fortsett** | **JA** |

**D-PAGE-01 forblir P1:** Route bør auth-gates eller fjernes/flyttes; `/dashboard` bør legges i `isProtectedPath` eller slettes til fordel for `/admin/dashboard` + `/week`. **30-d ticket:** remove-or-gate mock dashboard.

**Artifacts:** `.tmp/curl-dashboard-anon.html`

---

## D.1.5 Tier 2 MEDIUM — admin/settings (sample)

| Route | Linjer | Auth | Mobile signal |
| --- | ---: | --- | --- |
| `app/admin/dashboard/page.tsx` | ~200 | inline-auth | `mx-auto`, `px-4`, `md:` |
| `app/admin/companies/page.tsx` | frozen flow | layout guard | table + pagination 25 |
| `app/superadmin/system/page.tsx` | frozen | layout guard | health cards |
| `app/onboarding/page.tsx` | frozen | server validation 422 | mobile-first wizard |
| `app/leverandor/page.tsx` | provider | server | `ds-*` tokens (provider UI) |

*Full segment counts in `.tmp/d1-frontend-inventory.json`.*

---

## D.1.6 Tier 3 — loading/error-dekning

| Metrikk | Verdi | % av 207 pages |
| --- | ---: | ---: |
| Pages med ancestor `loading.tsx` | **~2 paths** | **<1%** |
| Pages med ancestor `error.tsx` | **~3 paths** | **~1%** |
| Global `app/error.tsx` | 1 | catch-all |

| ID | Sev | Funn |
| --- | --- | --- |
| D-UX-01 | **P1** | Nesten **ingen** route-level Suspense/loading boundaries — employee `/week` relies on client spinner only |
| D-UX-02 | P2 | Error boundaries kun admin/superadmin firms + root — kitchen/driver/week unprotected |

---

## D.1.7 Mobile-first (max-width vs min-width)

**Heuristikk:** Tailwind `md:`/`lg:` (min-width) vs `max-sm:` counts på Tier-1 pages.

| Page | `mx-auto` | `px-4` | `md:`+ | `max-sm:` | Vurdering |
| --- | --- | --- | ---: | ---: | --- |
| login | via AuthShell | via shell | 0 | 0 | Auth immersive OK |
| week (server) | ✓ | ✓ | 3 | 0 | **min-width-first** — stacks on mobile via default block |
| week (client) | ✓ | ✓ | many | few | Client handles one-hand UX |
| kitchen | partial | ✓ | 1 | 0 | Sidebar hidden mobile ✓ |
| admin/orders | ✓ | ✓ | 3 | 0 | Table scroll risk — delegated to OrdersTable |

**S1.2 alignment:** Week + login use centered containers. Dashboard inline styles **bypass** tailwind centering law.

---

# SUB D.2 — Components + a11y deep

## D.2.1 Component inventar (321 filer)

| Tier | Kriterium | Antall (approx) | Metode |
| --- | --- | ---: | --- |
| **T1 DEEP** | Forms, dialogs, nav, data-tables | ~45 | Fil-åpnet sample |
| **T2 MEDIUM** | Presentational + onClick | ~120 | grep `onClick`/`useState` |
| **T3 OVERFLATE** | Pure display / blocks | ~156 | remainder |

### T1 sample (fil-åpnet)

| Component | a11y notes | WCAG SC |
| --- | --- | --- |
| `components/ui/dialog.tsx` | Radix Dialog — focus trap, `DialogTitle` | **2.4.3 Focus Order**, **4.1.2 Name, Role, Value** |
| `components/ui/button.tsx` | `focus-visible:ring`, disabled states | **2.4.7 Focus Visible** |
| `components/nav/HeaderShellView.tsx` | Logo img, tabs `inline-flex`, 44px targets | **S10/S11** brand |
| `components/auth/AuthShell.tsx` | Single H1 via props, landmark structure | **1.3.1 Info and Relationships** |
| `components/admin/EmployeesTable.tsx` | Table semantics; mobile stack unclear | **1.4.10 Reflow** — **P2** |
| `components/onboarding/FirmaOnboardingWizard.tsx` | Step focus, primary CTA per screen | **S2 CRO** frozen |
| `components/week/EmployeeWeekClient.tsx` | Buttons ≥44px, `safeVibrate`, keyboard path partial | **2.5.5 Target Size** mostly OK |
| `components/admin/BlockedState.tsx` | Read-only blocked UI — calm copy | Fail-closed pattern ✓ |

| ID | Sev | Funn |
| --- | --- | --- |
| D-A11Y-01 | P2 | No systematic `eslint-plugin-jsx-a11y` report in audit — spot-check only |
| D-A11Y-02 | P2 | CMS/backoffice block editors — complex DnD; keyboard path not verified (T1 backlog) |
| D-A11Y-03 | P3 | `EmployeeWeekClient` habit nudge — motion/vibrate without reduced-motion check |

---

## D.2.2 Design-system tokens (`ds-*` / `lp-*`)

| Token family | Files in `components/` (grep) | Usage |
| --- | ---: | --- |
| `lp-*` classes / CSS vars | **~170+** component files | Primary enterprise UI (`lp-h1`, `--lp-border`, `button.tsx`) |
| `ds-*` | **~33** files | Concentrated in **provider/tripletex** (`components/provider/*`, `components/providers/*`) |

**Konklusjon:** **`lp-*` = kanonisk** app design system. **`ds-*` = provider portal subset** — not global. Mixed inline `style={{}}` on `(app)/dashboard` bypasses both (**D-PAGE-01**).

| ID | Sev | Funn |
| --- | --- | --- |
| D-DS-01 | P2 | Dual token namespaces (`lp-*` vs `ds-*`) — document boundary (employee vs leverandor) |
| D-DS-02 | P2 | Demo dashboard uses raw CSS vars (`--hotpink`) not `lp-*` primitives |

---

## D.2.3 Komponent-duplisering map (high-level)

| Cluster | Variants | Risk |
| --- | --- | --- |
| Superadmin headers/nav | `SuperadminHeader`, `SuperadminTopNav`, `SuperadminTabs`, `SuperadminMobileMenu` | Overlap — frozen header law applies to role shell only |
| Kitchen views | `KitchenView.tsx`, `KitchenRuntimeClient`, `KitchenProductionPanel`, `components/kitchen/KitchenView.tsx` | **3+ entry points** — P2 drift |
| Block renderers | `components/blocks/*`, `enterpriseRegistry/*`, CMS canvas frames | Large generated surface — intentional CMS |
| Auth status | `AuthStatus`, `AuthSlot`, `LogoutClient`, `LogoutButton` | Consolidated but scattered imports |
| Tripletex status | 8+ under `components/provider/tripletex-status/` | Coherent submodule ✓ |

| ID | Sev | Funn |
| --- | --- | --- |
| D-DUP-01 | P2 | Parallel `app/kitchen/KitchenView.tsx` vs `components/kitchen/KitchenView.tsx` |
| D-DUP-02 | P3 | Multiple superadmin nav primitives — cosmetic drift risk |

---

## D.2.4 WCAG SC-referanse (utvidet F2-12-pattern)

| Funn | SC | Alvorlighet |
| --- | --- | --- |
| Missing route loading announcements | 4.1.3 Status Messages | P2 |
| Table-heavy admin on 360px | 1.4.10 Reflow | P2 |
| Focus ring via `focus-visible:ring-pink` on week CTAs | 2.4.7 Focus Visible | Pass |
| Login form labels | 1.3.1, 3.3.2 Labels | Pass (LoginForm) |
| Image alt on `AuthBrand` / header logo | 1.1.1 Non-text Content | Pass (brand assets) |

---

## D.2.5 audit-v4.cjs supplement (AST)

**Kjørt:** `node audit-v4.cjs` 2026-05-25

| Metrikk | Verdi |
| --- | ---: |
| Files analyzed | 4038 |
| Dependency edges | 9461 |
| **Circular dependencies** | **6** |
| **Dead files (heuristic)** | **374** |
| Architecture score | **75 / 100** |

**Circular deps (sample):** `lib/social/*` chain (9 modules), `MarketingZigzagBlock` ↔ `renderBlock`, backoffice `SchemaDrivenBlockForm` ↔ `BlockEditModal`, `lib/ai/adaptiveLearning` ↔ `runnerGovernance`.

**Dead files (sample):** `workers/worker.ts`, `lib/enforce.ts`, `lib/tenant/guard.ts`, `sentry.*.config.ts` — **verify before delete** (may be runtime entry via dynamic import).

| ID | Sev | Funn |
| --- | --- | --- |
| D-AST-01 | P2 | 6 circular import cycles — break social/AI clusters first |
| D-AST-02 | P3 | 374 dead files flagged — includes test artifacts; cleanup is P3 hygiene |

---

# SUB D.3 — Perf + bundle + cross-cutting

## D.3.1 `perf/` mappe

| Path | Innhold |
| --- | --- |
| `perf/k6/README.md` | **Empty file** |
| `perf/k6/scenarios/` | 4 scenarios: `week_view.js`, `toggle.js`, `kitchen_day.js`, `mixed_spike.js` |
| `perf/k6/run-local.sh` / `.ps1` | Local runner scripts |
| `perf/k6/env.example` | Env template |

**Vurdering:** Legacy/minimal k6 scaffold. **Not maintained** (empty README).

---

## D.3.2 `perf/k6` vs `scripts/k6` — kanonisk?

| | `perf/k6/` | `scripts/k6/` |
| --- | --- | --- |
| Scenarios | 4 JS files | 6+ (`smoke`, `baseline`, `stress`, `soak`, `spike`, `recovery`) |
| Runner | shell/ps1 | **`run.mjs`** — env merge, JSON results, staging/prod URL |
| Provisioning | — | `provision-k6-pool.mjs`, auth preflight, DC-028 probes |
| Results | — | `scripts/k6/results/` (100+ run artifacts) |
| CI / ops | None found | Used in staging/prod load verification (SP-4) |

**Konklusjon:** **`scripts/k6/` er kanonisk.** `perf/k6/` = **deprecated duplicate** — aspirational leftover.

| ID | Sev | Funn |
| --- | --- | --- |
| D-PERF-01 | P3 | Duplicate k6 trees — consolidate or delete `perf/k6/` |
| D-PERF-02 | P1 (carry) | Pool margin under K6 100 VU — see C-POOL-01 |

---

## D.3.3 Bundle size (`npm run build:enterprise`)

**Kjørt:** 2026-05-25 · `npm run build:enterprise` · Next.js 15.5.18 · compiled in ~5.2 min · **PASS**

| Metrikk | Verdi |
| --- | ---: |
| Shared First Load JS | **187 kB** (gzip) |
| Middleware | **192 kB** |
| Enterprise build excludes | 32 route files (restored post-build) |

### Tier-1 routes (gzip First Load JS)

| Route | Page size | First Load JS |
| --- | ---: | ---: |
| `/login` | 1.98 kB | **196 kB** |
| `/week` | 16.3 kB | **205 kB** |
| `/kitchen` | 9.12 kB | **231 kB** |
| `/admin/orders` | 4.08 kB | **192 kB** |
| `/admin/dashboard` | 445 B | **189 kB** |
| `/driver` | 10.7 kB | **287 kB** (largest employee ops) |

### Heaviest app routes (outliers)

| Route | Page size | First Load JS |
| --- | ---: | ---: |
| `/superadmin/control-tower` | 60.3 kB | 249 kB |
| `/superadmin/system-graph` | 53.5 kB | 240 kB |
| `/driver` | 10.7 kB | **287 kB** |
| `/reset-password` | 4.76 kB | 252 kB |

**Vurdering:** Employee **week @ 205 kB** is within reasonable RC bounds (shared chunk 187 kB dominates). **Driver @ 287 kB** and superadmin graph/tower pages are P2 perf candidates. Week page-specific JS (16.3 kB) confirms `EmployeeWeekClient` weight.

**Full log:** `.tmp/d3-next-build.log`

---

## D.3.4 TypeScript strict-violations proxy

**Scan:** `scripts/audit/d3-ts-perf-scan.mjs` (3991 ts/tsx files, excl. node_modules/archive)

| Metrikk | Verdi |
| --- | ---: |
| `: any` occurrences | **1819** |
| Files with `: any` | **455** |
| `@ts-ignore` / `@ts-expect-error` | **1** (single file: `InviteClient.tsx`) |

**Top production offenders (not tests):**

| File | `: any` count |
| --- | ---: |
| `app/api/superadmin/system/repairs/run/route.ts` | 56 |
| `app/api/superadmin/system/flow/diagnostics/route.ts` | 28 |
| `app/api/onboarding/complete/route.ts` | 25 |
| `app/api/system/outbox/process/route.ts` | 18 |
| `app/api/order/window/route.ts` | 18 |
| `app/api/superadmin/companies/route.ts` | 16 |

| ID | Sev | Funn |
| --- | --- | --- |
| D-TS-01 | P2 | 1819× `: any` — undermines strict contract enforcement |
| D-TS-02 | P3 | Only 1 `@ts-ignore` — good discipline |

---

## D.3.5 Image optimization

| Metrikk | Verdi |
| --- | ---: |
| Raw `<img>` tags (tsx) | **19** occurrences |
| Files using `next/image` `<Image>` | **11** |

**`<img>` locations (sample):** backoffice CMS previews, `HeroSplit`, block canvas — mostly **editor/preview** contexts.

**Production header/logo:** Uses `next/image` via `HeaderShellView` / `AuthBrand` ✓ (S10/S11).

| ID | Sev | Funn |
| --- | --- | --- |
| D-IMG-01 | P2 | 19 raw `<img>` — acceptable in CMS preview; audit marketing pages separately (Fase G) |
| D-IMG-02 | P3 | Prefer `<Image>` for employee-facing menu photos in week client if not already optimized |

---

# Fase D — funn-oppsummering

| ID | Sev | Rolle | Funn |
| --- | --- | --- | --- |
| D-AUTH-01 | P2 | FRONTEND | Fragmentert route auth (inline vs routeGuard) |
| D-AUTH-02 | P2 | FRONTEND | 100 routes uten auth-heuristikk — allowlist audit needed |
| D-PAGE-01 | **P1** | FRONTEND | `/dashboard` MOCK demo public (middleware skip-auth) — misleading, not tenant leak |
| D-PAGE-02 | P2 | FRONTEND | week/page.tsx bloated with superadmin preview |
| D-PAGE-03 | P2 | FRONTEND | Duplicated role resolution on pages |
| D-UX-01 | **P1** | FRONTEND | <1% loading.tsx coverage |
| D-UX-02 | P2 | FRONTEND | Sparse error.tsx — week/kitchen unguarded |
| D-A11Y-01 | P2 | FRONTEND | No automated a11y gate in CI |
| D-A11Y-02 | P2 | FRONTEND | Backoffice DnD keyboard path unverified |
| D-DS-01 | P2 | FRONTEND | lp-* vs ds-* dual tokens |
| D-DUP-01 | P2 | FRONTEND | Duplicate KitchenView paths |
| D-AST-01 | P2 | FRONTEND | 6 circular deps (audit-v4) |
| D-PERF-01 | P3 | FRONTEND | perf/k6 duplicate of scripts/k6 |
| D-TS-01 | P2 | FRONTEND | 1819 `: any` across 455 files |
| D-IMG-01 | P2 | FRONTEND | 19 raw img tags |

---

## Completeness (D.1–D.3)

| Item | Status |
| --- | --- |
| D.1 All pages/routes counted | **COVERED** 207 + 543 |
| D.1 Tier 1 deep | **COVERED** login, week, kitchen, orders, auth API |
| D.1 Auth patterns | **COVERED** middleware + grep taxonomy |
| D.1 loading/error | **COVERED** 2/3/1 files |
| D.2 Components stratified | **COVERED** 321 inventory + T1 sample |
| D.2 a11y SC refs | **COVERED** spot deep |
| D.2 audit-v4 AST | **COVERED** |
| D.3 perf/k6 diff | **COVERED** |
| D.3 bundle sizes | **COVERED** — build PASS, table above |
| D.3 TS/img counts | **COVERED** |

---

## STOP-PUNKT D

**Fase D COMPLETE.** Bundle sizes verified via `build:enterprise` 2026-05-25.

*READ-ONLY — ingen kodeendringer i denne sesjonen.*
