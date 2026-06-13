# Staff Readiness Audit — Full End-to-End Sweep

**Dato:** 2026-05-28  
**Modus:** Read-only (ingen kode-/infra-endringer)  
**Sesjon:** Én kontinuerlig crawl (repo → Umbraco/Azure → Supabase → Sanity → Vercel/App → cross-cutting → E2E-flyter)  
**Målgruppe:** Thomas → kjøper / due diligence  
**Supersedes:** Delvise STOP-PUNKT-rapporter; denne filen er canonical full sweep.

---

## 1. EXECUTIVE SUMMARY

### Per system — Staff-grade + status (1 setning)

| System | Staff % | Status |
|--------|--------:|--------|
| **Repo / monorepo** | **65%** | Solid dokumentasjon og CI path-filter (7/16), men `main` ubeskyttet, `--no-verify` usynlig i Git, og `.audit-publish-out/` utenfor `.gitignore`. |
| **Umbraco (lunchportalen.no)** | **72%** | Blob media + V.27 deploy er Staff; Basic B1, ingen health check/App Insights/CDN, secrets i Git + App Settings. |
| **Supabase** | **64%** | 265 migrasjoner; **live drift verifisert** (190→232 policies, forventet post-2026-05-18); golden fortsatt stale; 33 private SECURITY DEFINER inventarert; 0 edge functions. Se [`audit-2026-05-28-live-verification.md`](./audit-2026-05-28-live-verification.md). |
| **Sanity** | **74%** | 11 document types, tier-modell kodifisert (Basis/Luxus/Enterprise), webhook til Supabase; `closedDate` stub, Enterprise auto-rollout gap. |
| **Vercel / Next.js app** | **68%** | 530 API-ruter, Sentry, enterprise gates; inline styles i prod-flater, tynn Playwright E2E (1 spec), security headers svake på edge. |
| **Cross-cutting** | **52%** | Fire auth-systemer, fire logg-siloer, ingen sentral tracing; secrets spredt (GH + Vercel + Azure App Settings). |
| **Ende-til-ende-flyter** | **70%** | Ordre/kjøkken/outbox/Tripletex traceable; onboarding/GDPR/cancel-paths har gaps. |

**Vektet helhet (subjektiv DD-vurdering): ~68% Staff-grade** *(oppdatert etter live verification 2026-05-28)*

### Total finn-count

| Status | Antall |
|--------|-------:|
| ✅ on Staff | **47** |
| ⚠️ partial | **62** |
| ❌ gap | **28** |
| ❓ unknown | **9** |
| **Total** | **156** |

### Top 10 critical findings (risk × DD-impact)

| # | Finn | System | Risk |
|---|------|--------|------|
| 1 | **`main` uten branch protection** (404 fra `gh api …/protection`) | Repo | critical |
| 2 | **`HMACSecretKey` committet** i `umbraco17/lunchportalen/appsettings.json` L46 | Umbraco | critical |
| 3 | **RLS golden snapshot stale** — live: **232 policies** vs golden **190** (+42 provider/billing, −4 esg_*); CI `rls-drift-check` **FAIL**; regenerering påkrevd | Supabase | critical |
| 4 | **`git push --no-verify` strukturelt usynlig** — 3 reelle F.4-bypasser (Thomas); ingen Git-revisjon | Repo | high |
| 5 | **Ingen CDN/WAF** foran `lunchportalen.no` — direkte `*.azurewebsites.net` | Umbraco | high |
| 6 | **Azure App Service Basic B1** — `alwaysOn: false`, ingen deployment slots | Umbraco | high |
| 7 | **`UnattendedUserPassword` i Azure App Settings** (klartekst; navn bekreftet via `az webapp config appsettings list`) | Umbraco | high |
| 8 | **`SUPABASE_SERVICE_ROLE_KEY` i GitHub repo secrets** + bred Vercel secret surface | Cross | high |
| 9 | **GDPR sletting = 202 request-only** — ingen automatisert erasure (`app/api/user/gdpr/delete/route.ts`) | App/E2E | high |
| 10 | **Ingen Application Insights / sentral APM** for Umbraco | Umbraco | medium-high |

### Top 10 quick wins (lav effort, høy verdi)

