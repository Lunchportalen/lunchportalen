# Staff Readiness — Live Runtime Verification

**Dato:** 2026-05-28  
**Modus:** Read-only (ingen kode-/infra-endringer)  
**Supplement til:** [`audit-2026-05-28-full-sweep.md`](./audit-2026-05-28-full-sweep.md)  
**Kontrakt:** Hver rad har **kommando-output** som bevis (verdier redactet der relevant). Ingen «repo sier X».

---

## 0. Tooling — status og eskaleringer

| Verktøy | Status | Bevis |
|---------|--------|-------|
| `DATABASE_URL` / `SUPABASE_POSTGRES_URL` | ✅ | `node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.DATABASE_URL?.slice(0,45)+'...')"` → `DATABASE_URL=postgresql://postgres.hkpok...` |
| `psql` | ✅ | Via Scoop; live queries kjørt via `node .tmp/run-live-db.mjs` (pg client) |
| `gitleaks` v8.30.1 | ✅ | `gitleaks detect --source . --redact` → `821 commits scanned … leaks found: 772` |
| `trufflehog` | ❌ **ESKALER** | Ikke installert; Docker daemon ikke kjørende. **Trenger:** `scoop install trufflehog` eller Docker + `trufflehog filesystem .` |
| `lighthouse` | ✅ (npx) | `npx lighthouse@12.8.2 … --output=json` → scores i §4 |
| Sanity CLI | ⚠️ delvis | `npx sanity projects list` → `4udoq5d8 Lunchportalen`; `sanity whoami` finnes ikke i v4 CLI |
| Supabase CLI v2.75.0 | ✅ delvis | `supabase projects list` → linked `hkpokyapzarefrgqzkos`; `supabase functions list` → **0 functions** |
| `SUPABASE_ACCESS_TOKEN` | ❌ **ESKALER** | Ikke i `.env.local`. **Trenger:** Personal access token for Management API (buckets, auth config, PITR, usage) |
| Vercel CLI v50.22.1 | ✅ | `vercel list lunchportalen`, `vercel inspect`, `vercel env ls production` |
| `az` CLI | ✅ | Subscription aktiv; `az webapp show …` → Norway East |
| `curl` | ✅ | v8.19.0; headers i §4 |
| `openssl` | ❌ **ESKALER** | Ikke i PATH. **Workaround:** PowerShell `SslStream` for TLS (§4c). **Trenger:** `scoop install openssl` for `openssl s_client` |
| Docker | ❌ | Daemon ikke kjørende — blokkerte trufflehog-container |

---

## 1. Supabase — live state (prod `hkpokyapzarefrgqzkos`)

**Region (live):** West EU (Ireland) — `supabase projects list` output.

### 1a. RLS coverage

| Resultat | Bevis |
|----------|-------|
| **37** `public`-tabeller med `rowsecurity=false` — **kun** `audit_log_y*` partisjoner + `audit_log_y_default` | `node .tmp/run-live-db.mjs` → `"rls_disabled": 37`; alle tabellnavn matcher `audit_log_y*` |
| Ingen core business-tabell (`orders`, `companies`, `agreements`, …) uten RLS | Samme query; ingen andre `tablename` i output |

### 1b. RLS drift (golden vs live)

| Dimensjon | Golden | Live | Bevis |
|-----------|-------:|-----:|-------|
| Policies | 190 | 232 | `npm run check:rls-drift` → `"policies": {"golden": 190, "live": 232}` |
| Private functions | 20 | 43 | `"private_functions": {"golden": 20, "live": 43}` |
| RLS-enabled tables | 80 | 97 | `"rls_enabled_tables": {"golden": 80, "live": 97}` |
| Project ref | match | `hkpokyapzarefrgqzkos` | `"project_ref": {"golden": "…zkos", "live": "…zkos"}` |
| PG version | GCC 13.2.0 | GCC 15.2.0 | `"postgres_version"` mismatch (minor compiler drift) |
| CI workflow | **FAIL exit 1** | `gh run list --workflow=rls-drift-check.yml` → run `26604134837` failure; log: `"ok": false` |

