# Enterprise Audit — Fase 0: Inventory & Baseline

**Date:** 2026-05-24 (post-marathon dag 5)  
**Scope:** READ-ONLY baseline for `app.lunchportalen.no` (Next.js/Supabase/Sanity) + `lunchportalen.no` (Umbraco)  
**Method:** Filesystem scan, `rg`, git, Supabase MCP (`hkpokyapzarefrgqzkos` prod, `uigxsboqeruxflgzqztl` staging), Vercel CLI  
**Git refs at crawl time:**

| Ref | SHA | Note |
| --- | --- | --- |
| `HEAD` (local main) | `2aeb7d9f` | 3 commits ahead of `origin/main` (DC-032 read-path fixes, unpushed) |
| `origin/main` | `3cf4e294` | Prod deploy baseline (K6 threshold) |
| `origin/staging` | `b708e545` | 3 app/lib commits not in main |

**Next phase:** Fase 1 BACKEND — await **GO Fase 1**

---

## Executive baseline signals

| # | Severity | Område | Funn | Bevis | Eier |
| --- | --- | --- | --- | --- | --- |
| F0-01 | **P1** | Migrasjon-ledger | **Null versjonsoverlapp** mellom `supabase/migrations/` fil-prefix og `schema_migrations` på prod (98/98) og staging (63/63). Repo er ikke deterministisk sporbar mot applied DB-state. | Se §0.5, appendiks A | [BACKEND+DEVOPS] |
| F0-02 | **P1** | Branch policy | `origin/staging` har **3 commits** i `app/`/`lib/` som ikke finnes på `origin/main` (DC-032 read-path). Gjentatt mønster fra marathon. | §0.6 git log | [DEVOPS] |
| F0-03 | **P1** | Env-paritet | **225** unike `process.env.*` i `app/`+`lib/` vs **38** Vercel env-navn vs **~15** keys i `.env.example`. Staging Supabase/Sanity-blokk kun på Vercel `staging` env (5d siden). | §0.7 | [DEVOPS] |
| F0-04 | **INVESTIGATE** | Schema drift | Prod **387** public functions vs staging **199** (samme tabell/view/trigger/policy-tall). | §0.4 SQL | [BACKEND] |
| F0-05 | **INVESTIGATE** | API auth surface | **69/536** routes uten åpenbar inline auth-guard (inkl. 12 superadmin stubs, 7 legacy `ai/*`). | §0.2 | [BACKEND] |
| F0-06 | **P2** | CI truth | `ci-enterprise.yml` har `continue-on-error: true` på build-steget; `audit:api`/`audit:repo` er non-blocking. Avvik fra `docs/RELEASE_GATE.md` som sier «No continue-on-error». | §0.6 | [DEVOPS] |
| F0-07 | **P2** | Komponent-størrelse | **15+** TSX-filer >800 linjer; størst `SocialEngineClient.tsx` **3230** linjer. | §0.3 | [FRONTEND] |
| F0-08 | **P2** | `.env.example` | Minimal dekning (~15 keys); mangler CRON, Sanity webhook, SMTP, Sentry, Tripletex runtime keys som finnes i Vercel/kode. | §0.7 | [DEVOPS] |

---

## 0.1 Repo-struktur

### Top-level (git tree, utvalg)

Monorepo **uten submodules** (`.gitmodules` finnes ikke). Primære pakker:

| Path | Rolle |
| --- | --- |
| `app/` | Next.js App Router (536 API routes, 207 pages) |
| `lib/` | 156 undermapper — server/domain/integrations |
| `components/` | 25 undermapper, 321 TSX |
| `supabase/migrations/` | 267 SQL-filer |
| `studio/` | Sanity Studio + 11 schemaTypes |
| `umbraco17/lunchportalen/` | Umbraco 17 CMS (Azure) |
| `tests/`, `e2e/` | Vitest + Playwright |
| `workers/` | Queue worker |
| `scripts/` | Audit, smoke, k6, sanity CLI |
| `.github/workflows/` | 15 workflows |

