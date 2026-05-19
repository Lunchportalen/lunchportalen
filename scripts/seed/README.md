# B4 volume seed scripts

TypeScript strict seed infrastructure for staging branch `uigxsboqeruxflgzqztl` (Variant C).

**Email domain (only):** `*@staging.lunchportalen.test`

## Prerequisites

1. Gitignored env extract: `scripts/audit/staging-env-actual-2026-05-20.env`
2. Must include (active, uncommented):
   - `NEXT_PUBLIC_SUPABASE_URL` (staging ref)
   - `SUPABASE_SERVICE_ROLE_KEY` (~200 chars JWT)
   - `DATABASE_URL` — **Supavisor pooler** from branch CLI `POSTGRES_URL`  
     (`aws-0-<region>.pooler.supabase.com:6543`, user `postgres.<branch-ref>`)
   - `POSTGRES_URL_NON_POOLING` (direct `db.<ref>.supabase.co:5432`, IPv6-only — opt-in only)
3. **Do not** point seed at `.env.local` if it contains prod `hkpokyapzarefrgqzkos`.

Regenerate DB URLs (authoritative pooler host per branch):

```bash
npx supabase branches get uigxsboqeruxflgzqztl --project-ref hkpokyapzarefrgqzkos -o env
```

Copy `POSTGRES_URL` → `DATABASE_URL` in the extract. Do not guess pooler region (`aws-0` vs `aws-1`).

**Connection mode (default):** pooler (`DATABASE_URL`).  
**Direct IPv6 (optional):** `SEED_USE_DIRECT=true` uses `POSTGRES_URL_NON_POOLING` + `dns.resolve6` shim.

**Supavisor transaction mode:** `pg.Pool` uses `prepare: false` when on pooler (prepared statement quirk).

## Commands

```bash
# Dry-run wipe (counts only)
npm run seed:wipe -- --target staging

# Execute wipe
npm run seed:wipe -- --target staging --confirm

# Hello seed (1 company + 10 users)
npm run seed:hello -- --target staging

# B4.1 dry-run (100 companies × 10K users)
npm run seed:dry-run -- --target staging
```

Override env file:

```bash
set SEED_ENV_FILE=scripts/audit/staging-env-actual-2026-05-20.env
```

## Guards (fail-closed)

- Requires `--target staging`
- Refuses prod project ref `hkpokyapzarefrgqzkos` in Supabase/DB URLs
- Requires staging ref `uigxsboqeruxflgzqztl` in DB URLs
- Refuses service role key shorter than 100 chars
- All seeded emails must end with `@staging.lunchportalen.test`

## Architecture

| Path | Role |
|------|------|
| `core/env.ts` | Env load + Variant C guards |
| `core/pool.ts` | `pg.Pool` (pooler default, `SEED_POOL_MAX`) |
| `core/pareto.ts` | Pareto company size distribution |
| `core/fingerprint.ts` | Dataset hashes for determinism checks |
| `auth/parallel.ts` | Parallel auth create/delete workers |
| `runner/dry-run.ts` | B4.1: 10K users / 100 companies |
| `core/logger.ts` | JSON logs → `scripts/seed/logs/` |
| `faker-norwegian/` | `nb_NO`, `faker.seed(42)` |
| `auth/admin-api.ts` | Supabase Auth Admin API |
| `runner/wipe.ts` | Teardown staging test data |
| `runner/hello.ts` | F1: 1 firma + 10 brukere |

## Hello seed flow

1. Create 10 `auth.users` (sequential, deterministic UUID + password)
2. Transaction: `companies` (default_location NULL) → `company_locations` → UPDATE default_location
3. Insert 10 `profiles` (user 1 = `company_admin`, rest `employee`)
4. `company_memberships` / `location_memberships` via `trg_profiles_sync_memberships`

## Determinism

- Faker seed `42`
- Emails: `hello.{asciiSlug(first)}.{asciiSlug(last)}{index}@staging.lunchportalen.test`
- Passwords: `Staging{sha256(email)[0:12]}!2026`
- Company/location UUIDs: deterministic from seed namespace

Re-run: `seed:wipe --confirm` then `seed:hello`.

### Canonical fingerprint algorithm

Used by `core/fingerprint.ts` (`hashSortedStrings`) and STEG 5 MCP verification:

1. Collect all emails (lowercase trim per value).
2. **Sort:** `ORDER BY lower(email) COLLATE "C"` (byte order; matches Node `Array.sort()` on strings).
3. **Join** with **pipe** `|` — not comma.
4. **Hash:** MD5 hex digest of the joined string.