**Policies kun i live (46)** — post-2026-05-18 migrasjoner (provider/billing scope):

```
agreement_invoice_lines|agreement_invoice_lines_company_admin_select
agreement_invoice_lines|agreement_invoice_lines_provider_select
… (46 totalt — full liste: node .tmp/rls-diff.mjs → only_live_policies)
providers|providers_superadmin_all
tripletex_exports|tripletex_exports_tenant_select
```

**Policies kun i golden (4)** — fjernet på live:

```
esg_daily|esg_daily_select
esg_daily|esg_daily_write_superadmin
esg_monthly|esg_monthly_select
esg_monthly|esg_monthly_write_superadmin
```

**Vurdering:** Drift er **forventet** (golden stale @ 2026-05-18). Ingen uventet tenant-lekkasje-indikator i diff — alle nye policies er provider/billing-scoped. **Action:** regenerer golden etter sign-off.

### 1c. SECURITY DEFINER (live)

| Resultat | Bevis |
|----------|-------|
| **140** total (`public`+`private`+`app`+`lp`) | `node .tmp/run-live-db.mjs` → `"security_definer": 140` |
| **33** i `private` schema (canonical tenant guards) | `node -e "…priv=j.security_definer.filter(x=>x.schema==='private')…"` |

**Alle `private.*` SECURITY DEFINER (33):**

```
can_access_company(_company_id uuid)
can_access_delivery_run(_delivery_run_id uuid)
can_access_location(_location_id uuid)
can_access_menu_day(_menu_service_day_id uuid)
can_edit_order(_order_id uuid)
can_finance_company(_company_id uuid)
can_manage_company(_company_id uuid)
can_manage_location(_location_id uuid)
can_manage_menu_day(_menu_service_day_id uuid)
can_operate_delivery_run(_delivery_run_id uuid)
can_view_order(_order_id uuid)
can_view_profile(_profile_id uuid)
ensure_audit_log_partitions(months_ahead integer)
has_platform_role(_roles platform_role[])
is_platform_admin()
lp_assert_provider_admin_access(p_provider_id uuid)
lp_assert_provider_admin_or_superadmin(p_provider_id uuid)
lp_assert_provider_kitchen_access(p_provider_id uuid)
lp_assert_provider_member_read(p_provider_id uuid)
lp_assert_registration_approve_access(p_registration_id uuid)
lp_assert_user_lifecycle_access(…)
lp_enqueue_agreement_invoice_outbox(…)
lp_enqueue_saas_invoice_outbox(…)
lp_generate_agreement_invoice_core(…)
lp_lifecycle_audit(…)
lp_orders_cancel_active(…)
lp_orders_pause_active(…)
lp_orders_resume_paused(…)
lp_provider_tripletex_credentials_vault_cleanup()
lp_provider_webhook_secret_vault_cleanup()
lp_tripletex_onboarding_audit(…)
lp_tripletex_transition_connection_state(…)
shares_company_with(_other_user_id uuid)
```

### 1d. Triggers (live)

| Resultat | Bevis |
|----------|-------|
| **157** triggers totalt | `node .tmp/run-live-db.mjs` → `"triggers": 157` |
| Fordeling | `public`: 150, `realtime`: 2, `storage`: 5 |

### 1e. Index helse

| Resultat | Bevis |
|----------|-------|
| **30** indexer med `idx_scan=0` (sample LIMIT 30) | `"unused_indexes": 30` i live-db.json |
| **0** tabeller med `seq_scan > idx_scan AND n_live_tup > 1000` | `"seq_vs_idx": []` |

### 1f. FK uten støttende index