Andre top-level: `docs/`, `public/`, `config/`, `domain/`, `infra/`, `k8s/`, `cua/`, omfattende enterprise-policy markdown (AGENTS.md, SOC2, ISO, etc.).

### Nivå 2 — `app/`

```
(app)  (auth)  (backoffice)  (portal)  (public)
admin  api  auth  avtale-ikke-aktiv  driver  kitchen
leverandor  menus  min-side  onboarding  orders  outbox
pending  product  registrer  registrering  saas  status
styles  superadmin  system  today  vilkår
```

### Filer per språk (ekskl. `node_modules`, `.next`, Umbraco bin/obj)

| Språk | Filer |
| --- | ---: |
| `.ts` | 3 097 |
| `.tsx` | 918 |
| `.sql` | 316 |
| `.cs` | 24 |
| `.cshtml` | 72 |
| `.css` | 34 |

**Linjer kode (ts+tsx):** ~**410 985** (PowerShell `Get-Content | Measure-Object`; cloc ikke installert).

### Monorepo-struktur

| System | Deploy | Repo-path |
| --- | --- | --- |
| Next.js app | Vercel → `app.lunchportalen.no` | root |
| Sanity Studio | Sanity hosted / `studio/` | `studio/` |
| Umbraco CMS | Azure App Service `lunchportalen-umbraco` | `umbraco17/lunchportalen/` |

---

## 0.2 API route-inventar (Next.js)

**Totalt unike `app/api/**/route.ts`:** **536** (PowerShell dedupe; glob rapporterer 541 pga. `\`/` path-dup).

### Auth-mønster (frekvens i filer)

| Primitive / mønster | Filer | Kilde |
| --- | ---: | --- |
| `scopeOr401` | 358 | `lib/http/routeGuard.ts` |
| `requireRoleOr403` | 351 | `lib/http/routeGuard.ts` |
| `from "@/lib/http/routeGuard"` | 334 | |
| `requireCompanyScopeOr403` | 47 | tenant-scoped admin |
| `requireCronAuth` / `CRON_SECRET` | 33 / 25 | `lib/http/cronAuth.ts` |
| `auth.getUser()` direkte | 43 | bypasser routeGuard |
| `requireUser` / `getAuthContext` | 29 / 8 | alternate helpers |
| `isSuperadminProfile` inline | 18 | parallel dialect |

**Middleware:** `middleware.ts` + `lib/server/auth/apiAllowlist.ts` (83 allowlisted routes per post-marathon audit).

### Kategori etter path-prefix (utvalg)

| Prefix | Antall | Typisk auth |
| --- | ---: | --- |
| `superadmin/*` | 115 | routeGuard + superadmin **eller** inline `getUser`+`isSuperadminProfile` |
| `backoffice/*` | 90 | routeGuard, superadmin |
| `admin/*` | 52 | routeGuard + company scope |
| `cron/*` | 28 | `requireCronAuth` |
| `ai/*` | 30 | mixed; **7 uten guard** |
| `kitchen/*` | 19 | role `kitchen` |
| `public/*` | 11 | mostly open |
| `auth/*` | 14 | pre-auth flows |
| `webhooks/*` + billing webhook | 4 | signature/HMAC |
| `health/*` | 3 | **ingen auth** (probes) |

### Routes uten åpenbar inline auth-guard — **69**

**467/536 (87%)** har minst én av: `scopeOr401`, `requireRoleOr403`, `requireCompanyScopeOr403`, `auth.getUser`, cron/webhook verify, `isSuperadminProfile`, m.fl.

**69 uten åpenbar guard** — breakdown:

| Subkategori | Antall | Merknad |
| --- | ---: | --- |
| Health | 3 | Forventet |
| Public marketing/forms | 9 | Forventet CRO |
| Auth/onboarding | 8 | Pre-auth by design |
| Global CMS read | 2 | Public reads |
| Superadmin proxy/stubs | 12 | **Fase 1 review** — delegerer eller mangler? |
| Legacy `ai/*` | 7 | **Fase 1 review** |
| Proxy aliases (kitchen/order) | 5 | Guard i callee |
| Misc | 15 | contact, system/time, edge telemetry, … |

