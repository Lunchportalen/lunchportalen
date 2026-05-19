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
| **Parallel scale** | ≥ 50 staging profiles | 10 workers, 25% progress logs |
| **Parallel orphan** | `profiles = 0` **and** staging `auth.users` ≥ 100 | 10 workers, progress every 1000 deletes |

Estimates: ~11 s per 100 orphans; ~1–3 min for 10K auth-only orphans (vs ~20 min serial).

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
| `SEED_POOL_MAX` | `10` | `pg.Pool` max connections |
| `SEED_WORKERS` | `10` | Parallel auth workers |
| `--companies` | `100` | Number of companies |
| `--total-users` | `10000` | Total profiles/auth users |
| `--workers` | `10` | Auth parallelism (CLI override) |
| `--seed` | `42` | Faker + Pareto PRNG seed |

**Phases:** auth-first (parallel) → 100 DB transactions (one per company) → fingerprint + smoke.

**Determinism:** Global index `0-9` must match F1 hello emails (`first10_emails_hash`).

**Expected duration:** ~12–22 min (auth-heavy). Do not run `hello` and `dry-run` in parallel.

## Next (B4.2+)

- JWT-cache for scale (`jose`, offline tokens)
- Parallel auth batching
- 10K / 100K / 1M ramps with HARDGATE