| table_name | fk_name | fk_column |
|------------|---------|-----------|
| companies | companies_paused_by_fkey | paused_by |
| companies | companies_suspended_by_fkey | suspended_by |
| profiles | profiles_suspended_by_fkey | suspended_by |
| billing_products | billing_products_tax_code_id_fkey | tax_code_id |
| providers | providers_paused_by_fkey | paused_by |
| providers | providers_suspended_by_fkey | suspended_by |
| provider_subscriptions | provider_subscriptions_created_by_fkey | created_by |
| provider_subscriptions | provider_subscriptions_tax_code_id_fkey | tax_code_id |
| provider_invoices | provider_invoices_subscription_id_fkey | subscription_id |
| provider_invoices | provider_invoices_tax_code_id_fkey | tax_code_id |
| agreement_invoice_lines | agreement_invoice_lines_tax_code_id_fkey | tax_code_id |

**Bevis:** `node .tmp/run-live-db.mjs` → `"fk_missing": 11` (full liste over).

### 1g. Table scan vs index scan

| Resultat | Bevis |
|----------|-------|
| Ingen kritiske seq-scan-dominerende tabeller (>1000 rows) | `"seq_vs_idx": []` |

### 1h. Slow queries (`pg_stat_statements`)

| Resultat | Bevis |
|----------|-------|
| Extension **enabled** | `"pg_stat_statements": "enabled"` |
| Topp etter total tid | INSERT profiles: 210523ms total / 512 calls; DELETE auth.users: 179382ms / 124076 calls; bulk DELETE location_memberships (test cleanup?): 125051ms / 2 calls |

### 1i. Realtime publication

| Resultat | Bevis |
|----------|-------|
| **0 rader** i `pg_publication_tables` | `"publication": []` — Realtime enabled i config.toml men ingen publiserte tabeller registrert i denne view |

### 1j. Row counts (kritiske tabeller)

| Tabell | count | Bevis |
|--------|------:|-------|
| orders | 1 | `SELECT count(*) FROM public.orders` via run-live-db |
| profiles | 170 | (users proxy) |
| companies | 524 | |
| agreements | 329 | |
| kitchens | N/A | `relation "public.kitchens" does not exist` |
| deliveries | 0 | |
| invoices | 0 | |
| outbox | 937 | |
| audit_log | 276058 | |
| lifecycle_audit_log | 1293 | |
| idempotency | 0 | |

### 1k. Storage buckets

| Status | Bevis |
|--------|-------|
| ❌ **ESKALER** — krever `SUPABASE_ACCESS_TOKEN` | Service role mot Storage API → 403 signature verification; Management API `GET /v1/projects/{ref}/buckets` ikke kjørt |

### 1l. Auth providers

| Status | Bevis |
|--------|-------|
| ❌ **ESKALER** — krever `SUPABASE_ACCESS_TOKEN` | `GET /v1/projects/hkpokyapzarefrgqzkos/config/auth` ikke kjørt |

### 1m. Edge functions

| Resultat | Bevis |
|----------|-------|
| **0 edge functions** deployet | `supabase functions list --project-ref hkpokyapzarefrgqzkos` → tom tabell (kun header) |

### 1n. PITR / backups

| Status | Bevis |
|--------|-------|
| ❌ **ESKALER** — krever Management API eller dashboard | `GET /v1/projects/{ref}/database/backups` ikke kjørt |

---

## 2. Sanity — live state (`4udoq5d8` / `production`)

### 2a. Auth / projects

| Resultat | Bevis |
|----------|-------|
| Prosjekt funnet, **7 members** | `npx sanity projects list` → `4udoq5d8 … members 7 … Lunchportalen` |
| `sanity whoami` | ❌ `whoami is not a sanity command` (CLI v4) — auth implisitt OK via token i `.env.local` |

### 2b. Dataset

| Resultat | Bevis |
|----------|-------|
| Dataset `production` (via env + GROQ) | `node .tmp/sanity-live.mjs` → `"dataset": "production"` |

### 2c. Document type counts (live GROQ)

