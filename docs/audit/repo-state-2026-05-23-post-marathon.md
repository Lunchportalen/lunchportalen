# Repo state — post-marathon dag 4

**Date:** 2026-05-23 (kveld)  
**Baseline:** [repo-state-2026-05-23-deep-crawl.md](./repo-state-2026-05-23-deep-crawl.md)  
**Crawl-type:** verify + delta (read-only)  
**Baseline commit:** `4ea27f11` (siste commit før 2026-05-23 00:00)  
**HEAD:** `2153b1ba`  
**Metode:** git/rg/npm test + Supabase MCP (staging `uigxsboqeruxflgzqztl`, prod `hkpokyapzarefrgqzkos`) + Vercel CLI

---

## Executive summary

| Metrikk | Verdi |
| ------- | ----- |
| Commits siden baseline | **25** (`4ea27f11..2153b1ba`) |
| Items lukket i dag | **6** (DC-011, DC-027, DC-018, DC-019, DC-026, DC-013) |
| Regresjon på lukkede items | **0** |
| Nye items oppdaget | **2** åpne (DC-028, DC-030); DC-029 **lukket** |
| Fortsatt åpne items fra baseline | **40** (46 totalt − 6 lukket) |
| K6 LIVE-ready (security) | **Ja** — alle HARD-BLOCKs lukket, 0 regresjoner, 2403 PASS |

**Prod-deploys verifisert i dag (5):**

| PR/DC | Merge SHA | Fokus |
| ----- | --------- | ----- |
| PR-X1 | `44949eed` | DC-011 middleware + DC-027 AI auth |
| PR-X2 | `3439ddb5` | DC-018 RLS billing_* |
| PR-X3 | `b6735aca` | DC-019 RLS tenant-tabeller |
| PR-X4 | `b2b0e55b` | DC-026 Tripletex Flow 1 flag |
| DC-013 | `34ec4314` | npm HIGH CVE patch |

**Siste prod-deploy (Vercel):** `lunchportalen-2rwwvk0ui` · Ready · ~18:23 CET · alias `app.lunchportalen.no` · sannsynlig SHA `34ec4314`/`2153b1ba` (docs-only diff)

---

## Del 1 — Regression sweep

**STOPP-kriterium:** Ingen regresjon funnet — fortsetter til Del 2–6.

| Item | Forventet | Faktisk | Status | Notat |
| ---- | --------- | ------- | ------ | ----- |
| **DC-011** middleware bypass | Fail-closed allowlist; ingen implisitt `/api/*` bypass | `middleware.ts` L112–135: allowlist → next, ellers session → 401 JSON | **OK** | `lib/server/auth/apiAllowlist.ts`: 80 statiske + 3 dynamiske = **83** ruter |
| DC-011 `x-lp-mw-bypass` | 0 treff i `lib/` + `app/` | 0 treff i `lib/` + `app/` | **OK** | `middleware.ts` setter header som **telemetri** (`allowlist`/`1`) — ikke auth-bypass; `no-implicit-bypass.test.ts` PASS |
| DC-011 sample 5 ruter | Wrapper fra `lib/server/auth` eller allowlist | `/api/orders` → `scopeOr401`; `/api/superadmin/system` → `scopeOr401`+role; `/api/kitchen/orders.csv` → `scopeOr401`; `/api/driver/stops` → `scopeOr401`; `/api/admin/people` → `scopeOr401` | **OK** | Alle utenfor allowlist har route-level auth |
| DC-011 security-tester | 21 PASS | `no-implicit-bypass` 5 + `api-allowlist-regression` 16 = **21 PASS** | **OK** | |
| **DC-027** 17 AI-ruter | `denyUnlessSession` før `withApiAiEntrypoint` | Alle 17 i `tests/security/ai-routes-auth.test.ts` B8_ROUTES verifisert; `backoffice/experiments/event` + `public/track-event` inkludert | **OK** | |
| DC-027 wrapper-semantikk | Observability-only | `withApiAiEntrypoint` → `observeResponse` + `withAiDecisionEntrypoint` + metrics — ingen auth | **OK** | |
| **DC-018** RLS billing | `rowsecurity=true`; 1 SELECT (authenticated) per tabell | **Staging + prod:** `billing_products`, `billing_tax_codes` `rowsecurity=true`; policy `*_authenticated_select` på begge | **OK** | |
| **DC-019** RLS tenant | `rls=true`, `policy_count≥1`, kanonisk qual | **Staging + prod:** `invoice_periods`, `tripletex_exports`, `company_deletions` — `rls=true`, 1 policy hver; qual bruker `is_platform_admin()` / `can_access_company()` | **OK** | |
| **DC-026** Flow 1 flag | `featureFlags.ts`; 7 entry points gated; env usatt | `isTripletexFlow1Enabled` + `Flow1DisabledError` finnes; alle 7 punkter fra `dc-026-flow1-flag.md` har sjekk; `vercel env ls` → `TRIPLETEX_FLOW_1_ENABLED` **ikke satt** | **OK** | `.env.example` dokumenterer flagg (default `false`) |
| **DC-013** npm CVEs | prod high=0, critical=0; next≥15.5.18, lodash≥4.18 | `npm audit --omit=dev`: **high=0, critical=0**, moderate=3; `next@15.5.18`; `lodash@4.18.1` via `graphlib` | **OK** | Moderate (postcss/nodemailer) utenfor DC-013 scope |
| **Test-suite** | 2403 PASS, 0 FAIL | **2403 PASS**, 124 skipped, 0 FAIL | **OK** | 472 filer pass · +70 vs baseline deep-crawl |