| # | Tiltak |
|---|--------|
| 1 | Aktiver branch protection på `main` + required CI checks |
| 2 | Legg `.audit-publish-out/` i `.gitignore` |
| 3 | Flytt `HMACSecretKey` ut av Git → Azure Key Vault / App Setting override |
| 4 | Regenerer `tests/rls/golden-rls-snapshot.json` + verifiser `npm run check:rls-drift` grønn |
| 5 | Fiks død favicon/og fallback `zkhfkr4f` i `_Layout.cshtml` L14 |
| 6 | Erstatt CODEOWNERS placeholder `@your-org/*` med faktisk team |
| 7 | Dokumenter tag-konvensjon i `FULL_PACKAGE.md` §2 (release vs sprint-backup) |
| 8 | Konfigurer App Service health check path (krever ofte SKU-løft) |
| 9 | Aktiver Dependabot security updates (disabled per `gh api security_and_analysis`) |
| 10 | Konsolider cancel HTTP paths til én canonical (`POST /api/orders` only) |

### Top 10 strategic gaps

| # | Gap |
|---|-----|
| 1 | Azure Standard SKU + deployment slots + always-on |
| 2 | Azure Front Door / WAF + edge caching for marketing site |
| 3 | Key Vault for alle Umbraco + Azure secrets |
| 4 | Single observability plane (App Insights + Vercel + Supabase → én dashboard) |
| 5 | SHA-pin alle GitHub Actions |
| 6 | `preflight` vs `preflight:integration` split (Tripletex/DB-test friksjon) |
| 7 | uSync `ImportAtStartup` policy for tvungen schema-flyt |
| 8 | Full Playwright E2E for order/login/onboarding critical paths |
| 9 | Automatisert GDPR erasure pipeline |
| 10 | SSO / identity consolidation (4 auth silos → roadmap) |

---

## 2. PER SYSTEM DETAIL

### 2.1 REPO — HELE

#### Topologi (deployable units)

| Path | Type | Deploy target |
|------|------|---------------|
| `app/`, `lib/`, `components/`, `middleware.ts`, `next.config.ts` | Next.js 15.5.18 App Router | Vercel → `app.lunchportalen.no` |
| `studio/` | Sanity Studio 11 schemas | `sanity deploy` / embedded |
| `umbraco17/lunchportalen/` | Umbraco 17.3.4 / .NET 10 | Azure App Service |
| `supabase/migrations/` | Postgres schema (265 SQL) | Supabase CLI / `supabase-migrate.yml` |
| `cua/` | Python policy merge | `policy-merge.yml` only |
| `scripts/` | CI/audit tooling | Not deployed |

**Top-level mapper (41):** `.audit-publish-out`, `.githooks`, `.github`, `app`, `components`, `config`, `cua`, `docs`, `domain`, `e2e`, `lib`, `perf`, `plugins`, `public`, `repo-intelligence`, `scripts`, `studio`, `supabase`, `tests`, `umbraco17`, … (+ genererte `.next`, `node_modules`, etc.)

#### CI/CD — alle 16 workflows

| Workflow | Kategori | Path-filter | Action pin | Node | Auth |
|----------|----------|-------------|------------|------|------|
| `ci.yml` | build/test | ✅ Next.js paths | `@v6` tags | 20 | — |
| `ci-agents.yml` | policy | ✅ | `@v6` | 20 | — |
| `ci-e2e.yml` | e2e | ✅ | `@v6` | 20 | GH secrets |
| `ci-enterprise.yml` | release gate | ✅ PR/push; cron global | `@v6` | 20 | — |
| `supabase-migrate.yml` | deploy DB | ✅ supabase | `@v6` | 20 | Supabase CLI |
| `main_lunchportalen-umbraco.yml` | deploy Umbraco | ✅ umbraco17 | `@v6`/`@v5` dotnet | FORCE_NODE24 | **OIDC** `azure/login@v3` |
| `postdeploy.yml` | smoke chain | bevisst (workflow_run) | `@v6` | 20 | — |
| `security-audit.yml` | security | bevisst (schedule) | `@v6` | 20 | — |
| `rls-drift-check.yml` | security | bevisst (schedule) | `@v6` | 20 | `DATABASE_URL` secret |
| `weekly-repo-intelligence-refresh.yml` | scheduled | bevisst | `@v6` | 20 | — |
| `deps-weekly.yml` | deps bot | bevisst | `@v6` | 20 | — |
| `codex-design-system.yml` | bot | bevisst | `@v6` | 20 | — |
| `codex-audit-autofix.yml` | bot | bevisst | `@v6` | 20 | — |
| `auto-engineer.yml` | bot | bevisst (dispatch) | `@v6` | 20 | — |
| `automerge-lowrisk.yml` | merge | bevisst (label) | `@v3` | — | — |
| `policy-merge.yml` | tooling | ✅ cua | `@v6`/`@v6` python | — | — |