**MCP SQL (10K staging profiles):**

```sql
SELECT md5(string_agg(lower(email), '|' ORDER BY lower(email) COLLATE "C")) AS full_emails_hash
FROM public.profiles
WHERE email LIKE '%@staging.lunchportalen.test';
```

**Wrong patterns (do not use for acceptance):**

- `string_agg(..., ',')` — wrong separator.
- Default locale sort without `COLLATE "C"` — wrong order vs Node.
- `ORDER BY lower(email) LIMIT 10` — alphabetic subset, **not** F1 first10.

### F1 `first10` definition

- **Global index 0–9** in the Faker stream (`buildHelloUsers` / first 10 rows of `buildDryRunUsers`).
- **Not** the alphabetically first 10 emails in the database.
- Verification: Node `buildDryRunUsers(10000)` → `first10Emails` (globalIndex &lt; 10) → `hashSortedStrings`, **or** MCP with global index filter:

```sql
SELECT md5(string_agg(lower(email), '|' ORDER BY lower(email) COLLATE "C")) AS first10_emails_hash
FROM public.profiles
WHERE email LIKE '%@staging.lunchportalen.test'
  AND (substring(email FROM '([0-9]+)@staging\.lunchportalen\.test$'))::int BETWEEN 0 AND 9;
```

### B4.1 baselines (reference)

| Fingerprint | MD5 |
|-------------|-----|
| `first10_emails_hash` (F1 lineage) | `6426909b2e5c0d63c44d31ffc6776ce1` |
| `full_emails_hash` (10K) | `6463484f2380d1edd39911d793ff118a` |
| `company_names_hash` | `8d20160b56044052188b14af384274ff` |
| `location_names_hash` | `727b581049e1f424bf8d508a1889f573` |

### `asciiSlug` (email local-part)

**Background:** Faker `nb_NO` produces names with **æ / ø / å**. Supabase Auth rejects non-ASCII in the email local-part (`invalid format`).

**Fix** (`faker-norwegian/index.ts` → `helloEmail` / `dryRunEmail`):

- `æ` → `ae`, `ø` → `o`, `å` → `a` (after lowercasing)
- Strip with `[^a-z0-9]`, then `slice(0, 24)` per name part
- Format unchanged: `hello.{fn}.{ln}{globalIndex}@staging.lunchportalen.test`

F1 (indices 0–9) had no æøå by chance; **after fix, `first10_emails_hash` is unchanged** (verified in Node and staging DB).

### Wipe modes (`runner/wipe.ts`)

| Mode | When | Behaviour |
|------|------|-------------|
| **Serial** | `auth.users` staging count &lt; 100 (and not scale profile wipe) | 1 worker |
| **Parallel scale** | ≥ 50 staging profiles | `SEED_ORPHAN_DELETE_WORKERS` (default **4**), 1% progress via `createBatchLogger`, delete retry/backoff |
| **Parallel orphan** | `profiles = 0` **and** staging `auth.users` ≥ 100 | Same delete workers (default **4**), progress every 1000 deletes |

**DELETE asymmetry (B4.1 finding):** CREATE uses 10 workers; DELETE uses **4** + exponential backoff. B4.1 scale-wipe at 10 workers hit `fetch failed` / timeouts. Wipe acceptance: **complete without fatal** (no fixed duration gate).

Estimates: ~11 s per 100 orphans (serial); parallel orphan/scale depends on Auth API stability.

## Logs

Audit trail: `scripts/seed/logs/{timestamp}-{runner}.jsonl` (gitignored).

On auth failure gate (&gt;5%): `{rid}-failures.jsonl` with `email_hash` only (no cleartext addresses).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `REFUSE_PROD_REF` | Wrong env file; use staging extract |
| `MISSING_POSTGRES_URL_NON_POOLING` | Add DB URLs from `supabase branches get` |
| `auth.admin.createUser failed` | User already exists — run wipe with `--confirm` |
| FK on profiles | Ensure company + location exist before profile insert |
| RLS violation | Seed uses direct `postgres` URL (bypasses RLS) |

## B4.1 dry-run

**Target:** 100 companies, 10 000 users (Pareto-skewed), 100 % real `auth.users`.

```bash
npm run seed:wipe -- --target staging --confirm
npm run seed:dry-run -- --target staging --companies 100 --total-users 10000 --workers 10
```