---

## Del 2 — Delta-funn (commits `4ea27f11..2153b1ba`)

### 2.1 Commit-oversikt (25 commits)

```
2153b1ba docs(dc-013): note prod deploy success
34ec4314 fix(dc-013): patch 2 HIGH npm CVEs
e5768e7e docs(dc-026): close PR-X4 audit
b2b0e55b Merge PR-X4: DC-026 tripletex flow1 deferral lock
9d36fd21 fix(dc-026): gate tripletex flow 1 behind feature flag
b6735aca fix(dc-019): enable tenant-scoped rls on 3 tables
838b1b2a fix(dc-019): add tenant-scoped rls migration (staging applied)
3439ddb5 fix(dc-018): enable rls on billing_products + billing_tax_codes
1219773c fix(dc-018): add rls migration for billing catalog (staging applied)
acb87593 docs(dc-011): mark closed after prod deploy
44949eed Merge PR-X1: DC-011 + DC-027 auth restoration
(+ 14 commits: dc-011 implementasjon, dc-027, sentry diag, tripletex prod-verify test-route)
```

**Endrede `.ts/.tsx/.sql`-filer:** ~90 (inkl. 2 nye migrasjoner, 5 nye lib-moduler, 17 AI-ruter, middleware, tester).

### 2.2 Problem-mønstre i diff

| Mønster | Treff | Klassifisering |
| ------- | ----- | -------------- |
| Hardkodede secrets (`sk_live`, `password=`, …) | **0** | — |
| `console.log/error` i nye `app/`/`lib/server/` linjer | **0** nye prod-paths | — |
| `as any` / `@ts-ignore` | 3 linjer i **test-filer** (`ai-routes-auth`, `authHelpers`) | **False-positive** — test harness |
| Catch-blokker som svelger errors | Nye catches i meal-learning, auth-ruter, tripletex — returnerer `jsonError`/`authErrorToResponse`/`throw` | **False-positive** — korrekt fail-closed |
| Secrets i hele repo (`BEGIN PRIVATE KEY`, `sk_live_`) | **0** | — |

### 2.3 `.env.example` diff

| Key | Endring | Vercel-status | Vurdering |
| --- | ------- | ------------- | --------- |
| `TRIPLETEX_FLOW_1_ENABLED=false` | **Ny** — dokumenterer deferral | **Ikke satt** i prod/preview (korrekt) | **OK** — skal stå usatt til prod-token kjøpes |
| BOM/encoding | BOM fjernet; kommentarer hadde mojibake (Latin-1/`?`) | N/A | **LUKKET** — DC-029 cleanup 2026-05-23 |

### 2.4 Test-dekning nye `lib/`-filer

| Fil | Dedikert `.test.ts`? | Dekning |
| --- | -------------------- | ------- |
| `lib/server/auth/apiAllowlist.ts` | Via `api-allowlist-regression.test.ts` | **OK** |
| `lib/server/auth/requireUser.ts` | `authHelpers.test.ts` + `ai-routes-auth.test.ts` | **OK** |
| `lib/server/config/featureFlags.ts` | `featureFlags.test.ts` + `flow1Gate.test.ts` | **OK** |
| `lib/auth/edgeSession.ts` | **Nei** | Indirekte via middleware-tester — **DC-030 (LAV)** |
| `lib/public/anonRouteGuard.ts` | **Nei** | Brukt i offentlige ruter; ingen unit-test — **DC-030 (LAV)** |