**Branch protection:** ❌ `main` not protected (404). **Rulesets:** `[]`. **Force-push:** not blocked at GitHub level.

**GitHub secrets (18):** `AZURE_*`, `CRON_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_*`, `OPENAI_API_KEY`, `SANITY_WRITE_TOKEN`, `SUPABASE_*`, `SYSTEM_MOTOR_SECRET`, etc.

#### Hooks

| Hook | Innhold |
|------|---------|
| `.githooks/pre-push` | `npm run preflight` (ci:guard + agents + platform-guards + typecheck + **test:run** + lint + audit:api) |
| pre-commit / commit-msg | **Finnes ikke** |
| Install | Opt-in: `npm run hooks:install` → `core.hooksPath=.githooks` |

**`--no-verify`:** Push-flagg uten Git-spor. F.4: **3 reelle bypasser** (Thomas). DD: krever GitHub audit log / operativt register.

#### Secrets-arkeologi

| Kilde | Funn |
|-------|------|
| GH secret scanning | enabled, push protection on, **0 open alerts** |
| Dependabot security updates | **disabled** |
| gitleaks/trufflehog | gitleaks ✅ 772 hits (live); trufflehog ❌ ikke kjørt |
| **Git committed secret** | `Umbraco:CMS:Imaging:HMACSecretKey` i `appsettings.json` L46 |
| `.env` i `.gitignore` | ✅ `.env`, `.env.local`, templates whitelisted |

#### Dependency-helse

| Stack | Resultat |
|-------|----------|
| npm | **7 moderate** vulns (vite chain); `npm audit --audit-level=high` → 0 high |
| NuGet | `Umbraco.Cms 17.3.4` — **2 moderate** GHSA |
| depcheck | 2 unused deps (`@sanity/icons`, `fs-extra`); tailwind/postcss false-positive |
| audit-v4 | **345 dead files**, 6 circular deps, score **75/100** |
| Dependabot/Renovate config | **ingen** `.github/dependabot.yml` |

#### Tag-konvensjon

| Kategori | Tags |
|----------|------|
| Sprint backup (15) | `chore/sprint-ab-fase-*-complete`, `*-pre-backup` |
| Release-ish (3) | `rc-1.0.0`, `app-router-ui-v1`, `app-router-ui-v1.1` |
| Dokumentert (`FULL_PACKAGE.md` §2) | `v3.1.0-wow`, `rc-wow-YYYY-MM-DD` |
| **Drift** | Sprint-tags udokumentert parallell |

#### Repo funn-tabell (utvalg)

| Finn | Status | Bevis | Gap | Risk | DD |
|------|--------|-------|-----|------|-----|
| Monorepo docs | ✅ | `docs/architecture/monorepo.md` | — | low | nei |
| Path-filter F.3 | ✅ | 7/16 + 9 bevisst | — | low | nei |
| Branch protection | ❌ | `gh api …/protection` 404 | Ingen PR/CI-krav | critical | ja |
| `.audit-publish-out/` | ⚠️ | 195 untracked, ikke i `.gitignore` | Media-incident lærdom ufullstendig | medium | ja |
| SHA-pin actions | ⚠️ | 0 SHA pins i 16 workflows | Supply-chain | medium | ja |
| CODEOWNERS | ⚠️ | `@your-org/your-team` placeholder | Owner review inoperativ | low | ja |
| Pre-push scope | ⚠️ | Tripletex-tester i `test:run` | Falsk friksjon på Umbraco-only pushes | medium | ja |

---

### 2.2 UMBRACO — HELE

#### Repo-side

| Item | Bevis |
|------|-------|
| Target | `net10.0`, `Umbraco.Cms 17.3.4`, SeoToolkit 6.2.2, uSync 17.3.2 |
| uSync baseline | **234 filer** `uSync/v17/` (post-F.4) |
| `ImportAtStartup` | `"None"` (`appsettings.json` L53) |
| Blob | `Program.cs` L10–11 `AddAzureBlobMediaFileSystem` |
| Production URL | `appsettings.Production.json` → `https://lunchportalen.no` |
| CSS | 12 filer i `wwwroot/css/` (12–35 KB hver; `design-system.css` 28 KB) |
| Nullable warnings | **43× CS86xx** (~15 `.cshtml` filer) clean build |

#### Azure-side (`rg-lunchportalen-prod`)

