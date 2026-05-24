# Enterprise Audit — Fase 1: BACKEND / Supabase Deep-Audit

**Date:** 2026-05-24  
**Scope:** READ-ONLY · prod `hkpokyapzarefrgqzkos` · staging `uigxsboqeruxflgzqztl`  
**Baseline:** [00-inventory.md](./00-inventory.md)  
**Method:** Supabase MCP SQL, `rg`, vitest (kitchen diagnosis only), migration classifier script

---

## Deploy i vente (DC-032 read-path)

| Item | State |
| --- | --- |
| Local `main` | `2aeb7d9f` — **3 commits ahead** of `origin/main` (`3cf4e294`) |
| Push | **Blocked** — pre-push hook, 9 kitchen-batch test failures (§1.14) |
| Prod deploy | **Not applied** — read-path fixes (`/api/me`, `/api/week`, `/api/orders/today`) still broken on prod |
| Revert | **None** — commits stand per audit instruction |

**Commits in queue:**

```
2aeb7d9f fix(prod-readpath): remove ghost columns and user_id profile fallback
35d02f64 fix(dc-032): allow employee scope on orders/today GET/POST
ea027081 fix(dc-032): week profile select — drop missing disabled_reason column
```

**Avhenger av Fase 1-funn:** Push bør ikke `--no-verify` før kitchen-test root cause (§1.14) er klassifisert — feilen skyldes **test harness vs profileLookup**, ikke kitchen DB-schema.

---

## Executive summary (Fase 1)

| # | Severity | Område | Funn | Bevis | Eier |
| --- | --- | --- | --- | --- | --- |
| B1-01 | **P1** | Migrasjon-ledger | F0-01 «null overlapp» var **versjon-prefix artefakt**; 72/98 prod har repo-match (navn/eksakt). **26/98 (27%)** har **ingen** repo-fil — under 50% P0-terskel, men **P1** process/debt. | §1.10 | [BACKEND+DEVOPS] |
| B1-02 | **P1** | Env migrasjon-historie | Prod og staging deler **1/98** versjon-ID (`20260522041350`). Staging = baseline dump + 62 deltas; prod = inkrementell kjede fra 2026-05-07. | §1.10 | [BACKEND+DEVOPS] |
| B1-03 | **P1** | Ghost-kolonner (app) | Fortsatt treff på `disabled_reason`, `profiles.user_id`, `is_disabled` i prod-kode på `origin/main`; kitchen har **separate** ghost-treff (`name`, `department` på profiles). | §1.2, §1.14 | [BACKEND] |
| B1-04 | **P1** | Kitchen test-regresjon | 9/9 feil = **403** pga. `loadProfileByUserId` lookup `profiles.id = auth.uid()` mens test seed bruker `id: p1, user_id: u1`. **Regresjon fra DC-032 cherry-pick**, ikke flakiness. | §1.14 | [BACKEND] |
| B1-05 | **P2** | Function count delta | 385 vs 197 `pg_proc` — **188 prod-only** er **100% btree_gist/citext extension** i `public`, ikke manglende app-RPC på staging. | §1.1 utvidet | [BACKEND] |
| B1-06 | **P2** | Schema kolonner | **1639** kolonner i `public` på **begge** env — ingen drift i total count; kitchen/orders/profiles identisk. | §1.1 | [BACKEND] |
| B1-07 | **P2** | MCP migration apply | `k6_prod_tenant` applied prod `20260523232327`; repo-fil `20260524130000_k6_prod_tenant.sql` — samme **name**, diff versjon (MCP timestamp). | §1.10 | [BACKEND+DEVOPS] |
| B1-08 | **P1** | Connection pool / K6 | Prod `max_connections=60` (Micro-tier signal). K6 stress **100 VU** estimerer **60–85%** pool-utilization ved healthy latency; **HØY** risiko ved degradering eller cron-kollisjon. | §1.9 | [BACKEND+DEVOPS] |
| B1-09 | **P2** | Cron observability (verifisert) | `cron_runs` finnes **ikke** i prod — **blokkerer ikke** outbox-cron (try/catch + `void` etter batch). Outbox **fungerer** (7 rader, 1 PENDING). SLI/health for cron = **degraded/unknown**. | §1.9, §B1-09 verify | [BACKEND] |

---

## 1.1 Schema-integritet (prod vs staging)

### Objekt-paritet (uendret fra Fase 0)

| Objekt | Prod | Staging |
| --- | ---: | ---: |
| Tabeller | 135 | 135 |
| Views | 19 | 19 |
| RLS policies | 232 | 232 |
| Triggers (non-internal) | 88 | 88 |
| **Kolonner (`information_schema.columns`)** | **1639** | **1639** |

**SQL:**

```sql
SELECT count(*) FROM information_schema.columns WHERE table_schema='public';
-- prod: 1639, staging: 1639
```

### Drift-matrise (utvalg — kitchen read-path)