### 2.5 meal-learning 500 — diagnose (prod-smoke PR-X1)

**Observasjon:** Prod-smoke gruppe B: Bearer auth **PASS** → HTTP **500** (forventet «200 eller 5xx etter auth»).

**Handler (`app/api/cron/meal-learning/route.ts`):**

| Steg etter auth | Mulig 500-kilde |
| --------------- | --------------- |
| Env | `requireEnv("SANITY_API_TOKEN")` — kaster hvis mangler |
| Supabase | `orders`-query feil → `throw` → catch → 500 |
| Sanity | `fetch` / `patch().commit()` feil → uncaught → 500 |
| Tom body | **Ikke relevant** — handler er `GET` uten body-krav |

**Konklusjon:** **Ikke auth-regresjon.** 500 er sannsynlig **operasjonell/handler-feil** (Sanity-token, Sanity patch på meals uten data, eller midlertidig integrasjonsfeil). Prod-smoke klassifiserte dette som PASS. **Anbefaling:** Verifiser Sentry for `[cron/meal-learning]` post-`44949eed` — manuell dashboard-sjekk (ingen Sentry MCP tilgjengelig).

---

## Del 3 — Fortsatt åpne items (status-update)

| ID | Alvor | Baseline | Status nå | Påvirket av dagens arbeid? | K6-blokkerende? |
| -- | ----- | -------- | --------- | -------------------------- | --------------- |
| DC-001 | MEDIUM | orphan onboarding form | **Uendret** | Nei | Nei |
| DC-002 | LAV | deprecated kitchen report | **Uendret** | Nei | Nei |
| DC-003 | HØY | console.log i prod-ruter | **Uendret** | Nei (meal-learning har eksisterende `console.error`) | Nei |
| DC-004 | MEDIUM | errorResponse console | **Uendret** | Nei | Nei |
| DC-005 | HØY | `.env.example` dekker <5% env | **Delvis forbedret** | `TRIPLETEX_FLOW_1_ENABLED` lagt til; fortsatt 80+ udocumenterte | Nei |
| DC-006–DC-008 | MEDIUM/LAV | UI/CSS | **Uendret** | Nei | Nei |
| DC-009–DC-010 | MEDIUM/LAV | a11y | **Uendret** | Nei | Nei |
| **DC-012** | HØY | anon INSERT på `company_registrations` | **Uendret — bekreftet OK** | Nei | **Nei** (frozen onboarding P16) |
| DC-014 | HØY | migration ledger drift | **Tall oppdatert** | +2 migrasjoner (dc018/dc019) applied prod+staging | **Ja** (operasjonell risiko) |
| DC-015 | MEDIUM | API test-gap | **Uendret** | +54 sikkerhetstester reduserer risiko indirekte | Nei |
| DC-016 | MEDIUM | safeHandler mangler | **Uendret** | Nei | Nei |
| DC-017 | LAV | `_migration_*` legacy tabeller | **Uendret** | Nei | Nei |
| **DC-020** | HØY | RLS=true, 0 policies (invites m.fl.) | **Uendret** | DC-018/019 lukket **andre** tabeller — ikke implisitt lukket | Nei |
| DC-021 | MEDIUM | audit_log_y* partisjoner uten RLS | **Uendret** | 37 partisjoner `rls=false, pcount=0` på prod | Nei |
| DC-022 | MEDIUM | dead tuples companies/outbox | **Ikke re-sjekket** | — | Nei |
| **DC-023** | HØY | staging 36 migrasjoner bak prod | **Uendret ratio** | Prod **97**, staging **61**, gap **36** (var 95/59=36) | **Ja** |
| DC-024 | MEDIUM | Sanity↔Supabase cache SLA | **Uendret** | Nei | Nei |
| DC-025 | LAV | Umbraco proxy | **Uendret** | Nei | Nei |

### DC-012 re-verifikasjon (prod)

`company_registrations` policies:

| Policy | Cmd | Roles | Qual |
| ------ | --- | ----- | ---- |
| `company_registrations_anon_insert` | INSERT | anon, authenticated | null (WITH CHECK PENDING) |
| `company_registrations_select_provider_scope` | SELECT | authenticated | `can_access_provider(provider_id)` |
| `company_registrations_update_provider_scope` | UPDATE | authenticated | provider scope |
| `company_registrations_superadmin` | ALL | authenticated | superadmin role |
| `company_registrations_service_role_full` | ALL | service_role | true |