| Item | Verdi |
|------|-------|
| App Service plan | **Basic B1**, capacity 1 |
| `alwaysOn` | **false** |
| `healthCheckPath` | **null** |
| `minTlsVersion` | 1.2 |
| `ftpsState` | FtpsOnly |
| Deployment slots | **[]** (ingen) |
| Custom domains | `lunchportalen.no`, `www.lunchportalen.no` — **SniEnabled** |
| App Settings (navn) | `Umbraco__CMS__Unattended__UnattendedUserPassword`, `UMBRACO__STORAGE__AZUREBLOB__MEDIA__CONNECTIONSTRING`, `ConnectionStrings__umbracoDbDSN_ProviderName`, … |
| App Insights env | **ingen** `APPINSIGHTS_*` i settings-liste |
| CDN/Front Door | `az resource list` → **[]** |
| DNS | `www` CNAME → `*.norwayeast-01.azurewebsites.net` |

#### SQL

| Database | Tier |
|----------|------|
| `lunchportalen-db-v2` | Standard S1 |
| `lunchportalen-db` | Basic |
| Server | `lunchportalen-sql` |

#### Blob (`lunchportalenmedia`)

| Item | Verdi |
|------|-------|
| HTTPS only | true |
| min TLS | TLS1_2 |
| Soft delete / versioning | **❓** `az storage account show` returnerte null for deleteRetentionPolicy — **trenger verifikasjon** mot portal/`blob-service-properties` |

#### Live HTTP (2026-05-28)

| URL | Resultat |
|-----|----------|
| `https://www.lunchportalen.no/` | 200; headers: `Server: Microsoft-IIS/10.0`, **ingen CSP/HSTS/X-Frame** i response |
| `robots.txt` | 200, 96 bytes |
| `sitemap.xml` | 200, 1631 bytes |
| `og:image` (CMS `jhifs4zf`) | **200** |
| Fallback `zkhfkr4f/favicon-16x16.png` | **404** (`_Layout.cshtml` L14) |

#### Umbraco funn-tabell

| Finn | Status | Bevis | Gap | Risk | DD |
|------|--------|-------|-----|------|-----|
| Blob media F.X.3 | ✅ | Blob provider + HTTP 200 media | Key Vault F.X.4 | low | nei |
| V.27 deploy | ✅ | `main_lunchportalen-umbraco.yml` stop→zip→start | — | low | nei |
| uSync baseline | ✅ | 234 filer Git | ImportAtStartup None | medium | ja |
| Secrets in Git | ❌ | `HMACSecretKey` appsettings.json | Key Vault | critical | ja |
| SKU Basic B1 | ❌ | `az appservice plan show` B1 | Slots/scaling/alwaysOn | high | ja |
| Health check | ❌ | `healthCheckPath: null` | — | medium | ja |
| CDN/WAF | ❌ | Ingen Front Door/CDN resource | DDoS/edge | high | ja |
| Security headers | ❌ | curl: kun Server/X-Powered-By | CSP/HSTS mangler | medium | ja |
| og/favicon fallback | ⚠️ | zkhfkr4f 404 | SEO/CRO | medium | ja |
| App Insights | ❌ | Ingen app setting | APM blind spot | medium | ja |
| SeoToolkit | ⚠️ | NuGet 6.2.2 + seoBase uSync | Runtime config ❓ | low | nei |

---

### 2.3 SUPABASE — HELE

#### Schema (repo)

| Item | Count |
|------|------:|
| Migrations (`supabase/migrations/*.sql`) | **265** |
| Rollback scripts (manual) | 5 |
| Edge functions (`supabase/functions/`) | **0** |
| Config PG version | **17** (`config.toml`) |

#### RLS — RØD START

| Dimension | Golden (2026-05-18) | Forventet live (inferert) |
|-----------|--------------------:|---------------------------|
| Policies | **190** | **~235+** (45+ nye CREATE POLICY post-golden) |
| `private.*` functions | **20** | **~28+** |
| RLS-enabled tables | **80** | **80+** (nye provider/billing tabeller) |
| Live drift check | **✅ kjørt** | `npm run check:rls-drift` → policies 190/232, private_functions 20/43, rls_tables 80/97; CI run `26604134837` exit 1 |

**Post-golden policy migrations (utvalg):** `20260520170001_provider_rls_core_policies.sql` (15), `20260530120000_tpt_b3_agreement_invoices.sql` (6), `20260609130000_dc019_enable_rls_tenant_tables.sql` (3), …

