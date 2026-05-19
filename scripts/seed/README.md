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
| `core/pool.ts` | `pg.Pool` (max 5, SSL) |
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
- Emails: `hello.{first}.{last}{index}@staging.lunchportalen.test`
- Passwords: `Staging{sha256(email)[0:12]}!2026`
- Company/location UUIDs: deterministic from seed namespace

Re-run: `seed:wipe --confirm` then `seed:hello`.

## Logs

Audit trail: `scripts/seed/logs/{timestamp}-{runner}.jsonl` (gitignored).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `REFUSE_PROD_REF` | Wrong env file; use staging extract |
| `MISSING_POSTGRES_URL_NON_POOLING` | Add DB URLs from `supabase branches get` |
| `auth.admin.createUser failed` | User already exists — run wipe with `--confirm` |
| FK on profiles | Ensure company + location exist before profile insert |
| RLS violation | Seed uses direct `postgres` URL (bypasses RLS) |

## Next (B4.2+)

- JWT-cache for scale (`jose`, offline tokens)
- Parallel auth batching
- 10K / 100K / 1M ramps with HARDGATE