**Anon har kun INSERT** — ingen SELECT/UPDATE for anon. Status: **forbedret bekreftelse**, ikke nytt funn.

### DC-014/023 migration ledger

| Kilde | Baseline | Nå | Δ |
| ----- | -------- | -- | - |
| Repo SQL-filer | 262 | **264** | +2 |
| Prod ledger | 95 | **97** | +2 (dc018, dc019) |
| Staging ledger | 59 | **61** | +2 |
| Prod−staging gap | 36 | **36** | 0 |

**Vurdering:** Dagens RLS-migrasjoner reduserer **ikke** ledger-drift — gap uendret. Schema-paritet på tabell-nivå holder (135 tabeller begge miljøer).

---

## Del 4 — Nye oppdagelser (fresh sweep)

| ID | Severity | Funn | Anbefalt handling |
| -- | -------- | ---- | ----------------- |
| **DC-028** | MEDIUM (ops) | `staging.app.lunchportalen.no/api/health` → **401** med `_vercel_sso_nonce` (Vercel Deployment Protection/SSO) — **ikke** app-middleware | Repoint alias + verifiser bypass-token for staging-smoke; prod health **200** med `x-lp-mw-bypass: allowlist` ✓ |
| **DC-029** | LAV | **LUKKET** (cleanup, 2026-05-23) | `.env.example` TRIPLETEX + ROI + service-role kommentarer → korrekt UTF-8 |
| **DC-030** | LAV | `edgeSession.ts`, `anonRouteGuard.ts` uten dedikert unit-test | Legg til tester ved neste berøring av auth-modulen |
| **DC-031** | HØY (kjent) | **107** `SECURITY DEFINER` funksjoner uten `search_path` i prod | Baseline-risk; planlegg hardening-migrasjon (ikke ny regresjon) |

### 4.1 RLS full sweep (prod) — tabeller med `rls=false`

| Tabellgruppe | Antall | Forventet? |
| ------------ | ------ | ---------- |
| `audit_log_y*` partisjoner | 37 | **Delvis** — parent `audit_log` har RLS; partisjoner arver ikke (DC-021) |
| Øvrige public tabeller med `rls=false` | **0** | DC-018/019 fix bekreftet — ingen nye exposed tabeller |

### 4.2 Tabeller RLS=true, pcount=0 (fail-closed)

`company_invites`, `employee_invites`, `menu_visibility_days`, `tripletex_webhook_events`, `webhook_events`, 5× `_migration_*` — uendret fra baseline (DC-020).

### 4.3 API-rute-inventar

| Metrikk | Baseline | Nå |
| ------- | -------- | -- |
| `app/api/**/route.ts` | 536 | **536** (uendret) |
| Allowlist | 83 | **83** |

Ingen nye ruter siden baseline — klassifisering uendret.

### 4.4 Dev-deps CVEs

| Metrikk | Baseline (deep-crawl) | Nå |
| ------- | --------------------- | -- |
| prod HIGH+CRITICAL | 2 HIGH | **0** |
| full audit HIGH | 3 (flatted, minimatch, picomatch) | **0 HIGH**, 7 moderate |

**Dev HIGH CVEs ser ut til å være løst** som bivirkning av lockfile-oppdatering — verifiser med `npm audit` i CI.

### 4.5 Secrets sweep

`rg` på `BEGIN.*PRIVATE KEY|sk_live_|pk_live_` i `.ts`/`.json`: **0 treff** — ingen HARD-BLOCK.

### 4.6 Auth-filer endret uten test-diff

| Fil | Commits siden baseline | Test-dekning |
| --- | ---------------------- | ------------ |
| `lib/server/auth/apiAllowlist.ts` | dc-011 | `api-allowlist-regression` ✓ |
| `lib/server/auth/requireUser.ts` | dc-011 | `authHelpers` ✓ |
| `lib/server/config/featureFlags.ts` | dc-026 | `featureFlags` + `flow1Gate` ✓ |

---

## Del 5 — Operasjonell tilstand

### 5.1 Vercel