Full liste (69 paths):

```
accept-invite/complete  address/resolve  address/search
admin/accept-invite/complete  admin/agreements  admin/invites/lookup
admin/invites/register  ai/experiments  ai/generate  ai/image  ai/layout
ai/optimize  ai/page  ai/route  auth/accept-invite  auth/debug-cookies
auth/dev-bypass  auth/forgot-password  auth/register-company-admin  auth/session
company/create  contact  content/global/footer  content/global/header
driver/confirm  edge/ai  edge/metrics  experiments/assign  experiments/track
health  health/live  health/ready  kitchen/batch/upsert  kitchen/today
onboarding/complete  onboarding/terms-pdf  order/bulk-set  order/set-choice
order/set-day  outbox/retry  pitch  public/* (9)  register  saas/billing/webhook
social/redirect  social/track  superadmin/agreements/.../close|resume
superadmin/billing-accounts  superadmin/companies/.../activate|reject
superadmin/control-tower/domination|golive|monopoly
superadmin/invoices/mapping  superadmin/menu-publish  superadmin/quality(+update)
system/time  track/click  v1/public/orders
```

**Proxy-eksempel** (`app/api/kitchen/batch/upsert/route.ts` L8–14): delegerer POST til `../set/route` som har guard.

---

## 0.3 Komponent-inventar

| Metrikk | Antall |
| --- | ---: |
| `app/**/page.tsx` | 207 |
| `app/**/layout.tsx` | 16 |
| `components/**/*.tsx` | 321 |
| `'use client'` i `app/` | 316 |
| `'use client'` i `components/` | 189 |
| **Client total** | **505** |

Server vs client: ~59% av component-TSX er client (`189/321`). Mange client-filer i `app/` er `*-Client.tsx` og backoffice workspace-moduler.

### TSX >300 linjer — top 15