**Drift check script:** `scripts/check-rls-drift.mjs` — byte-for-byte mot `tests/rls/golden-rls-snapshot.json`.

#### Idempotency / outbox (repo-bevis)

| Mønster | Bevis |
|---------|-------|
| `lp_order_set` RPC | `lib/orders/rpcWrite.ts`; cutoff i `20260328100000_lp_order_set_*.sql` |
| `lp_idem_begin/complete` | `app/api/orders/route.ts`; migrations `20260516330000_*` |
| `public.idempotency` table | golden snapshot policies |
| `outbox` | 259 migration refs; `lib/orderBackup/outbox.ts`; cron + worker |

#### Auth config (`config.toml`)

| Setting | Verdi |
|---------|-------|
| JWT expiry | 3600s |
| Signup | enabled |
| Email confirmations | **off** (local config) |
| MFA | off |
| Realtime | enabled |
| Storage | enabled, 50MiB limit |

#### Supabase funn-tabell

| Finn | Status | Bevis | Gap | Risk | DD |
|------|--------|-------|-----|------|-----|
| Migration disiplin | ✅ | 265 SQL files | — | low | nei |
| Order RPC-only writes | ✅ | ci-guard + lp_order_set | — | low | nei |
| RLS golden current | ❌ | Snapshot 2026-05-18 | Regenerer + verifiser live | critical | ja |
| Live drift verified | ⚠️ | Live kjørt: drift **forventet** (golden stale); 46 nye provider-policies, 4 esg_* fjernet | Regenerer golden | critical | ja |
| Edge functions | ❌ | Live: **0** deployet (`supabase functions list`) | Tripletex i App API | medium | nei |
| SECURITY DEFINER audit | ✅ | Live: **33** private + **140** total SECDEF | — | medium | ja |
| PITR / backup | ❓ | Krever `SUPABASE_ACCESS_TOKEN` / dashboard | Thomas eskalering | medium | ja |

---

### 2.4 SANITY — HELE

#### Studio

| Item | Verdi |
|------|-------|
| Config | `studio/sanity.config.ts` |
| Document types | **11** (`provider`, `productPlan`, `menuDay`, `lunchCategory`, `mealIdea`, `menu`, `weekTemplate`, `closedDate`, `announcement`, `page`, `pricingInfo`) |
| Deploy | `studio/package.json`: `sanity deploy` |
| RC gate | `npm run sanity:live` i `build:enterprise` |

#### Varmrett tier-modell (Basis / Luxus / Enterprise)

| Lag | Representasjon |
|-----|----------------|
| Commercial plan | `productPlan.name`: `basis` \| `luxus` \| `enterprise` (lowercase) |
| Menu scoping | `menuDay.planTier`: `BASIS` \| `LUXUS` \| `ENTERPRISE` |
| Agreement runtime | Supabase `agreement_delivery_days` tier |
| Bridge | `lib/cms/getProductPlan.ts` → `cmsPlanNameForAgreementTier()` |
| Varmrett category | Sanity `varmrett` → order key `varmmat` (`menuDayContract.ts`) |
| Pricing | `lib/menu-publish/tierPricing.ts` — **90/130/170 NOK** (kode, ikke Sanity-felt) |
| Auto-rollout cron | BASIS + LUXUS varmrett only — **ENTERPRISE excluded** (`runMenuWeekRolloutCore.ts`) |

#### Webhook + cache

| Item | Bevis |
|------|-------|
| Webhook | `POST /api/webhooks/sanity/menu-day` + `SANITY_WEBHOOK_SECRET` |
| Sanity CDN | `useCdn: true` read client |
| Next revalidate | De fleste menu-ruter `revalidate=0`, `force-dynamic` |
| `revalidateTag` for Sanity | **ingen** |

#### Sanity funn-tabell

| Finn | Status | Bevis | Gap | Risk | DD |
|------|--------|-------|-----|------|-----|
| Schema registry | ✅ | 11 types in `schemaTypes/index.ts` | page/pricingInfo unused? | low | nei |
| Tier model documented in code | ✅ | Live: menuDay per BASIS/LUXUS/ENTERPRISE (121 docs); weekTemplate **0** | productPlan **0** i prod dataset | medium | ja |
| Webhook → Supabase sync | ✅ | `menu-day/route.ts` | — | low | nei |
| closedDate | ❌ | Schema exists; `getClosedDatesForDate()` returns `[]` stub | Stengte dager ikke live | medium | ja |
| External Sanity backup | ❓ | Built-in history only? | Export cron ❓ | low | ja |
| GROQ in lib/ not app/ | ✅ | `lib/cms/menuDay.ts` canonical | — | low | nei |

