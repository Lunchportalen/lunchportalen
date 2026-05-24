# SP-3.5 — K6 Del 4.5 Foundation Retry Report

**Dato:** 2026-05-24  
**Stop-punkt:** 3.5 (vent `GO Del 5`)  
**Env:** staging `https://staging.app.lunchportalen.no` · Supabase `uigxsboqeruxflgzqztl`

---

## Resultat-tabell

| Sak | Status |
|-----|--------|
| GRANT-migrasjon | **OK** — `20260624120000_k6_staging_grants.sql` applied + `has_table_privilege` verified |
| Sikkerhets-tester orders GET | **5/5 PASS** — `tests/api/orders-get-scope.test.ts` |
| 20 testbrukere seeded | **OK** — count=20, `provision-k6-pool.mjs` 20/20, probe k6-vu-01 OK |
| Retry smoke (pool) | **FAIL (thresholds)** — checks 100%, `day_view`/`week_browse` p95 over staging limits (transient cold) |
| Retry smoke (shared user, no pool) | **PASS** (SP-3 original) — referanse |
| Retry baseline (pool) | **FAIL** — `http_req_failed` 5.26% > 5% (77× login 401); endpoint checks **PASS** when authed |
| Login 401 count | **77** (304 login attempts, 74% success) at abort ~11 VUs / 2m38s |
| Endpoint p95 (staging thresholds) | se tabell under |
| Top 3 slow queries (pgss diff) | `agreement_delivery_days` +252 calls; `lp_order_set` ~18ms mean; `closed_dates` ~6ms mean |
| DC-033-kandidater | Order preflight **chain latency** (~2.6s p95), not single SQL >500ms |

---

## Endpoint p95 vs staging thresholds

| Endpoint | p95 (final baseline) | Threshold | Holdt? |
|----------|---------------------|-----------|--------|
| login | — | — | 77× 401 under concurrent login |
| week_browse | 1130ms | <1500ms | ✓ |
| day_view | 1480ms | <1500ms | ✓ |
| order_place | 2850ms | <3500ms | ✓ |
| kitchen_view | 396ms | <800ms | ✓ |
| health | 864ms | <1200ms | ✓ |
| http_req_failed | **5.26%** | **<1%** (staging calibrated: <5% abort) | **✗** |

**Artefakter:** `scripts/k6/results/baseline-pool-final-20260524.log`, HTML `2026-05-23T21-57-*` (siste full run)

---

## Root cause — retry baseline FAIL

1. **Foundation fixed:** 20 unike pool-brukere eliminerer session-kollisjon (SP-3: 130× 401 på én bruker).
2. **Gjenstående:** Concurrent `POST /api/auth/login` fra samme IP under ramp → **~26% login 401** (Supabase/Vercel rate pressure). API-kall etter vellykket login er OK (week/day/order checks grønne).
3. **Ikke SQL:** pg_stat_statements viser ingen query >500ms mean; order p95 er kumulativ preflight.

---

## Leveranser Del 4.5

| Fil | Formål |
|-----|--------|
| `supabase/migrations/20260624120000_k6_staging_grants.sql` | GRANTs i git |
| `supabase/migrations/20260624120100_k6_test_users.sql` | 20 K6 VU-brukere |
| `scripts/k6/provision-k6-pool.mjs` | Passord reset → `K6_POOL_PASSWORD` |
| `scripts/k6/lib/auth.js` | `getUserForVu`, pool-aware `ensureVuAuth` |
| `tests/api/orders-get-scope.test.ts` | Tenant scope etter `b708e545` |
| `docs/audit/dc-032-staging-paritet-K6.md` | Security delta |
| `scripts/k6/results/pgss-before-*.txt` / `pgss-after-*.txt` | Latency diagnose |

---

## Anbefaling før Del 5 (prod)

**Ikke GO prod** uten én av:

- **A)** K6 auth via long-lived token/header (unngå login-storm), eller login-once-per-VU med cookie-header fix (k6 goja)
- **B)** Stagger/rate-limit login i k6 (`sleep` per VU ved ramp)
- **C)** Aksepter baseline med justert login-feilrate etter dokumentert Supabase Auth limit — **ikke** uten eksplisitt godkjenning

**Capacity (DC-033):** Order write ~2.6s p95 under 11 VUs er reell app-perf; vurder preflight parallelisering / caching før prod soak.

---

## STOP-PUNKT 3.5

Baseline **nesten** grønn (endpoint latency OK, login 401 marginal). Foundation **OK**.  
→ **`GO Del 5`** krever beslutning om login-strategi + aksept av order latency.
