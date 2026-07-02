# SMART-1 — Database evidence (housekeeping)

**Status:** Housekeeping archived — staging and production verified; RLS golden snapshot refreshed  
**Date:** 2026-07-02 (updated after prod migrate approval)  
**Housekeeping merge (PR #392):** `c6358828b6db29a651c7b8bea7b907d824cb3b6c`  
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
| [28614693722](https://github.com/Lunchportalen/lunchportalen/actions/runs/28614693722) | `push` | `7eaf0fb3…` | **success** |

| Step | Result |
|------|--------|
| Production environment approval | **approved** (2026-07-02) — SMART-1 migration only |
| Preflight dry-run | **PASS** |
| Apply migrations (`20260728120000_menu_content_translations.sql`) | **PASS** |
| Verify migration in `schema_migrations` | **PASS** |
| Verify DB contracts | **PASS** |
| Smoke tests (prod) | **PASS** |
| Typegen (prod) | **PASS** — artifact `typegen=ok` |
| Evidence artifact | **uploaded** — `evidence-prod-7eaf0fb35181ddda3a08e244b83084c05b1b8884` |

Pre-approval verification: push diff contained **only** `supabase/migrations/20260728120000_menu_content_translations.sql` (no unexpected migrations, no env/flag changes).

**Production conclusion:** migrate apply, verify, contracts, smoke, typegen, and evidence **PASS** on prod.

---

## 3. Typegen (`lib/types/database.ts`)

| Item | Status |
|------|--------|
| CI typegen on staging | **PASS** — see artifact `typegen/supabase.types.ts` |
| CI typegen on prod (run 28614693722) | **PASS** — artifact `typegen=ok`; table in `typegen/supabase.types.ts` |
| Repo `lib/types/database.ts` | **UPDATED** (PR #392 on main) — strict `MenuContentTranslationsTable`; workflow did **not** commit a new typegen file |
| Runtime imports of table type | **None** — no employee/provider runtime wiring |

Required columns present in Row type: `id`, `provider_id`, `source_kind`, `source_ref`, `field`, `locale`, `original_text`, `original_text_hash`, `translated_text`, `status`, `approved_by`, `approved_at`, `created_at`, `updated_at`.

---

## 4. Target DB table verify

Verified via:

1. PR #391 CI `db-push.log` + schema_migrations verify (staging)  
2. Prod workflow run 28614693722 apply + verify steps (production)  
3. Integration probe: `RUN_SUPABASE_INTEGRATION_TESTS=1` — `table exists when migration is applied` **PASS** (staging target in harness)  
4. Static migration contract tests (`tests/lib/smart-menu/menuContentTranslationsMigration.test.ts`)  
5. Refreshed RLS golden snapshot against prod ref `hkpokyapzarefrgqzkos` (§6)

| Property | Staging (uigx) | Production |
|----------|----------------|------------|
| Table `public.menu_content_translations` exists | **yes** | **yes** |
| RLS enabled | **yes** | **yes** — `policy_count: 5` in golden snapshot |
| Anon access revoked | **yes** | **yes** — migration `REVOKE ALL … FROM PUBLIC, anon` |
| No broad authenticated SELECT | **yes** | **yes** — `can_access_provider(provider_id)` on SELECT |
| Provider-scoped policies | **yes** | **yes** — `select_provider_scope`, `insert_provider_admin`, `update_provider_admin` |
| Employee direct access | **denied** | **denied** — no employee/company policy; no `using true` for authenticated |
| `menu_content_translations_approved_lookup_idx` | **yes** | **yes** (migration partial index) |
| CHECK / UNIQUE constraints | **yes** | **yes** (migration) |
| DELETE for authenticated | **denied** | **denied** — no DELETE policy for authenticated |

---

## 5. Integration RLS test

Command:

```bash
RUN_SUPABASE_INTEGRATION_TESTS=1 npx vitest run tests/db/menu-content-translations-rls.test.ts
```

| Result | Detail |
|--------|--------|
| **1 passed, 7 skipped** | `table exists when migration is applied` **PASS** (2026-07-02 re-run) |
| Skipped behavioral tests | Vitest `test.skipIf(!tableReady)` evaluated at collection time before `beforeAll` sets `tableReady=true` — **7 behavioral tests still skipped**; do not report as PASS |

Behavioral integration (provider scope, employee deny, CHECK, DELETE deny) **not executed** due to harness timing. Static migration contracts + prod RLS golden snapshot are authoritative for policy shape until a test-only PR fixes `describe.runIf` / lazy skip.

---

## 6. RLS snapshot / drift

| Item | Status |
|------|--------|
| `tests/rls/golden-rls-snapshot.json` | **UPDATED** (2026-07-02) — `generated_at` after prod migrate; includes `menu_content_translations` (5 policies) |
| `npm run rls:snapshot` | **PASS** — 259 policies, 48 private functions, 147 RLS-enabled tables @ `hkpokyapzarefrgqzkos` |
| `npm run check:rls-drift` | **PASS** — golden vs live match (2026-07-02) |

Captured `menu_content_translations` policies (prod):

| Policy | Command | Roles | Scope |
|--------|---------|-------|-------|
| `menu_content_translations_service_role_all` | ALL | `service_role` | service bypass |
| `menu_content_translations_superadmin_all` | ALL | `authenticated` | `is_platform_admin()` |
| `menu_content_translations_select_provider_scope` | SELECT | `authenticated` | `can_access_provider(provider_id)` |
| `menu_content_translations_insert_provider_admin` | INSERT | `authenticated` | provider_admin membership check |
| `menu_content_translations_update_provider_admin` | UPDATE | `authenticated` | provider_admin membership check |

No anon policies. No authenticated DELETE policy. No employee direct SELECT policy.

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
| Production migration applied | **yes** — run [28614693722](https://github.com/Lunchportalen/lunchportalen/actions/runs/28614693722) |
| Repo types include `menu_content_translations` | **yes** (PR #392 on main) |
| RLS golden snapshot includes new policies | **yes** — pending merge of prod RLS evidence PR |
| RLS drift guard green | **yes** (local, post-snapshot) |
| Full integration RLS behavioral suite | **no** — 7 tests skipped (harness); needs test-only fix |
| Employee translation runtime | **no** — not started |
| Provider approval API/UI | **no** — not started |
| Flags / G5d.8 / cutover | **no** — not started |

**Recommendation:** Owner may give explicit GO for **SMART-2 provider-side API/storage work** against verified prod schema + RLS snapshot. Do **not** start employee overlay, flags, cutover, or PR #389 merge without separate owner GO.

---

## 9. Related docs

- Architecture: [smart-menu-language-profile-currency.md](./smart-menu-language-profile-currency.md)
- Migration: `supabase/migrations/20260728120000_menu_content_translations.sql`
- Static contracts: `tests/governance/smart-menu-translation-model-contracts.test.ts`