---

### 2.5 VERCEL / APP — HELE

#### Vercel (CLI 2026-05-28)

| Item | Bevis |
|------|-------|
| Project | `lunchportalen/lunchportalen` |
| Prod env vars (sample) | SENTRY_*, TRIPLETEX_*, SANITY_*, SUPABASE_*, SMTP_*, RESEND_*, SYSTEM_MOTOR (encrypted) |
| Health | `GET https://app.lunchportalen.no/api/health` → **200**, `x-vercel-id` present (Vercel) |

#### Next.js struktur

| Item | Count/bevis |
|------|-------------|
| Version | 15.5.18, App Router |
| API routes | **530** `app/api/**/route.ts` |
| `"use client"` files in `app/` | **~240+** |
| `"use server"` | **18** files |
| Inline `style={{` in `app/` | **~90+ matches** across 28 files (inkl. `(app)/dashboard` — **brudd på Thomas UI-regler**) |
| `prefers-reduced-motion` | Present in `app/globals.css`, `lib/ui/motion.css`, ds CSS |
| Middleware | `middleware.ts` — bypass paths, protected `/week`, `/admin`, `/superadmin`, `/kitchen`, `/driver`, API allowlist |
| Sentry | `@sentry/nextjs`, `sentry.server.config.ts`, `global-error.tsx` |
| Build gates | `ignoreBuildErrors: true`, `ignoreDuringBuilds: true` — gates kjøres separat |

#### Tests

| Type | Count |
|------|------:|
| Vitest (`tests/**/*.test.ts`) | **475** |
| Playwright (`e2e/`) | **1 spec** (`backoffice-content-tree-integrity.spec.ts`) |
| Critical flow E2E | Order/idempotency via **Vitest API tests**, ikke Playwright |

#### App security headers (curl prod)

| Header | `app.lunchportalen.no/` (live curl 2026-05-28) |
|--------|--------------------------------------------------|
| CSP | **mangler** |
| HSTS | **present** på `/login` (`max-age=63072000`); root `/` → 307 |
| X-Frame-Options | **mangler** |
| Server | **Vercel** |

#### App funn-tabell

| Finn | Status | Bevis | Gap | Risk | DD |
|------|--------|-------|-----|------|-----|
| Enterprise build gate | ✅ | `build:enterprise`, `ci:critical` | — | low | nei |
| API allowlist middleware | ✅ | `tests/security/no-implicit-bypass.test.ts` | — | low | nei |
| Sentry | ✅ | Vercel env + init | Sample rate ❓ | low | nei |
| Inline styles prod | ❌ | dashboard m.fl. | AGENTS.md S6 | medium | ja |
| Playwright E2E coverage | ❌ | 1 spec | Critical flows untested browser-level | high | ja |
| Security headers | ❌ | curl prod | CSP/HSTS | medium | ja |
| Typecheck/lint in build | ⚠️ | Separert fra next build | Risk of drift | low | nei |

---

### 2.6 CROSS-CUTTING — HELE

#### Auth silos (4)

| System | Mechanism |
|--------|-----------|
| Next.js app | Supabase Auth (cookies, SSR) |
| Umbraco backoffice | Umbraco Identity |
| Sanity Studio | Sanity project members + tokens |
| GitHub/Vercel/Azure | OIDC + PATs + service principals |

**SSO på tvers:** ❌ ikke implementert (`docs/enterprise/sso-roadmap.md` = roadmap)

#### Observability silos (4+)

| System | Logging |
|--------|---------|
| Umbraco | Serilog default; **ingen App Insights** |
| Vercel app | Vercel logs + Sentry |
| Supabase | Dashboard logs |
| Sanity | Platform logs |
| **Aggregert dashboard** | **❌ ingen** |

#### Secrets inventory (navn only)