| Type | count | Bevis |
|------|------:|-------|
| provider | 1 | `node .tmp/sanity-live.mjs` |
| productPlan | 0 | |
| menuDay | 121 | |
| lunchCategory | 6 | |
| mealIdea | 1000 | |
| menu | 0 | |
| weekTemplate | 0 | |
| closedDate | 0 | |
| announcement | 0 | |
| page | 0 | |
| pricingInfo | 0 | |

### 2d. Tier exemplars

| Tier | Live dokumenter? | Bevis |
|------|------------------|-------|
| BASIS | ✅ 3× menuDay (2026-06-15..17) | `"tiers.BASIS"` i sanity-live output |
| LUXUS | ✅ 3× menuDay (2026-06-15..17) | `"tiers.LUXUS"` |
| ENTERPRISE | ✅ 3× menuDay (2026-06-05 thai/sushi/varmrett) | `"tiers.ENTERPRISE"` |
| weekTemplate per tier | ❌ **0** for alle | `"weekTemplate": {"BASIS":[],"LUXUS":[],"ENTERPRISE":[]}` |

### 2e. Broken refs

| Status | Bevis |
|--------|-------|
| ❓ Ikke kjørt denne sesjonen | Krever dedikert GROQ per ref-felt — eskalert som lav-prioritet gap |

### 2f. Webhooks (Manage API)

| Status | Bevis |
|--------|-------|
| ❌ **ESKALER** — token mangler grant | `GET …/hooks/projects/4udoq5d8` → `401 … grant sanity.project.webhooks/read` |

**Trenger:** Sanity token med `webhooks:read` eller manuell eksport fra Manage UI.

### 2g. Members + roles

| Resultat | Bevis |
|----------|-------|
| **7 members** (antall) | `sanity projects list` → `members 7` |
| Roller / last activity | ❓ Krever `GET /v2021-06-07/projects/4udoq5d8/members` med riktig grant |

### 2h. Tokens

| Status | Bevis |
|--------|-------|
| ❓ | `sanity hook ls` / Manage UI ikke kjørt — eskalér til Thomas for token-inventar |

### 2i. CORS origins

| Status | Bevis |
|--------|-------|
| ❌ **ESKALER** | `GET …/projects/4udoq5d8/cors` → `401 … grant sanity.project.cors/read` |

---

## 3. Vercel — live state

### 3a. Deployments (siste)

| Age | Environment | Status | Duration | Bevis |
|-----|-------------|--------|----------|-------|
| 1h | Preview | Ready | 4m | `vercel list lunchportalen` |
| 2h | **Production** | Ready | 3m | `lunchportalen-j4b43ye02-lunchportalen.vercel.app` |
| 5h | Production | Ready | 3m | |
| … | (14+ flere) | Ready | 2–5m | |

### 3b. Domains

| Resultat | Bevis |
|----------|-------|
| `vercel domains ls` → **0 domains** under team `lunchportalen` | Domener sannsynligvis konfigurert på prosjekt-nivå / ekstern DNS |
| Prod alias bekreftet | `vercel inspect lunchportalen-j4b43ye02…` → `https://app.lunchportalen.no` |

### 3c. Production env vars (navn only)

| Endring vs full sweep? | Bevis |
|------------------------|-------|
| Uendret surface (sample) | `vercel env ls production` → SENTRY_*, TRIPLETEX_*, SANITY_*, SUPABASE_*, SMTP_*, RESEND_*, SYSTEM_MOTOR (encrypted) |

Nye/observert: `TRIPLETEX_*` og `SENTRY_*` på Production+staging; `SANITY_WRITE_TOKEN` kun Production.

### 3d. Latest production deployment inspect

| Felt | Verdi | Bevis |
|------|-------|-------|
| id | `dpl_B6AmtBbXJgEKuRZ4oSP22AYzhHjd` | `vercel inspect lunchportalen-j4b43ye02…` |
| target | production | |
| status | Ready | |
| region | **iad1** (US East) | Builds → `[iad1]` på λ routes |
| created | 2026-05-28 21:23 UTC | |

### 3e. Project settings