| Miljø | Deploy | Alder | Status | Notat |
| ----- | ------ | ----- | ------ | ----- |
| **Production** | `lunchportalen-2rwwvk0ui` | ~15 min | Ready | Alias `app.lunchportalen.no` |
| Production (PR-X4) | `lunchportalen-h8oj0lgl1` | ~45 min | Ready | SHA `b2b0e55b` |
| Production (PR-X1) | `lunchportalen-11o3lclcm` | ~1 t | Ready | SHA `44949eed` |
| Staging branch | `lunchportalen-lpa6im8sf` | ~2 t | Ready | DC-026 doc |
| **staging.app alias** | curl health | — | **401 SSO** | **DC-028** — Deployment Protection, ikke app |
| **prod health** | `GET /api/health` | — | **200** | `x-lp-mw-bypass: allowlist` ✓ |

**Cron 24t:** Ingen Vercel Cron MCP — proxy: prod-smoke week-scheduler **200** med Bearer; meal-learning auth **401** uten / **500** med Bearer (handler, ikke cron-auth).

### 5.2 Sentry

**Status:** Krever manuell dashboard-sjekk ([lunchportalen.sentry.io](https://lunchportalen.sentry.io)).

| Filter | Forventning |
| ------ | ----------- |
| Post-`b2b0e55b` (PR-X4) | Ingen ERROR-spike for `FLOW1_DISABLED` (skal være skip/info) |
| Post-`34ec4314` (DC-013) | Ingen npm-relatert runtime-feil |
| `[cron/meal-learning]` | Eventuelle 500 etter auth — se Del 2.5 |
| RLS `permission denied` | Skal **ikke** spike etter DC-018/019 |

### 5.3 Supabase

| Metrikk | Staging | Prod |
| ------- | ------- | ---- |
| MCP SELECT | OK | OK |
| DB-størrelse | **471 MB** | **95 MB** |
| Aktive connections (prod) | — | **7** |
| Migrasjoner ledger | **61** | **97** |
| Public tabeller | 135 | 135 |
| SECURITY DEFINER uten search_path | — | **107** |

**Staging DB større enn prod** — uventet vs baseline; kan skyldes testdata/audit-volume på staging branch. Ikke regresjon fra dagens deploys.

---

## Anbefalinger (prioritert for neste sesjon)

1. **K6 LIVE-runde** — alle HARD-BLOCKs lukket, 0 regresjoner, 2403 PASS
2. **Migration ledger cleanup (DC-014/023)** — apply pending til staging; gap fortsatt 36
3. **Staging alias + SSO (DC-028)** — repoint `staging.app.lunchportalen.no`; bruk bypass-token for smoke
4. **Dev-deps moderate (7 stk)** — 15 min opprydding hvis CI krever clean audit
5. **SECURITY DEFINER search_path (DC-031)** — planlegg migrasjon (107 funksjoner)
6. ~~**`.env.example` UTF-8 (DC-029)**~~ — **LUKKET** 2026-05-23

---

## Lessons learned dag 4

### Det som fungerte bra

- **Invariant-tester** (`api-allowlist-regression`, `no-implicit-bypass`, `ai-routes-auth`) fanget regressionsrisiko før prod — 21/21 PASS etter marathon.
- **Atomisk PR-X1** (middleware + allowlist + 17 AI-ruter + cron-fixes) unngikk delvis deploy-hull.
- **Fail-closed mønster** konsistent: RLS-migrasjoner (DC-018/019), Flow 1 flag (DC-026), npm patch uten runtime-diff (DC-013).
- **Prod-smoke som gate** — 11/11 PASS dokumentert; meal-learning 500 akseptert som post-auth handler, ikke auth-hull.

### Det som burde gjøres annerledes neste gang

- **Staging alias verifiseres før hver GO** — SSO/deployment protection maskerer middleware-headers (DC-028; gjentatt fra baseline lesson).
- **Ledger-drift følges per deploy** — +2 migrasjoner i dag hjalp ikke staging-gap; trenger dedikert apply-pass.
- **Sentry MCP/dashboard** bør være del av post-deploy checklist — meal-learning 500 ble ikke root-caused i denne crawl.
- **`.env.example`-endringer** bør valideres for UTF-8 før merge (DC-029 løst samme kveld).

---

## Appendix — regression STOPP-logg

```
Del 1 regression sweep: ALL OK — no STOP triggered
Del 2/4 secrets sweep: 0 hits — no HARD-BLOCK
Del 4.5 secrets: PASS
Test suite: 2403 PASS / 0 FAIL
```

**Crawl varighet:** ~45 min (under 2t-grense)  
**Skrive-operasjoner:** Kun denne audit-doc (read-only ellers)