| Location | Eksempler |
|----------|-----------|
| GitHub Actions secrets | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SANITY_WRITE_TOKEN` |
| Vercel encrypted env | SENTRY_*, TRIPLETEX_*, SMTP_*, SUPABASE_DB_PASSWORD |
| Azure App Settings | Unattended password, Blob connection string, SQL DSN |
| **Git repo** | **HMACSecretKey** (critical) |

#### Compliance / DR

| Item | Status |
|------|--------|
| GDPR export | `GET /api/user/gdpr/export` — minimal profiles projection |
| GDPR delete | `POST /api/user/gdpr/delete` — **202 manual RC** |
| Data residency | Azure **Norway East** ✅; Supabase **West EU (Ireland)** ✅; Vercel **iad1 (US East)** ⚠️; Sanity **❓** |
| RTO/RPO dokumentert | `docs/security/incident/disaster-recovery-plan.md` — **❓ restore tested** |
| Restore tested | **❓ trenger Thomas** |

---

### 2.7 ENDE-TIL-ENDE-FLYTER — TRACE-ED

| # | Flyt | Status | Kjernesti (kort) | E2E test | Audit | Idempotency |
|---|------|--------|------------------|----------|-------|-------------|
| 1 | Bedrift onboarding | ⚠️ | `PublicRegistrationForm` → `POST /api/public/register-company` → `lp_company_register` → superadmin approve → outbox email | `registration-flow-smoke.test.ts` (client only) | outbox + lifecycle | outbox event_key |
| 2 | Ansatt invite | ✅ | `admin/employees/invites/bulk` → email → `accept-invite` → `auth.admin.createUser` | unit tests only | partial | invite dedup |
| 3 | Meny visning tier | ✅ | `GET /api/week` → Sanity `getMenuForDates` + agreement daymap | `employeeWeekMenuDays.test.ts` | opsLog | N/A read |
| 4 | Bestilling | ✅ | `EmployeeWeekClient` L1907 → `POST /api/orders` → `lp_idem_*` → `lp_order_set` | `orders-idempotency.test.ts` | outbox in RPC | idem header + DB |
| 5 | Avbestilling | ⚠️ | **3 HTTP paths** — canonical week uses `POST /api/orders` CANCEL | `order-flow-api.test.ts` | partial | RPC idempotent |
| 6 | Kjøkken | ✅ | `GET /api/kitchen/day` → `loadOperativeKitchenOrders` | `kitchen-api-envelope.test.ts` | read-only | N/A |
| 7 | Leveranse/outbox | ✅ | order outbox → cron → `system/outbox/process` → driver stops | `driver-flow-quality.test.ts` | outbox + cron_runs | event_key |
| 8 | Tripletex faktura | ✅ | cron agreements → `lp_run_daily_agreement_billing` → outbox worker → Tripletex client | DB tests | lifecycle_audit_log | period dedup |
| 9 | Admin RBAC | ✅ | `admin/layout.tsx` guard → `/api/admin/metrics` role check | `roleIsolationEndpoints.test.ts` | partial | N/A |
| 10 | GDPR | ⚠️ | export minimal; delete = request queue only | helper test only | delete requested event | N/A |

#### Flyt 4 — Bestilling (detaljert trace)

```
EmployeeWeekClient.tsx:1900-1911  POST /api/orders + Idempotency-Key
  → app/api/orders/route.ts:362-427  lp_idem_begin → lp_order_set
    → supabase RPC lp_order_set (migration 20260328100000 L78-82 cutoff)
      → outbox order.changed:* (20260218 migration L1127-1172)
```

#### Flyt 8 — Tripletex (detaljert trace)

```
app/api/cron/tripletex-agreements-daily/route.ts:65  lp_run_daily_agreement_billing
  → app/api/cron/invoices/generate/route.ts  invoice periods
    → app/api/cron/tripletex-outbox/route.ts
      → app/api/system/outbox/process/route.ts:641-870
        → lib/integrations/tripletex/client.ts