| Felt | Verdi | Bevis |
|------|-------|-------|
| Framework | Next.js | `vercel project inspect lunchportalen` |
| Node | 24.x | |
| Build | `npm run build` / `next build` | |
| Project ID | `prj_AJZzlPmgfbDyl05B44bwfymevnri` | |

---

## 4. Performance & security (live)

### 4a. Lighthouse (prod)

| URL | Perf | A11y | Best Prac | SEO | Bevis |
|-----|-----:|-----:|----------:|----:|-------|
| https://www.lunchportalen.no/ | 71 | 96 | 96 | 100 | `npx lighthouse@12.8.2 … --output=json` |
| https://www.lunchportalen.no/priser | 72 | 93 | 96 | 100 | |
| https://www.lunchportalen.no/kom-i-gang | 72 | 92 | 96 | 92 | |
| https://lunchportalen.no/losningen | — | — | — | — | `curl -sI` → **404** (ingen Lighthouse) |
| https://app.lunchportalen.no/login | 79 | 100 | 96 | 66 | |

JSON lagret lokalt: `.tmp/lh-home.json`, `.tmp/lh-priser.json`, etc.

### 4b. Response headers

| URL | Status | CSP | HSTS | X-Frame | X-Content-Type | Referrer | Server |
|-----|--------|-----|------|---------|----------------|----------|--------|
| lunchportalen.no/ | 200 | — | — | — | — | — | Microsoft-IIS/10.0 |
| …/priser | 200 | — | — | — | — | — | Microsoft-IIS/10.0 |
| …/kom-i-gang | 200 | — | — | — | — | — | Microsoft-IIS/10.0 |
| …/losningen | 404 | — | — | — | — | — | Microsoft-IIS/10.0 |
| app.lunchportalen.no/ | 307 | — | max-age=63072000 | — | — | — | Vercel |
| app.lunchportalen.no/login | 200 | — | max-age=63072000 | — | — | — | Vercel |

**Bevis:** `curl.exe -sI <url>` per rad.

### 4c. TLS

| Host | Issuer | NotAfter | Bevis |
|------|--------|----------|-------|
| lunchportalen.no | GeoTrust TLS RSA CA G1 (DigiCert) | 2026-10-27 | PowerShell `SslStream` (openssl ikke i PATH) |
| app.lunchportalen.no | Let's Encrypt R12 | 2026-08-02 | Samme |

---

## 5. Secrets — full skann

### 5a. gitleaks HEAD

| Resultat | Bevis |
|----------|-------|
| **772 findings**, rule `generic-api-key` ×772 | `gitleaks detect --source . --redact --report-path .tmp/gitleaks-head.json` |
| **759 false positives** (uSync XML GUIDs) | Topp fil: `LandingPageContentBlocksBlockList.config` ×94 |
| **Reelle / review** (13 hits, 10 filer): | |

```
umbraco17/lunchportalen/appsettings.json  — HMACSecretKey (KRITISK)
Umbraco/appsettings.json                  — HMACSecretKey (historisk path)
tests/api/orders-idempotency.test.ts      — test mock secret
tests/api/order-api-guards.test.ts        — test mock
tests/actions/tripletex-wizard-actions.test.ts
journal.txt
lib/gtm/outreach.ts, lib/outbound/*.ts    — trolig placeholder keys
```

### 5b. trufflehog

| Status | Bevis |
|--------|-------|
| ❌ **ESKALER** — ikke kjørt | Verktøy utilgjengelig (se §0) |

### 5c. Git historikk

| Resultat | Bevis |
|----------|-------|
| `gitleaks detect --log-opts="--all"` → **772** findings | `.tmp/gitleaks-history.json` |
| **0** secrets i historikk som IKKE er i HEAD | `historyOnlyLocations: 0` — rotasjon alene fjerner ikke HMACSecretKey fra historikk |

---

## 6. Ende-til-ende (live API)