| Env / flag | Default | Purpose |
|------------|---------|---------|
| `SEED_POOL_MAX` | `15` | `pg.Pool` max connections |
| `SEED_WORKERS` | `10` | Parallel auth workers |
| `--companies` | `100` | Number of companies |
| `--total-users` | `10000` | Total profiles/auth users |
| `--workers` | `10` | Auth parallelism (CLI override) |
| `--seed` | `42` | Faker + Pareto PRNG seed |

**Phases:** auth-first (parallel) → 100 DB transactions (one per company) → fingerprint + smoke.

**Determinism:** Global index `0-9` must match F1 hello emails (`first10_emails_hash`).

**Expected duration:** ~12–22 min (auth-heavy). Do not run `hello` and `dry-run` in parallel.

**Progress logging:** `createBatchLogger` uses **10%** milestones when `total &lt; 50_000` (B4.1 default preserved).

## B4.2.1 scale-up (100K)

**Target:** 1000 companies, 100 000 users (Pareto-skewed, 10× B4.1), 100 % real `auth.users`.

```bash
npm run seed:wipe -- --target staging --confirm
npm run seed:dry-run -- --target staging --companies 1000 --total-users 100000 --workers 10
```

Recommended env for run:

```bash
set SEED_POOL_MAX=15
set SEED_ORPHAN_DELETE_WORKERS=4
```

| Env / flag | Default | Purpose |
|------------|---------|---------|
| `SEED_POOL_MAX` | `15` | `pg.Pool` max connections |
| `SEED_ORPHAN_DELETE_WORKERS` | `4` | Parallel auth **delete** workers (wipe) |
| `SEED_WORKERS` | `10` | Parallel auth **create** workers |
| `--companies` | `1000` | Number of companies |
| `--total-users` | `100000` | Total profiles/auth users |
| `--workers` | `10` | Auth CREATE parallelism (CLI) |

**Progress logging:** auth progress on `totalUsers` (1% when ≥ 50K); DB progress uses `stepPct: 1` when `totalUsers ≥ 50_000` (every 10 companies @ 1000 firms).

**Pareto (seed=42):** sum=100000, p50≈62, p95≈358, ratio=50, ~34 firms at max=500.

**Determinism:** `first10_emails_hash` must remain F1 (`6426909b2e5c0d63c44d31ffc6776ce1`).

### B4.2.1 baselines (reference)

| Fingerprint | MD5 |
|-------------|-----|
| `first10_emails_hash` (F1 lineage) | `6426909b2e5c0d63c44d31ffc6776ce1` |
| `full_emails_hash` (100K) | `b3cfa2dec349592987e83d4c0ae0800e` |
| `company_names_hash` | `fb8033a25c6a74217f3adc34c886d7c1` |
| `location_names_hash` | `66c26d5d97bed0a59923f76c74f13ff7` |

### B4.2.1 performance baseline (verified)

| Phase | Duration | Throughput / detail |
|-------|----------|---------------------|
| Auth | 87 min | 22.27/s, p95=586 ms, 0 failures, 0×429 |
| DB | 12 min | 1000 TX, p50=545 ms, p95=1911 ms, 0 failures |
| **Total** | **87 min** | Under 90–110 min estimate |

**Counts:** 100K profiles + 1000 companies + 100K memberships (both sides).

**Wipe acceptance:** complete without fatal.

**Memory (100K):** pre-generate all user specs (~120 MB heap observed) — OK for B4.2.1.

### Scale linearity (B4.1 → B4.2.1)

| Metric | B4.1 (10K) | B4.2.1 (100K) | Observation |
|--------|------------|---------------|-------------|
| Auth throughput | 22.33/s | 22.27/s | Unchanged at 10× scale |
| Auth p95 | 574 ms | 586 ms | Stable |
| Failure rate | 0% | 0% | Consistent |
| Tenant TX p50 | 672 ms | 545 ms | 19% faster (warmup amortised) |

### B4.2.2 (1M) implications

- Linear extrapolation: ~14.5 hours end-to-end — too long for a single session.
- Requires JWT-cache or resume mechanism before attempting 1M.
- Streaming per-company generation required for memory (~1.2 GB at batch pre-gen).
- Not implemented in B4.2.1.

## Next (B4.2.2+)

- JWT-cache for scale (`jose`, offline tokens)
- Streaming user generation per company (1M)
- 1M ramp with HARDGATE