```

---

## 3. ❓ UNKNOWNS (Thomas-avklaring, sortert blocking-impact)

| # | Unknown | Blocking for |
|---|---------|--------------|
| 1 | **Supabase PITR retention + last restore test date** — Management API krever `SUPABASE_ACCESS_TOKEN` | DR DD |
| 2 | **Sanity webhooks/CORS/members** — token mangler grants (`webhooks:read`, `cors:read`) | CMS ops DD |
| 3 | **E2E order flow live** — ingen test/staging-bruker for read-only API-verifisering | App DD |
| 4 | **Blob soft-delete 30d + versioning** — CLI returned null; portal says F.X.3 done | Umbraco media DR |
| 5 | **Sanity project region** + **Vercel iad1 (US)** compliance narrative | Compliance DD |
| 6 | **uSync import runbook** after schema PR merge | Umbraco ops |
| 7 | **SeoToolkit runtime config** (redirects/sitemap active in backoffice?) | SEO DD |
| 8 | **Monthly cloud burn** — `az consumption usage list` → GatewayTimeout (~494s); Vercel/Supabase billing API ikke kjørt | Cost DD |
| 9 | **Pen test** — executed? when? findings? | Security DD |
| 10 | **Stripe/Vipps** — planned for onboarding or out of scope? | Flow 1 commercial |
| 11 | **trufflehog** — ikke installert; union med gitleaks uverifisert | Secrets DD |
| 12 | **Azure managed cert renewal** ownership | TLS ops |
| 13 | **ENTERPRISE menuDay auto-rollout** — manual WeekPlanner only? | Sanity ops |
| 14 | **Multi-provider Sanity** production behavior | Menu isolation |
| 15 | **Restore drill** — any system ever restored from backup? | DR DD |

---

## 4. PRIORITERT ROADMAP

### Sprint 0 — DD blockers (1–2 dager)

1. Branch protection + required checks on `main`
2. Remove/rotate `HMACSecretKey` from Git history + move to Key Vault
3. Regenerate RLS golden + document live policy inventory
4. Fix CODEOWNERS + `.gitignore` `.audit-publish-out/`

### Sprint 1 — Hardening (1 uke)

5. Umbraco: health check + App Insights + fix zkhfkr4f fallback
6. Document `--no-verify` policy + GitHub push audit review for F.4 window
7. Split preflight integration tests
8. Enable Dependabot security updates
9. CSP/HSTS baseline on Umbraco + Vercel

### Sprint 2 — Structural (2–4 uker)

10. Azure Standard + slots + Front Door/WAF
11. Playwright E2E: login → week → order → cancel
12. GDPR automated erasure design
13. SHA-pin GitHub Actions
14. Observability v1 single dashboard (K3 scope)

### Strategic (quarter)

15. SSO roadmap execution
16. Identity consolidation plan
17. Full restore drill + RTO/RPO attestation
18. Pen test + remediate

### Cross-cutting backlog (HOTFIX-C supplement, 2026-05-29)

| Flag | Item | Notes |
|------|------|-------|
| **Medium (DD)** | CLI-pin-strategi for `supabase-cli` | Pin i `.github/workflows/supabase-migrate.yml` skaper config-format-fragilitet (`config.toml`-nøkler vs CLI-versjon). Vurdér Dependabot/Renovate på workflow-filen for automatiske bump-PR-er ved nye CLI-releases. |
| **Lav (DD)** | `onnxruntime-node` som CI-dep | Postinstall henter binærer via CDN — ga `ETIMEDOUT` i supabase-migrate run 26640909257 (2026-05-29). Undersøk `npm ls onnxruntime-node` om avhengigheten er ekstraherbar, eller legg retry-wrapper rundt `npm ci`-steget. |

---

## Appendix A — Verktøy / tilgang denne sesjonen

| Verktøy | Status |
|---------|--------|
| `gh` CLI | ✅ |
| `az` CLI | ✅ (rg-lunchportalen-prod) |
| `vercel` CLI | ✅ |
| `curl`/`Invoke-WebRequest` prod | ✅ |
| `dotnet build` Umbraco | ✅ |
| `npm audit` | ✅ |
| `DATABASE_URL` local | ✅ via `.env.local` — live Postgres queries kjørt |
| gitleaks | ✅ v8.30.1 — 772 findings (759 uSync FP + HMACSecretKey) |
| trufflehog | ❌ — eskalér (scoop/Docker) |
| Lighthouse prod | ✅ — Perf 71–79 på forsider + login (se live-verification §4) |
| openssl | ❌ — TLS via PowerShell SslStream |
| Supabase Management API | ❌ — `SUPABASE_ACCESS_TOKEN` mangler |
| Supabase MCP | ❌ no tool descriptors in workspace |

---

## Appendix B — Thomas bekreftelser (fra tidligere faser)

- F.4: **3 reelle `git push --no-verify`** — strukturelt usynlige i Git
- Hooks: én utvikler; formaliseres ved team-utvidelse
- CODEOWNERS: placeholder, trivielt fix

---

---

## Appendix C — Live verification supplement

Full runtime state (Postgres, Sanity GROQ, Vercel, Lighthouse, gitleaks, TLS) dokumentert i:

**[`audit-2026-05-28-live-verification.md`](./audit-2026-05-28-live-verification.md)**

*Generert read-only — Staff Readiness Full Sweep — Cursor, 2026-05-28. Oppdatert etter live verification samme dag.*