| Steg | Status | Bevis |
|------|--------|-------|
| a) Login testbruker | ❌ **GAP** | Ingen dedikert test/staging-credentials i audit-scope; prod E2E avvist |
| b–g) Order flow | ❌ **GAP** | Krever autentisert session + testmiljø |

**Kritisk staff-mangel:** Ingen verifisert testmiljø for read-only E2E mot `/api/week`, `/api/orders`, `/api/kitchen/day` uten prod-mutasjon. Vercel har `staging` environment (TRIPLETEX_*), men ingen testbruker-leak i denne sesjonen.

---

## 7. Costs & residency

### 7a. Azure costs (30 dager)

| Status | Bevis |
|--------|-------|
| ❌ **ESKALER** | `az consumption usage list --start-date 2026-04-28 --end-date 2026-05-28` → after ~494s: `ERROR: (GatewayTimeout) The gateway did not receive a response from 'Microsoft.Consumption'` (exit 1). `az costmanagement` extension not installed locally. |

**Trenger:** Cost Management export fra portal eller `az costmanagement query`.

### 7b. Vercel billing

| Status | Bevis |
|--------|-------|
| ❓ | `GET /v1/teams/{id}/billing` ikke kjørt — eskalér dashboard |

### 7c. Supabase usage

| Status | Bevis |
|--------|-------|
| ❌ **ESKALER** | Krever `SUPABASE_ACCESS_TOKEN` |

### 7d. Sanity usage

| Status | Bevis |
|--------|-------|
| ❓ | Manage UI / API ikke kjørt |

### 7e. Data residency (live)

| Service | Region | EU? | Bevis |
|---------|--------|-----|-------|
| Azure Umbraco | **Norway East** | ✅ | `az webapp show …` → `"location": "Norway East"` |
| Supabase Postgres | **West EU (Ireland)** | ✅ EU | `supabase projects list` |
| Vercel compute | **iad1** (US East Virginia) | ❌ US | `vercel inspect …` → `[iad1]` |
| Sanity | ❓ | ❓ | Krever project settings API |

---

## 8. Eskaleringer til Thomas (samlet)

| # | Hva som trengs | Blokkerer |
|---|----------------|-----------|
| 1 | `SUPABASE_ACCESS_TOKEN` (personal) | Buckets, auth config, PITR, usage |
| 2 | Sanity token med `webhooks:read`, `cors:read`, `members:read` | §2f–i |
| 3 | `scoop install trufflehog openssl` eller Docker | §5b, §4c alternativ |
| 4 | Azure Cost Management export (NOK, 30d) | §7a |
| 5 | Test/staging bruker + base URL for read-only E2E | §6 |
| 6 | Supabase PITR retention + siste restore-dato (dashboard OK) | DR DD |

---

## 9. Endringer vs full sweep

| Tema | Før (full sweep) | Etter (live) |
|------|------------------|--------------|
| RLS live drift | ❓ ikke kjørt | ✅ kjørt — 190→232 policies, forventet stale golden |
| SECURITY DEFINER | ❓ | ✅ 33 private + 140 total inventar |
| gitleaks | ❌ ikke installert | ✅ 772 hits, 1 kritisk (HMACSecretKey) |
| Lighthouse prod | ❓ | ✅ scores for 4 URLer |
| Supabase region | ❓ | ✅ Ireland (EU) |
| Vercel region | ❓ | ✅ **iad1 (US)** — compliance note |
| Sanity tier docs | delvis | ✅ BASIS/LUXUS/ENTERPRISE menuDay live |
| E2E order flow | repo trace only | ❌ fortsatt gap (ingen testmiljø) |
| PITR / blob soft-delete / Azure burn | ❓ | ❓ fortsatt (API/token) |

**Staff-grade justering (subjektiv):** Supabase 58%→**64%** (live verifisert, golden fortsatt stale). Vektet helhet ~66%→**~68%**. Unknowns 19→**~9**.

---

*Generert read-only — Live Runtime Verification — Cursor, 2026-05-28.*
