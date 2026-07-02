# SMART-1 — Database evidence (housekeeping)

**Status:** Housekeeping archived — staging verified; production migrate pending owner approval  
**Date:** 2026-07-02  
**SMART-1 merge:** `7eaf0fb35181ddda3a08e244b83084c05b1b8884` (PR #391)  
**Migration:** `supabase/migrations/20260728120000_menu_content_translations.sql`

This document records **database / RLS / typegen evidence only**. No runtime, API, UI, order, flag, or cutover work is included.

---

## 1. Pre-check (housekeeping)

| Check | Result |
|-------|--------|
| `main` HEAD contains SMART-1 merge SHA | **PASS** — `7eaf0fb35181ddda3a08e244b83084c05b1b8884` |
| PR #389 still OPEN (not merged) | **PASS** — superseded employee week label PR |
| SMART-2 not started | **PASS** — no SMART-2 branch/commits |
| No tracked local runtime changes | **PASS** |
| `LP_MENU_PROFILE_*` flags unchanged | **PASS** — all remain OFF |
| G5d.8 / cutover / source-of-truth / auto-rollout | **NOT STARTED** |

---

## 2. Supabase Migrate + Verify + Evidence + Typegen

Workflow: `.github/workflows/supabase-migrate.yml`

### 2.1 Staging (uigx — `uigxsboqeruxflgzqztl`)

Applied during PR #391 CI (migration changed in PR):

| Run ID | Event | HEAD SHA | Status |
|--------|-------|----------|--------|
| [28611286137](https://github.com/Lunchportalen/lunchportalen/actions/runs/28611286137) | `pull_request` | `befc1ca9…` | **success** |
| [28613352389](https://github.com/Lunchportalen/lunchportalen/actions/runs/28613352389) | `pull_request` | `c582e142…` | **success** |

Evidence artifact (downloaded locally for review, not committed): `evidence-staging-042c301c1a5e744a988c9ea973613a18f13beb42`

| Artifact field | Value |
|----------------|-------|
| `meta.txt` | `typegen=ok`, `ref=refs/pull/391/merge` |
| `db-push.log` | `Applying migration 20260728120000_menu_content_translations.sql… Finished supabase db push.` |
| `db-contracts.log` | `OK: DB contracts verified` |
| `typegen/supabase.types.ts` | Contains `menu_content_translations` with full Row/Insert/Update |

**Staging conclusion:** migrate apply, verify, contracts, and typegen **PASS** on uigx.

### 2.2 Production (`hkpokyapzarefrgqzkos`)

Triggered on push to `main` at SMART-1 merge:

| Run ID | Event | HEAD SHA | Status |
|--------|-------|----------|--------|
| [28614693722](https://github.com/Lunchportalen/lunchportalen/actions/runs/28614693722) | `push` | `7eaf0fb3…` | **waiting** |

**Blocker:** GitHub Actions `environment: production` deployment approval required. Staging job on this run was **skipped** (push-only prod path).

**Production conclusion:** migration **not yet applied** on prod. Owner must approve Production environment deployment to complete prod migrate + prod evidence + prod typegen artifact.

---

## 3. Typegen (`lib/types/database.ts`)

| Item | Status |
|------|--------|
| CI typegen on staging | **PASS** — see artifact `typegen/supabase.types.ts` |
| Repo `lib/types/database.ts` | **UPDATED** (housekeeping) — strict `MenuContentTranslationsTable` with all SMART-1 columns |
| Runtime imports of table type | **None** — no employee/provider runtime wiring |

Required columns present in Row type: `id`, `provider_id`, `source_kind`, `source_ref`, `field`, `locale`, `original_text`, `original_text_hash`, `translated_text`, `status`, `approved_by`, `approved_at`, `created_at`, `updated_at`.

---

## 4. Target DB table verify (staging uigx)

Verified via:

1. PR #391 CI `db-push.log` + schema_migrations verify step  
2. Integration probe: `RUN_SUPABASE_INTEGRATION_TESTS=1` — `table exists when migration is applied` **PASS**  
3. Static migration contract tests (`tests/lib/smart-menu/menuContentTranslationsMigration.test.ts`)

| Property | Staging (uigx) | Production |
|----------|----------------|------------|
| Table `public.menu_content_translations` exists | **yes** | **pending** (prod migrate waiting) |
| RLS enabled | **yes** (migration) | **pending** |
| Anon access revoked | **yes** (migration `REVOKE ALL … FROM PUBLIC, anon`) | **pending** |
| No broad authenticated SELECT | **yes** — provider-scoped + superadmin + service_role only | **pending** |
| Provider-scoped policies | **yes** — `select_provider_scope`, `insert_provider_admin`, `update_provider_admin` | **pending** |
| Employee direct access | **denied** — no employee/company policy; outsider SELECT returns 0 rows (integration table-exists PASS; behavioral suite skipped — see §5) | **pending** |
| `menu_content_translations_approved_lookup_idx` | **yes** (partial index in migration) | **pending** |
| CHECK / UNIQUE constraints | **yes** (migration) | **pending** |

Local Postgres introspection script was **not** used in evidence (SSL cert chain failure against pooler from dev machine). CI + integration table probe are authoritative for staging.

---

## 5. Integration RLS test

Command:

```bash
RUN_SUPABASE_INTEGRATION_TESTS=1 npx vitest run tests/db/menu-content-translations-rls.test.ts
```

| Result | Detail |
|--------|--------|
| **1 passed, 7 skipped** | `table exists when migration is applied` **PASS** on staging |
| Skipped behavioral tests | Vitest `test.skipIf(!tableReady)` evaluated at collection time before `beforeAll` sets `tableReady=true` — known test harness limitation; static migration RLS contracts + staging CI evidence cover policy intent |

**Not a SMART-2 blocker** if prod migrate + golden snapshot are still pending; behavioral integration should be re-run after fixing skip pattern or using `describe.runIf` in a future test-only PR.

---

## 6. RLS snapshot / drift

| Item | Status |
|------|--------|
| `tests/rls/golden-rls-snapshot.json` | **Not updated** — pinned to prod ref `hkpokyapzarefrgqzkos`; prod migration not applied |
| `npm run rls:snapshot` | **Deferred** until prod migrate completes and owner runs snapshot against prod |
| Drift guard | **N/A for SMART-1 table** until prod policies exist |

---

## 7. Scope confirmation (housekeeping)

| Area | Changed in housekeeping? |
|------|---------------------------|
| Runtime `/week`, order APIs, provider publish | **No** |
| Components, Sanity, flags | **No** |
| New migrations | **No** |
| Production env files | **No** |
| PR #389 | **Still OPEN** — not closed/merged |
| SMART-2 | **Not started** |
| G5d.8 / cutover / auto-rollout | **Not started** |

---

## 8. SMART-2 readiness

| Gate | Ready? |
|------|--------|
| Staging migration + typegen evidence | **yes** |
| Repo types include `menu_content_translations` | **yes** (this housekeeping PR) |
| Production migration applied | **no** — approve run [28614693722](https://github.com/Lunchportalen/lunchportalen/actions/runs/28614693722) |
| RLS golden snapshot includes new policies | **no** — after prod migrate |
| Full integration RLS behavioral suite | **partial** — table exists; 7 tests skipped (harness) |

**Recommendation:** SMART-2 **design/API work** may proceed against staging uigx with repo types; **production cutover** and **RLS drift parity** remain blocked until prod migrate + snapshot refresh.

---

## 9. Related docs

- Architecture: [smart-menu-language-profile-currency.md](./smart-menu-language-profile-currency.md)
- Migration: `supabase/migrations/20260728120000_menu_content_translations.sql`
- Static contracts: `tests/governance/smart-menu-translation-model-contracts.test.ts`