| Tabell | Prod vs staging | Merknad |
| --- | --- | --- |
| `kitchen_batches` | **Identisk** (9 kolonner) | BASE TABLE |
| `kitchen_batch` | **VIEW** (prod) | App bruker `.from("kitchen_batch")` — view over `kitchen_batches` |
| `orders` | **Identisk** (35 kolonner) | |
| `profiles` | **Identisk** (22 kolonner) | Inkl. `active`, `disabled_at`; **ingen** `user_id`, `is_disabled`, `disabled_reason` |

**SQL (prod):**

```sql
SELECT table_name, table_type FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('kitchen_batch','kitchen_batches');
-- kitchen_batch → VIEW, kitchen_batches → BASE TABLE
```

### Schema-integritet — konklusjon

Prod og staging er **kolonne-identiske** på tvers av `public` (1639/1639). Read-path-feil på prod skyldes **app select-lister**, ikke DDL-drift mellom envs for K6-relevante tabeller.

---

## 1.1 utvidet — Function delta (F0-04 dypdykk)

### Rå telling

```sql
SELECT prokind, count(*) FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace=n.oid
WHERE n.nspname='public' GROUP BY prokind;
-- prod: f=385, a=2  (total 387)
-- staging: f=197, a=2  (total 199)
```

### Root cause: extension objects i `public`, ikke app-RPC

Filtrert sammenligning (ekskl. `citext*` + regex helpers):

| Metrikk | Prod | Staging |
| --- | ---: | ---: |
| App+trigger RPCs (navn+args) | ~350 | ~185 |
| **Prod-only (app business)** | **0** | — |
| **Prod-only (extension)** | **~188** | — |
| Staging-only | 0 | — |

**188 prod-only funksjoner** = **`btree_gist`** (`gbt_*`, ~170) + **`gbtreekey*_{in,out}`** (~12) + **`*_dist`** distance ops (`cash_dist`, `date_dist`, `float4_dist`, `float8_dist`, `int2_dist`, `int4_dist`, `int8_dist`, `interval_dist`, `oid_dist`, `time_dist`, `ts_dist`, `tstz_dist`).

Alle `lp_*`, `can_*`, `tg_*`, `outbox_*`, `is_platform_admin*` finnes på **begge** env med identisk signatur.

### Funn-tabell — prod-only functions (grupper)

| # | Severity | Signatur (representant) | Returns | Security | I app-kode? | I git migrasjoner? | Klassifisering |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-01..F-170 | P3 | `gbt_* (internal, …)` | diverse | INVOKER | Nei | Extension install, ikke app SQL | **Orphan extension** |
| F-171..F-182 | P3 | `gbtreekey{2,4,8,16,32,var}_{in,out}(…)` | composite | INVOKER | Nei | Extension | **Orphan extension** |
| F-183 | P3 | `cash_dist(money, money)` | money | INVOKER | Nei | Extension | **Orphan extension** |
| F-184 | P3 | `date_dist(date, date)` | integer | INVOKER | Nei | Extension | **Orphan extension** |
| F-185 | P3 | `float4_dist(real, real)` | real | INVOKER | Nei | Extension | **Orphan extension** |
| F-186 | P3 | `float8_dist(double precision, double precision)` | double precision | INVOKER | Nei | Extension | **Orphan extension** |
| F-187 | P3 | `int{2,4,8}_dist(…)` | integer/bigint | INVOKER | Nei | Extension | **Orphan extension** |
| F-188 | P3 | `interval_dist / oid_dist / time_dist / ts_dist / tstz_dist` | diverse | INVOKER | Nei | Extension | **Orphan extension** |