| Linjer | Fil |
| ---: | --- |
| 3 230 | `app/superadmin/growth/social/SocialEngineClient.tsx` |
| 2 141 | `app/(app)/week/EmployeeWeekClient.tsx` |
| 1 639 | `app/superadmin/sales/SalesCockpitClient.tsx` |
| 1 525 | `app/superadmin/control-tower/ControlTowerClient.tsx` |
| 1 399 | `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx` |
| 1 206 | `app/superadmin/companies/companies-client.tsx` |
| 1 168 | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceInspectorPanels.tsx` |
| 1 106 | `app/superadmin/system/SystemClient.tsx` |
| 1 100 | `components/blocks/EnterpriseLockedBlockView.tsx` |
| 1 004 | `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` |
| 964 | `app/driver/DriverClient.tsx` |
| 912 | `app/(backoffice)/backoffice/media/page.tsx` |
| 901 | `app/(backoffice)/backoffice/ai/overview/page.tsx` |
| 817 | `app/superadmin/system-graph/SystemGraphClient.tsx` |
| 809 | `components/ai-motor/AiMotorDemoShared.tsx` |

Størst `lib/*.tsx`: `lib/orders/OrderActionsProvider.tsx` (~356 linjer).

---

## 0.4 Supabase-skjema (MCP)

### Objekt-tellinger

| Objekt | Prod `hkpokyapzarefrgqzkos` | Staging `uigxsboqeruxflgzqztl` | Δ |
| --- | ---: | ---: | ---: |
| Tabeller (`public`) | 135 | 135 | 0 |
| Views | 19 | 19 | 0 |
| Functions | **387** | **199** | **+188 prod** |
| Triggers (non-internal) | 88 | 88 | 0 |
| RLS policies | 232 | 232 | 0 |
| Indexes | 480 | 483 | −3 staging |

**SQL (prod):**

```sql
SELECT 'prod' AS env,
  (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tables,
  (SELECT count(*) FROM pg_views WHERE schemaname='public') AS views,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public') AS functions,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS policies;
-- → tables=135, views=19, functions=387, policies=232
```

### Public-tabeller med rader (prod, `pg_stat_user_tables.n_live_tup`)

| Tabell | Rader (est.) |
| --- | ---: |
| `audit_log_y2026m05` | 18 968 |
| `audit_log_legacy` | 18 823 |
| `profile_scope_legacy_write_audit` | 3 453 |
| `ai_activity_log` | 1 993 |
| `profiles` | 39 |
| `companies` | 10 |
| `orders` | 5 |
| *(90+ tabeller med 0 rader)* | 0 |

**Staging topp (prod-scale testdata):**

| Tabell | Rader (est.) |
| --- | ---: |
| `audit_log_y2026m05` | 276 099 |
| `audit_events` | 1 691 |
| `companies` | 524 |
| `profiles` | 170 |
| `agreements` | 329 |
| `outbox` | 935 |

Prod er lav-trafikk RC; staging bærer syntetisk last/historikk.

---

## 0.5 Migrasjon-ledger

### Counts

| Kilde | Count | Siste versjon |
| --- | ---: | --- |
| Repo `supabase/migrations/*.sql` | **267 filer** / **245** unike versjon-prefix | `20260524130000_k6_prod_tenant.sql` (lokal, ikke i prod ledger) |
| Prod `schema_migrations` | **98** | `20260523232327` |
| Staging `schema_migrations` | **63** | `20260523212342` |

**22 filer** har non-standard navn (kort prefix, f.eks. `20260512_tier_per_day_v2.sql` → prefix `20260512`).

### Diff-matrise (versjon-prefix etter `filename.replace(/_.*$/, '')`)

| Set | Antall | Beskrivelse |
| --- | ---: | --- |
| I repo, **ikke** prod | **225** | Hele repo-historikk uten match i prod ledger |
| I repo, **ikke** staging | **245** | Alle repo-prefix |
| I prod, **ikke** repo | **98** | **Alle** prod-applied versjoner |
| I staging, **ikke** repo | **63** | **Alle** staging-applied versjoner |
| I staging, **ikke** prod | **62** | |
| I prod, **ikke** staging | **97** | |
| **Overlap prod ∩ staging** | **1** | `20260522041350` alene |

**Tolkning (deterministisk):** Prod og staging ble migrert med **squashed/re-timestamped** versjons-IDer som ikke matcher git-filnavn. Repo kan ikke brukes som eneste sannhet for «hva er applied» uten manuell schema-diff. Bekrefter marathon-funn om MCP-apply uten git-spor.

### Branch divergens (app/lib/migrations)

```
git log origin/main..origin/staging --oneline -- app/ lib/ types/ supabase/migrations/
b708e545 fix(dc-032): allow employee scope on orders/today GET/POST
dab42931 fix(dc-032): week profile select — drop missing disabled_reason column
e635940e fix(dc-032): use profiles.id (canonical) instead of profiles.user_id
```

Lokal `main` (`2aeb7d9f`) inkluderer disse fixene som cherry-picks; **ikke pushet** til `origin/main` per SP-4.6.

---

## 0.6 CI/CD-inventar

**15 workflows** i `.github/workflows/`:

| Workflow | Trigger | Blokkerer merge til main? | Gates (kort) |
| --- | --- | --- | --- |
| **`ci.yml`** | push/PR `main` | **Ja** (primary) | `ci:guard` → `ci:platform-guards` → typecheck → lint → `test:run` → `test:tenant` → `build:enterprise:ci`; audits informational |
| **`ci-enterprise.yml`** | push `main`, PR, cron 03:00 | **Ja** (release) | platform-guards, typecheck, tests, tenant, lint; `audit:api/repo` **non-blocking**; build step **`continue-on-error: true`** |
| `ci-e2e.yml` | push/PR `main` | Ja (e2e path) | typecheck, lint, build, Playwright |
| `ci-agents.yml` | push `main` | Partial | agents:check, typecheck, lint, tests; build non-blocking |
| `supabase-migrate.yml` | push all branches / main | Nei (deploy path) | migrate + verify + typegen |
| `rls-drift-check.yml` | scheduled/PR | Advisory | RLS drift |
| `security-audit.yml` | scheduled | Advisory | npm audit |
| `postdeploy.yml` | deploy hook | Post-deploy | `postdeploy` script |
| `main_lunchportalen-umbraco.yml` | push `main` umbraco paths | Umbraco only | dotnet build → Azure |
| `deps-weekly.yml` | cron | PR creation | `ci:critical` on deps PR |
| `automerge-lowrisk.yml` | bot | Auto-merge | policy |
| `policy-merge.yml` | bot | CUA merge | Python policy |
| `codex-audit-autofix.yml` | manual | Bot PRs | ci:critical |
| `codex-design-system.yml` | manual | Bot PRs | DS |
| `auto-engineer.yml` | manual | Bot | autonomous |

**Canonical local gate:** `npm run ci:critical` → `docs/RELEASE_GATE.md`

**Avvik F0-06:** `ci-enterprise.yml` L149–173 (`continue-on-error: true` på build); L130–132, L146–147 (audits non-blocking).

---

## 0.7 Env-var-inventar

### `.env.example` (git HEAD)

**~15 dokumenterte keys** (utdrag):

```
SYSTEM_MOTOR_SECRET, ADS_ENABLED, EMAIL_ENABLED, TRIPLETEX_ENABLED,
TRIPLETEX_FLOW_1_ENABLED, TRIPLETEX_REVENUE_DEFAULT_*,
SCALING_ENGINE_ENABLED, PROFIT_ENGINE_ENABLED, AI_OBSERVABILITY_PERSIST,
MONITORING_ENABLED, SLACK_WEBHOOK_URL, ALERT_EMAIL_ENABLED,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

(Direct read blocked locally — hentet via `git show HEAD:.env.example`.)

### Kode-referanser (`app/` + `lib/`)

**225** unike `process.env.*` navn (rg). Utvalg:

```
CRON_SECRET, SYSTEM_MOTOR_SECRET, NEXT_PUBLIC_SUPABASE_*,
SUPABASE_SERVICE_ROLE_KEY, SANITY_*, TRIPLETEX_*, SENTRY_*,
SMTP_*, LP_*, RESEND_*, VERCEL_*, E2E_* (tests), …
```

### Vercel `vercel env ls` (navn only, 2026-05-24)

**38 unike navn:**

```
CRON_SECRET, SYSTEM_MOTOR_SECRET,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD,
NEXT_PUBLIC_SANITY_*, SANITY_WRITE_TOKEN, SANITY_WEBHOOK_SECRET, SANITY_LIVE_URL,
NEXT_PUBLIC_APP_URL, PUBLIC_APP_URL,
SMTP_*, LP_SMTP_*, LP_RESEND_*, RESEND_API_KEY,
SENTRY_*, NEXT_PUBLIC_SENTRY_DSN,
TRIPLETEX_BASE_URL, TRIPLETEX_CONSUMER_TOKEN, TRIPLETEX_PROVIDER_ENV,
UMBRACO_CMS_ORIGIN, UMBRACO_DELIVERY_BASE_URL, UMBRACO_PUBLIC_SITE_URL
```

**Env-paritet-notater:**

| Observasjon | Detalj |
| --- | --- |
| Staging-only block | Supabase + Sanity + CRON + SYSTEM_MOTOR på Vercel env **`staging`** (5d siden) — separat fra prod/preview |
| `TRIPLETEX_FLOW_1_ENABLED` | I `.env.example`; **ikke** i Vercel-liste (bevisst usatt per DC-026) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | I `.env.example`; Vercel bruker `ANON_KEY` |
| ~187 kode-env uten Vercel entry | Feature flags, dev harness, test-only — mange forventet tomme lokalt |

---

## 0.8 Sanity-inventar

**Studio-path:** `studio/schemaTypes/index.ts`

| # | Schema type | Fil |
| --- | --- | --- |
| 1 | `provider` | `studio/schemaTypes/provider.ts` |
| 2 | `announcement` | `studio/schemaTypes/announcement.ts` |
| 3 | `menu` | `studio/schemaTypes/menu.ts` |
| 4 | `productPlan` | `studio/schemaTypes/productPlan.ts` |
| 5 | `weekTemplate` | `studio/schemaTypes/weekTemplate.ts` |
| 6 | `closedDate` | `studio/schemaTypes/closedDate.ts` |
| 7 | `page` | `studio/schemaTypes/page.ts` |
| 8 | `pricingInfo` | `studio/schemaTypes/pricingInfo.ts` |
| 9 | `lunchCategory` | `studio/schemaTypes/lunchCategory.ts` |
| 10 | `mealIdea` | `studio/schemaTypes/mealIdea.ts` |
| 11 | `menuDay` | `studio/schemaTypes/menuDay.ts` |

Legacy: `studio/schemas/dish.ts` (parallell path).

**Dokument-antall per type:** **INVESTIGATE** — Sanity CLI/API count ikke kjørt i denne sesjonen (krever `SANITY_READ_TOKEN` + GROQ).

---

## 0.9 Umbraco-inventar (lunchportalen.no)

**Path:** `umbraco17/lunchportalen/`  
**Deploy:** `.github/workflows/main_lunchportalen-umbraco.yml` → Azure Web App **`lunchportalen-umbraco`** (.NET 10)

| Artefakt | Antall | Merknad |
| --- | ---: | --- |
| `.cshtml` views | 72 | Block partials + page templates |
| `.cs` | 24 | Inkl. `Program.cs`; **ingen custom Controllers** i repo |
| `.css` (wwwroot) | 10+ | `design-system.css`, page-specific blocks |
| Page templates | 10+ | `HomePage`, `LandingPage`, `fordelerPage`, `losningenPage`, `komIGangPage`, `omOssPage`, `pricing`, `contact`, `demoPage`, `benefits` |

**Block partials (utvalg):** `_HeroBlock`, `_LandingPageHeroBlock`, `_Fordeler*Block` (5), `_Losningen*Block` (7), `_Priser*Block` (5), `_KomIGang*Block` (6), `_OmOss*Block` (6), `_Demo*Block` (6), `_CtaBandBlock`, `_FaqBlock`, `_Header`, `_Footer`, blockgrid/blocklist.

**Dokumenttyper:** Definert i Umbraco CMS (ikke i repo) — repo inneholder kun Razor views for block grid/list composition.

---

## Appendiks A — Migrasjon SQL (prod versjoner, full liste 98)

<details>
<summary>Prod schema_migrations (98)</summary>

```
20260507182933 … 20260523232327
(98 entries — ingen matcher repo-fil prefix; se MCP dump 2026-05-24)
```

</details>

<details>
<summary>Staging schema_migrations (63)</summary>

```
20260520000001 … 20260523212342
(63 entries — ingen matcher repo-fil prefix)
```

</details>

<details>
<summary>Overlap prod ∩ staging (1)</summary>

```
20260522041350
```

</details>

---

## Appendiks B — Supabase MCP queries

```sql
-- Object counts (prod)
SELECT count(*) FROM pg_tables WHERE schemaname='public';        -- 135
SELECT count(*) FROM pg_policies WHERE schemaname='public';      -- 232

-- Migration ledger
SELECT count(*), max(version) FROM supabase_migrations.schema_migrations;
-- prod: 98, 20260523232327
-- staging: 63, 20260523212342

-- Row estimates (prod)
SELECT relname, n_live_tup FROM pg_stat_user_tables
WHERE schemaname='public' ORDER BY n_live_tup DESC;
```

---

## Appendiks C — Verktøy & begrensninger

| Verktøy | Status |
| --- | --- |
| Supabase MCP | OK — prod + staging |
| Vercel CLI 50.22.1 | OK — `vercel env ls` |
| cloc | Ikke installert — linjetelling approx |
| Sanity CLI doc count | Ikke kjørt — INVESTIGATE |
| `.env.example` direct read | Permission denied — brukt `git show` |

---

## STOP-PUNKT 0

Fase 0 inventory er **levert**. Ingen kodeendringer utført.

**Vent på:** `GO Fase 1` for BACKEND/Supabase deep-audit (`01-backend.md`).