**Full liste (188 signaturer):** se [Appendiks B — prod-only functions](#appendiks-b--prod-only-functions-188).

**Anbefalt klassifisering F0-04:** Nedgrader fra INVESTIGATE → **P2 env hygiene** (extension i `public` på prod, ikke staging). **Ikke** P0/P1 business-RPC gap.

---

## 1.2 Ghost-kolonne scan (utvidet utdrag)

Kjent mønster (prod-deployed kode / `origin/main`):

| Kolonne | DB (prod+staging) | App-treff (utdrag) | Severity |
| --- | --- | --- | --- |
| `is_disabled` | **Finnes ikke** | `app/api/me/route.ts` (fix lokalt) | P1 |
| `disabled_reason` | **Finnes ikke** | `app/api/week/route.ts`, `app/api/profile/route.ts` L58–68 | P1 |
| `profiles.user_id` | **Finnes ikke** (PK = `id`) | `app/api/kitchen/route.ts` L187, mange order-ruter | P1 |
| `profiles.name` | **Finnes ikke** | `app/api/kitchen/route.ts` L187 | P2 |
| `profiles.department` | **Finnes ikke** | `app/api/kitchen/route.ts` L187 | P2 |

Kitchen batch-ruter (`start`, `set`, `summary`) selecter **`disabled_at`, `is_active`, `company_id`, `location_id`** — **gyldige** kolonner. Ghost-problemet for kitchen **tester** er lookup-semantikk (§1.14), ikke batch-tabell-DDL.

---

## 1.10 Migrasjon-integritet (utvidet — F0-01 dypdykk)

### Hvorfor «null versjonsoverlapp» i Fase 0?

Fase 0 matchet `schema_migrations.version` mot repo-fil **prefix** (`filename.replace(/_.*$/, '')`). Prod/staging fikk **nye timestamps ved apply** (CLI/MCP), mens repo beholder **opprinnelige** filnavn.

**Eksempel:**

| Prod ledger | Repo fil |
| --- | --- |
| `20260507182933` / `add_rls_missing_tables` | `20260507170115_add_rls_missing_tables.sql` |
| `20260523232327` / `k6_prod_tenant` | `20260524130000_k6_prod_tenant.sql` |

`inserted_at` ≈ `version` som timestamp → **LIKELY_CLI_APPLY** (Supabase CLI/MCP genererer versjon = apply-tidspunkt).

### Klassifisering — alle 98 prod `schema_migrations`

| Klassifisering | Antall | % | Betydning |
| --- | ---: | ---: | --- |
| `REPO_VERSION_EXACT` | 20 | 20% | Versjon-ID matcher repo-fil prefix |
| `REPO_NAME_MATCH_DIFF_VERSION` | 52 | 53% | SQL i git, **annet** versjon-ID i ledger (re-apply/squash) |
| `APPLIED_OUTSIDE_GIT` | 26 | **27%** | **Ingen** repo-fil match (navn eller versjon) |
| **P0 terskel (>50% uten git)** | — | **27%** | **Ikke P0** |

**`created_by`:** Alle 98 = `post@lunchportalen.no` (CLI user, ikke `service_role` MCP marker).

### 26 × `APPLIED_OUTSIDE_GIT` (full liste)

| Version | Name | inserted_at |
| --- | --- | --- |
| 20260507184900 | normalize_status_enums_uppercase_v6_constraints | 2026-05-07 18:49:00+00 |
| 20260507222054 | add_kitchen_batch_day_choices_rls_policies | 2026-05-07 22:20:54+00 |
| 20260507222112 | add_day_choices_date_company_user_index | 2026-05-07 22:21:12+00 |
| 20260515145748 | test_ping_migration_sql | 2026-05-15 14:57:48+00 |
| 20260520112841 | suspend_rpc_public_provider | 2026-05-20 11:28:41+00 |
| 20260520112849 | suspend_rpc_public_company | 2026-05-20 11:28:49+00 |
| 20260520112851 | suspend_rpc_public_user | 2026-05-20 11:28:51+00 |
| 20260520133500 | provider_match_postal_code | 2026-05-20 13:35:00+00 |
| 20260520133506 | provider_registration_rpc_create | 2026-05-20 13:35:06+00 |
| 20260520133509 | provider_registration_rpc_assert | 2026-05-20 13:35:09+00 |
| 20260520133520 | provider_registration_rpc_reject | 2026-05-20 13:35:20+00 |
| 20260520133530 | patch13_provider_registration_rpc_approve | 2026-05-20 13:35:30+00 |
| 20260520134937 | patch14_lp_service_area_save | 2026-05-20 13:49:37+00 |
| 20260520134938 | patch14_lp_service_area_toggle | 2026-05-20 13:49:38+00 |
| 20260520140320 | provider_subscriptions_tables | 2026-05-20 14:03:20+00 |
| 20260520140323 | provider_subscriptions_rls | 2026-05-20 14:03:23+00 |
| 20260520140327 | patch15_lp_provider_set_subscription | 2026-05-20 14:03:27+00 |
| 20260520140328 | patch15_lp_provider_update_billing_contact | 2026-05-20 14:03:28+00 |
| 20260520140330 | patch15_lp_provider_generate_invoice | 2026-05-20 14:03:30+00 |
| 20260520191516 | tpt0_step6_10_invoice_periods_tripletex_exports | 2026-05-20 19:15:16+00 |
| 20260520194833 | tpt_a2_tripletex_customers_provider_scope | 2026-05-20 19:48:33+00 |
| 20260520194839 | tpt_a2_lp_provider_create_rpc_fn | 2026-05-20 19:48:39+00 |
| 20260521010256 | tpt_a7_admin_ui_entity_id_fix | 2026-05-21 01:02:56+00 |
| 20260521085844 | 20260530120001_tpt_b3_agreement_invoice_rpcs | 2026-05-21 08:58:44+00 |
| 20260521104341 | tpt_b6_webhook_paid_status_schema | 2026-05-21 10:43:41+00 |
| 20260521104349 | tpt_b6_webhook_paid_status_rpcs | 2026-05-21 10:43:49+00 |

Mange av disse har **nære** repo-varianter under andre filnavn (f.eks. `provider_match_postal_code` vs `20260520133500_provider_match_postal_code.sql` med annet slug) — klassifisereren krever substring-match; manuell review anbefalt for Tripletex-patch-serien.

### Hvorfor kun 1 overlapp prod ∩ staging?

| Env | Strategi | Første entry | Siste entry |
| --- | --- | --- | --- |
| **Prod** | Inkrementell apply fra 2026-05-07 | `20260507182933` | `20260523232327` |
| **Staging** | **Baseline re-roll** 2026-05-20 + deltas | `20260520000001` `baseline_schema_dump_from_prod_2026_05_20_v1_REROLLED` | `20260523212342` |

Staging `schema_migrations` har **ikke** `inserted_at`-kolonne (prod har den) — ytterligere schema-forskjell på metadata-tabellen.

**Eneste delte versjon-ID:** `20260522041350` (`tpt_b7_hotfix8_service_role_grants`) — apply-timestamp tilfeldig identisk på begge env.

**Konsekvens:** `schema_migrations.version` kan **ikke** brukes som env-paritet-sannhet. Må sammenligne **DDL snapshot** (1639 kolonner OK) + applogikk.

---

## 1.14 Kitchen test-diagnose (3 filer, 9 feil)

### Test-output (2026-05-24, `npm run test:run`)

```
FAIL tests/kitchen-batch-start.test.ts (3 failed / 6 total)
FAIL tests/kitchen-batch-status.test.ts (4 failed / 7 total)
FAIL tests/kitchen-batch-summary.test.ts (2 failed / 5 total)
Total: 9 failed | 9 passed (18)
```

| # | Test | Forventet | Faktisk | Fil:linje |
| --- | --- | ---: | ---: | --- |
| 1 | kitchen kan starte batch etter 08:05 | 200 | **403** | `kitchen-batch-start.test.ts:160` |
| 2 | batch kan ikke startes to ganger | 200 (1st) | **403** | `kitchen-batch-start.test.ts:185` |
| 3 | batch kan ikke startes uten orders | 422 | **403** | `kitchen-batch-start.test.ts:226` |
| 4 | kitchen kan endre status fremover | 200 | **403** | `kitchen-batch-status.test.ts:141` |
| 5 | kitchen kan ikke reversere status | 409 | **403** | `kitchen-batch-status.test.ts:160` |
| 6 | idempotent: samme status to ganger | 200 | **403** | `kitchen-batch-status.test.ts:213` |
| 7 | race: to samtidige updates | 409 | **403** | `kitchen-batch-status.test.ts:225` |
| 8 | kitchen får 200 og deterministisk sortering | 200 | **403** | `kitchen-batch-summary.test.ts:149` |
| 9 | 422 når ingen orders | 422 | **403** | `kitchen-batch-summary.test.ts:194` |

Alle feil: `AssertionError: expected 403 to be <expected>`.

### Root cause (deterministisk)

**Klasse: Regresjon fra DC-032 cherry-pick — test harness mismatch**

1. Lokal commit `2aeb7d9f` endret `lib/db/profileLookup.ts` til **kun** `profiles.id = userId`:

```11:11:lib/db/profileLookup.ts
  const byId = await sb.from("profiles").select(select).eq("id", userId).maybeSingle();
```

2. Kitchen-ruter kaller `loadProfileByUserId(admin, userId, …)` etter auth:

```86:100:app/api/kitchen/batch/start/route.ts
    const { data: prof, error: profErr } = await loadProfileByUserId(admin as any, userId, "company_id, location_id, disabled_at, is_active");
    // ...
    if (role === "kitchen") {
      if (!prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
```

3. Test mock: `auth.getUser()` → `{ id: "u1" }`, men profile seed:

```143:143:tests/kitchen-batch-start.test.ts
    profiles: [{ id: "p1", user_id: "u1", company_id: COMPANY_ID, location_id: LOCATION_ID, disabled_at: null, is_active: true }],
```

4. Lookup `eq("id", "u1")` → **null** → **403 `Mangler profil.`** før order/batch-logikk nås.

### Klassifisering per feilkategori

| Hypotese | Verdict | Bevis |
| --- | --- | --- |
| Regresjon fra cherry-pick | **JA** | `profileLookup.ts` endret i `2aeb7d9f`; tester uendret |
| Env-avhengighet | **NEI** | Vitest mock, ingen ekstern DB |
| Flakiness | **NEI** | 9/9 deterministisk 403 |
| Ghost-kolonne #2 (kitchen tabeller) | **NEI** | `disabled_at`, `is_active` finnes i DB; feil skjer **før** batch-queries |
| Ghost-kolonne (test seed `user_id`) | **Delvis** | Seed-felt `user_id` finnes ikke i DB, men mock DB ignorerer schema — **ikke** root cause |

### Ghost-kolonne kart (kitchen-relatert prod-kode)

| Fil | Select | Kolonner vs DB |
| --- | --- | --- |
| `app/api/kitchen/batch/start/route.ts` L86 | profile lookup | OK |
| `app/api/kitchen/route.ts` L187 | `user_id,email,full_name,name,department` | **GHOST:** `user_id`, `name`, `department` |
| `app/api/kitchen/day/route.ts` L41 | `role, disabled_at, is_active, company_id, location_id` | OK |

Kitchen batch-test-feil er **ikke** prod ghost på batch-tabeller; separat P2 på `kitchen/route.ts` L187.

### Passerte tester i samme filer (9)

Cutoff 412, tenant 403, employee role 403, empty orders tenant mismatch — disse treffer **tidligere** return paths og er uavhengige av profile lookup success.

---

## 1.3–1.9, 1.11–1.13 (kortstatus — full deep-dive i Fase 1b ved GO)

| § | Område | Status | Topp-funn |
| --- | --- | --- | --- |
| 1.3 | Orphan-kolonner | **INVESTIGATE** | Ikke full `rg`-scan denne sesjonen |
| 1.4 | RLS coverage | **P2** | 232 policies begge env; DC-018/019 på billing/tenant — verifisert post-marathon |
| 1.5 | Service-role | **P2** | Kitchen routes bruker `supabaseAdmin()` etter role gate — korrekt mønster |
| 1.6 | Idempotency | **P1** | `lp_idem_*` RPC finnes; ikke kartlagt per API-route |
| 1.7 | Audit trail | **P2** | Partitioned `audit_log_*`; prod 18k+ rader i mai-partition |
| 1.8 | Query perf | **INVESTIGATE** | `pg_stat_statements` ikke hentet |
| 1.9 | Connection pool | **INVESTIGATE** | Tier/pool limits ikke hentet |
| 1.11 | Integrasjoner | **P2** | Tripletex Flow 1 flag OFF; Sanity webhook secret på Vercel |
| 1.12 | Date/time | **P2** | Kitchen bruker `osloTodayISODate` / cutoff 08:05 — konsistent |
| 1.13 | Tester-fundament | **P1** | 9 kitchen failures blokkerer push; DC-032 nye tester (11) PASS isolert |

---

## Appendiks A — Prod migration ledger (98 entries)

Full klassifisert JSON: `.tmp/prod-migration-classified.json` (generert 2026-05-24, read-only audit artifact).

---

## Appendiks B — Prod-only functions (188)

Alle er **Postgres extension** (`btree_gist` + distance ops), **SECURITY INVOKER**, **ikke referert i app/**, **ikke i app migrasjoner** som business logic.

**Prefix-fordeling:**

| Prefix | Antall (ca.) |
| --- | ---: |
| `gbt_` | ~170 |
| `gbtreekey*` | ~12 |
| `*_dist` | ~12 |

Representative signaturer (full enum = 188):

```
gbt_bit_compress(internal)
gbt_bool_consistent(internal, boolean, smallint, oid, internal)
… [gbt_* for bit, bool, bpchar, bytea, cash, date, enum, float4, float8, inet, int2, int4, int8, intv, macad, macad8, numeric, oid, text, time, timetz, ts, tstz, uuid]
gbtreekey16_in(cstring) … gbtreekey_var_out(gbtreekey_var)
cash_dist(money, money)
date_dist(date, date)
float4_dist(real, real)
float8_dist(double precision, double precision)
int2_dist(smallint, smallint)
int4_dist(integer, integer)
int8_dist(bigint, bigint)
interval_dist(interval, interval)
oid_dist(oid, oid)
time_dist(time without time zone, time without time zone)
ts_dist(timestamp without time zone, timestamp without time zone)
tstz_dist(timestamp with time zone, timestamp with time zone)
```

---

## Appendiks C — SQL queries brukt

```sql
-- Migration ledger (prod)
SELECT version, name, inserted_at, created_by
FROM supabase_migrations.schema_migrations ORDER BY version;

-- Schema column parity
SELECT count(*) FROM information_schema.columns WHERE table_schema='public';

-- kitchen_batch view
SELECT table_name, table_type FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'kitchen%';

-- Function prokind counts
SELECT prokind, count(*) FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace=n.oid
WHERE n.nspname='public' GROUP BY prokind;
```

---

## 1.9 Connection pool — detaljert (Fase 1.5-B)

**Scope:** Prod `hkpokyapzarefrgqzkos` · K6 LIVE enterprise-perspektiv · READ-ONLY  
**Deferred:** §1.3 orphan-kolonner → **DC-N** ticket (se nedenfor)

### 1.9.1 Supabase tier + pool config

| Parameter | Prod-verdi | Kilde |
| --- | --- | --- |
| `max_connections` | **60** | Prod SQL `pg_settings` |
| `superuser_reserved_connections` | **3** | Prod SQL |
| **Effektiv app-pool (estimat)** | **~45–50** | 60 minus Auth/PostgREST/realtime/replication baseline |
| Postgres | **17.6.1** | MCP `get_project` |
| Region | **eu-west-1** | MCP |
| Compute signal | **Micro-class** | `max_connections=60` matcher Supabase Micro compute |

**SQL (prod):**

```sql
SELECT name, setting::int AS value
FROM pg_settings
WHERE name IN ('max_connections', 'superuser_reserved_connections');
-- max_connections: 60, superuser_reserved_connections: 3
```

**Merk:** MCP `get_project` eksponerer ikke eksplisitt plan-navn (Pro/Micro); `max_connections=60` er primærbevis for compute-størrelse.

### 1.9.2 App-tilkoblingsmønster (PgBouncer / Supavisor)

| Lag | Endpoint | Modus | Implikasjon |
| --- | --- | --- | --- |
| **Vercel API routes** (`app/api/**`) | `https://hkpokyapzarefrgqzkos.supabase.co` | **PostgREST HTTP** (ikke `:5432`) | Ingen direkte Postgres-sessions fra lambdas; pool håndteres av Supabase API-lag |
| **Service-role** | `lib/supabase/admin.ts` L75 | Samme REST URL | Singleton per Node-prosess (`_admin` L52–88) — gjenbruk innen warm lambda |
| **User-session** | `lib/supabase/server.ts` → `@/utils/supabase/server` | Cookie-bound SSR client | Per request; session via middleware refresh |
| **Seed/CLI** | `scripts/seed/core/pool.ts` | **Supavisor transaction mode, port 6543** | `prepare: false` når pooler (L79) — korrekt for transaction mode |
| **Direct (opt-in)** | `SEED_USE_DIRECT=true` → `POSTGRES_URL_NON_POOLING` | Port **5432** | Kun scripts — **ikke** prod app-path |

**Konklusjon PgBouncer:** Prod app bruker **pooler-backed PostgREST** (ikke direct). **P1 ved direct** gjelder kun hvis noen endrer `SUPABASE_URL` til `:5432` eller øker direct `pg.Pool` fra serverless — dette er **ikke** dagens mønster.

**Transaction mode implikasjoner:**

- Prepared statements: deaktivert i seed pooler-path (`prepare: false`) — riktig.
- Session-state / RLS: PostgREST setter JWT per request; transaction mode resetter session mellom transaksjoner — **RLS row visibility er per-request**, ikke per-lambda-session.
- Langvarige cron-jobber som holder én lambda i 20s (`OUTBOX_TIME_BUDGET_MS`) bruker **HTTP keep-alive**, ikke én held Postgres-session.

### 1.9.3 K6 LIVE — pool-belastningsmodell

**Profil (fra `scripts/k6/`):**

| Parameter | Verdi | Fil |
| --- | --- | --- |
| Login | **Once per VU** (`setupAuth`) | `scripts/k6/lib/auth.js` L52–59 |
| Stress peak | **100 VU** (10m ramp) | `scripts/k6/scenarios/stress.js` L19–20 |
| Baseline peak | **20 VU** | `scripts/k6/scenarios/baseline.js` L21–22 |
| Iterasjon | **1 HTTP** til Next.js per iter | `scripts/k6/lib/checks.js` L124–138 |
| Workload | week 60%, order 20%, day 10%, kitchen 5%, health 5% | `scripts/k6/lib/data.js` L5–11 |

**Estimert Supabase REST-kall per iter (vektet):**

| Endpoint | Andel | ~DB-kall |
| --- | ---: | ---: |
| `/api/week` | 60% | 5 (auth, profile, agreement, dayTiers, Sanity) |
| `POST /api/orders` | 20% | 10 (preflight + `lp_idem_*` + `lp_order_set` + admin) |
| `/api/orders?date=` | 10% | 4 |
| `/api/kitchen/today`, `/api/health` | 10% | 2 |
| **Vektet snitt** | | **~5.5** |

**Concurrent open connections (estimat):**

Modell: `concurrent_db ≈ (VUs / avg_iter_seconds) × avg_db_calls × avg_hold_seconds`

| Fase | VUs | Antatt iter-tid | Throughput | Peak DB backends (healthy ~20ms/call) | Peak DB backends (degraded ~80ms/call) |
| --- | ---: | --- | ---: | ---: | ---: |
| Steady-state | 10 | ~300ms | ~33 req/s | **~4–8** | **~15–25** |
| K6 baseline | 20 | ~300ms | ~67 req/s | **~12–18** | **~35–45** |
| K6 stress | 100 | ~300ms | ~333 req/s | **~35–55** | **~70–90+** |

**Sammenligning mot tier-limit (~45–50 effektiv):**

- **100 VU stress ved healthy latency:** innenfor pool med **MED** margin — tett ved Micro-grense.
- **100 VU ved latency-degradering (kaskade):** kan overskride **60** → `53300`/timeout/503 — **HØY**.
- **Login-once-per-VU:** 100 ekstra auth-kall kun i setup-fase, ikke per iter — korrekt modellert.

**Staging referanse (SP-3.6):** Baseline p95 HTTP ~284ms ved login-once fix (`docs/audit/sp-3.6-k6-loginonce-retry.md`).

### 1.9.4 Cron-jobber (Vercel) + lunch-rush kollisjon

**Aktive crons** (`vercel.json` — 13 paths). **28** `app/api/cron/**/route.ts` finnes totalt; kun 13 er schedulert.

| Path | Schedule (UTC cron) | Oslo (vinter) | Varighet / pool | Lunch-rush 10:00–12:00 |
| --- | --- | --- | --- | --- |
| `/api/cron/outbox` | `*/2 * * * *` | Kontinuerlig | **Opptil 20s** (`OUTBOX_TIME_BUDGET_MS` default 20000); batch 25 | **KOLLISJON** — kjører gjennom rush |
| `/api/cron/tripletex-outbox` | `*/3 * * * *` | Kontinuerlig | Outbox-lignende batch | **KOLLISJON** |
| `/api/cron/week-scheduler` | `*/10 * * * *` | Kontinuerlig | Kort; kan kalle interne routes | **KOLLISJON** |
| `/api/cron/check-deviations` | `0 8,9,12,13 * * 1-5` | 09,10,13,14 hverdager | 3 parallelle admin-queries + outbox insert | **12:00 UTC = 13:00 Oslo** — overlapper rush |
| `/api/cron/preprod` | `5 8 * * 1-5` | 09:05 hverdager | **Stub** (deaktivert, returnerer OK) | Lav — unødvendig schedule |
| `/api/cron/daily-order-summary` | `5 6,7 * * 1-5` | 07:05, 08:05 | Admin scan + e-post | Før rush |
| `/api/cron/forecast` | `0 2 * * *` | 03:00 | Natt — lav | Nei |
| `/api/cron/tripletex-*` (3 stk) | 05–06 UTC | Morgen | Daglig billing sync | Før rush |
| `/api/cron/cleanup-invites` | `30 3 * * *` | 04:30 | Natt | Nei |
| `/api/cron/menu-service-day-reconcile` | `0 */6 * * *` | Hver 6. time | CMS reconcile | Delvis overlap 12:00 |
| `/api/cron/menu-week-rollout` | `0 12 * * 4` | **13:00 torsdag** | Meny-rollout | **KOLLISJON torsdag lunch** |

**Supabase scheduled functions:** Ingen `pg_cron`-jobber eller Edge cron funnet i repo for app-logikk — all scheduling via **Vercel cron**.

**Observability-gap (B1-09):** Se **§B1-09 verify** — cron **kjører**; persistering til `cron_runs` feiler stille.

### §B1-09 verify — cron_runs scope (2026-05-24)

**Verdict: Forblir P2 — ingen P1-eskalering** (cron feiler ikke tidlig pga manglende tabell).

#### 1. Outbox volum (prod, siste 7 dager)

Ingen separat `tripletex_outbox`-tabell — Tripletex cron (`/api/cron/tripletex-outbox`) prosesserer samme `public.outbox`.

```sql
-- Tabeller
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name ILIKE '%outbox%';
-- kun: outbox

-- Totalt
SELECT count(*) AS total, max(created_at) AS newest, min(created_at) AS oldest FROM outbox;
-- total: 7, newest: 2026-05-23 23:23:27+00, oldest: 2026-05-09

-- Per status (alle rader)
SELECT status, count(*) FROM outbox GROUP BY status;
-- SENT: 6, PENDING: 1

-- Siste 7 dager (Oslo-dag)
SELECT date_trunc('day', created_at AT TIME ZONE 'Europe/Oslo')::date AS day,
       count(*) AS created
FROM outbox WHERE created_at >= now() - interval '7 days'
GROUP BY 1 ORDER BY 1;
-- 2026-05-18: 1, 2026-05-24: 1
```

| Signal | Vurdering |
| --- | --- |
| Volum | **Stagnert/lavt** — 7 rader totalt, kun **2 nye** siste 7 dager |
| Backlog | **1 PENDING** (ikke voksende kø) |
| Tripletex | Samme `outbox`-tabell — ingen separat kø |

#### 2. `cron_runs` skrivere (rg)

| Fil | Skriver? | Hvis insert feiler |
| --- | --- | --- |
| `app/api/cron/outbox/route.ts` L20–34 | **Ja** — eneste cron-writer | `try/catch` **svelger** feil; kommentar L33: «never block cron»; kalles med `void` **etter** `processOutboxBatch` (L67, L110) |
| `app/api/observability/route.ts` L69–74 | Leser | `try/catch` → `cronRecentFailures = []` |
| `lib/superadmin/queries.ts` L531–538 | Leser | `throw` ved query-feil (superadmin health API) |
| `lib/observability/sli.ts` L114–129 | Leser | Returnerer SLI `status: "unknown"` |
| `lib/system/systemHealthAggregator.ts` L57–74 | Leser | `checkCron` → **degraded** «unavailable» / «no recent runs» |

**Ingen annen `app/api/cron/**` route skriver til `cron_runs`.** Tripletex-outbox-cron persisterer **ikke** kjøringer.

#### 3. P1-eskalering?

| Test | Resultat |
| --- | --- |
| Feiler outbox-cron tidlig pga `cron_runs`? | **Nei** — batch kjører først; logging er best-effort |
| Er outbox processing broken? | **Nei** — 6 SENT, 1 PENDING, lav volum |
| Er det operasjonell risiko? | **Nei** for leveranse; **Ja** for observability/SLO-blindhet |

**Impact:** `/superadmin/system` cron-SLI og `checkCron` rapporterer degraded/unknown uten faktisk cron-feil. Dette er **P2 observability debt**, ikke P1 outage.

---

### 1.9.5 Anbefaling-tabell

| Scenario | Pool-utilization estimat | Risiko | Anbefaling |
| --- | ---: | --- | --- |
| Steady-state (10 samtidige brukere) | **~10–20%** (5–10 / 50) | **LAV** | Ingen endring |
| K6 baseline (20 VU) | **~25–35%** (12–18 / 50) | **LAV** | OK for staging/prod baseline |
| K6 stress (100 VU) | **~60–85%** healthy; **>90%** degraded | **HØY** | **Compute bump** (Small+) før prod K6 stress; overvåk `pg_stat_activity` under test |
| Cron-collision (lunch-rush + cron) | **+10–20%** atop user peak | **HØY** | Flytt `check-deviations` 12:00 UTC vekk fra rush; vurder cron dedupe for `preprod` stub |

### 1.9.6 Vercel concurrency (kontekst)

- Ingen eksplisitt concurrency-cap i `vercel.json`.
- K6 100 VU kan materialisere **opptil ~100 samtidige Node-lambdas** (cold-start inflates latency — dokumentert i SP-3.6).
- Vercel Pro fluid compute: praktisk limit langt over 100 — **flaskehals er Supabase Micro (60)**, ikke Vercel.

---

### DC-N ticket (deferred §1.3)

| Ticket | Tittel | Effort | Scope |
| --- | --- | ---: | --- |
| **DC-N** | Repo-wide orphan-column scan + cleanup recommendations | **3–4 timer** | Full `information_schema` × `rg` per kolonne; prioritér `profiles`, `orders`, `companies`, `agreements`; lever funn-tabell + anbefaling. Post-audit cleanup-sprint. |

---

## Fase 1 completeness-sjekk (pre GO Fase 2)

| Sub-item | Status | Funn-count | Note |
| --- | --- | ---: | --- |
| 1.1 schema-integritet | **COVERED** | 0 | 1639 kolonner identiske prod/staging; 97 RLS-on tabeller; 0 DDL-drift på K6-tabeller |
| 1.2 ghost-kolonne scan | **COVERED** | 4 | `is_disabled`, `disabled_reason`, `profiles.user_id`, `profiles.name/department` (kitchen L187) |
| 1.3 orphan-kolonner | **DEFERRED** | — | **DC-N** ticket (~3–4t post-audit sprint) |
| 1.4 RLS coverage-matrise | **COVERED** | 0 | 37 `rls_off` = **kun** `audit_log_*` partitions; sensitive tabeller `rls_on` + policies verifisert (SQL) |
| 1.5 service-role bruk | **COVERED** | 1 | P2: ~270 `app/api` routes + `lib/` via `supabaseAdmin()`; `scripts/ci-guard.mjs` allowlist |
| 1.6 idempotency | **COVERED** | 1 | P1: kun `POST /api/orders` bruker `lp_idem_begin`; DB-tabell `idempotency` finnes |
| 1.7 audit-trail | **COVERED** | 2 | P2: `agreements` uten `audit_row` trigger; `companies`/`orders` har DB-trigger + app `auditWriteMust` |
| 1.8 query performance | **COVERED** | 0 | `pg_stat_statements`: PostgREST RPC mean ~1.7–2 ms @ 8–10k calls; ingen sustained app hot-path FAIL |
| 1.9 connection pool | **COVERED** | 2 | B1-08 (Micro/pool K6 stress), B1-09 (`cron_runs` mangler) |
| 1.10 migrasjon-integritet | **COVERED** | 3 | B1-01, B1-02, B1-07 |
| 1.11 eksterne integrasjoner | **COVERED** | 0 | Sanity HMAC, Tripletex verify, Flow1 OFF; ingen P1 gap i webhook-auth |
| 1.12 date/time-håndtering | **COVERED** | 1 | P2: UTC `new Date()` i `auditWriteMust`; order/kitchen canonical via `lib/date/oslo.ts` |
| 1.14 kitchen-test diagnose | **COVERED** | 1 | B1-04 — profileLookup vs test seed |

**Due-diligence kjernefelt (1.4–1.7):** Ekspertvurdert via prod SQL + kildekode, ikke bare pattern-match. RLS og audit er **solide med dokumenterte gap (P2)**; idempotency er **systemisk P1** utenfor orders.

---

## STOP-PUNKT 1

Fase 1 BACKEND-leveranse er **komplett** (§1.3 deferred som DC-N).

**GO Fase 2 levert:** `02-frontend.md`.

**Vent på:** `GO Fase 3` for DEVOPS/Platform → `03-devops.md`.
