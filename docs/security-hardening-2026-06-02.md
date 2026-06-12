# Security Hardening Record — 2026-06-02

**Scope:** `app.lunchportalen.no` (Next.js + Supabase). Prod project `hkpokyapzarefrgqzkos`, staging/scratch `uigxsboqeruxflgzqztl`.
**Status:** CLOSED — all findings fixed, applied to production, and verified live.
**Authorization (prod writes):** [Thomas: fill exact go timestamp(s)]

---

## Summary

A routine RLS golden-snapshot drift alert (#23) was held for verification rather than blindly re-baselined. The verification surfaced a real privilege-escalation bug in the company-lifecycle RPCs. Closing it exposed two further latent problems: a CI migration gate that silently skipped database pushes while reporting green, and the absence of a guard preventing a staging-intended write from reaching production (which had already caused one harmless accidental prod write). All three were fixed with deterministic, regression-tested changes, applied to production, and verified live (not via CI status alone). The production migration path now works end-to-end with a fail-closed environment guard on every write.

---

## Finding 1 — Privilege escalation in company-lifecycle RPCs (CRITICAL, fixed)

**What.** The gate function `private.lp_assert_provider_admin_access`, despite its name, had body `is_platform_admin() OR can_access_provider(p)` — i.e. it admitted *any* provider member, not only `provider_admin`. It gated four admin-only RPCs: `lp_company_suspend`, `lp_company_pause`, `lp_company_resume`, `lp_company_delete`.

**Impact.** The application route (`/leverandor/kunder`) checks `provider_admin`, but the database layer was not fail-closed: a `provider_kitchen` or `provider_viewer` member could call these RPCs directly (e.g. `supabase.rpc()` / PostgREST), bypassing the route, and suspend/pause/resume/soft-delete a company.

**Scope.** Bounded — requires an authenticated provider member and a direct RPC call; not exploitable cross-tenant or by the public (`can_access_provider` scopes to the caller's own provider).

**How found.** RLS drift #23 was verified before re-baseline: read-only enumeration of every new policy/function/table by name, mapping each to a known migration, then a per-function scope check. The `*_admin_access` name/behaviour mismatch was flagged and resolved by enumerating its callers — all four were admin-only operations.

**Fix (PR #92, migration `20260618120000_lp_company_lifecycle_strict_provider_gate`).** Re-pointed all four RPCs to `lp_assert_provider_admin_or_superadmin(v_provider_id)` (platform-admin OR `provider_admin`, else SQLSTATE 42501) and dropped the misleading helper. Body-diff against live prod confirmed the only change in each function was the assert line; the assert is a guard clause before any mutation (fail-closed). DROP confirmed exactly four callers, no others.

**Regression test.** `tests/db/suspend-rpc.test.ts` extended: `provider_kitchen` and `provider_viewer` → 42501 on all four RPCs; `provider_admin` and superadmin still succeed.

**Verification.** Staging (uigx): integration test 14/14, the eight negative cases flipping from success (vulnerable) to 42501 (fixed). Production: live `pg_get_functiondef` shows the strict gate on all four RPCs, the helper is gone (count 0), and live kitchen/viewer RPC calls return 42501. Verified live, not via CI status.

**Golden re-baseline (PR #93).** The RLS golden snapshot was re-baselined against production only after the fix was live and verified, so the golden reflects the corrected gate. Drift check now passes.

---

## Finding 2 — CI false-green: migration change-detection (HOTFIX-C, fixed)

**What.** `supabase-migrate.yml` decided "migrations changed" via an inline `git diff` between the PR base and head SHAs, but those SHAs were never fetched after `actions/checkout` (which provides the merge ref). The diff came back empty, so `changed=false`, the staging database push was skipped, and the job reported green.

**Impact.** Every migration PR was affected. PR #92's staging push was silently skipped while green; the staging ledger drifted from `main` repeatedly. A migration gate that does not apply but reports success is worse than no gate.

**How found.** PR #92's "Supabase Migrate" check was green, but live verification showed the migration was not applied to staging. Cross-checked against the GitHub Compare API and a local reproduction with the same SHAs (both showed the file in the diff), isolating the cause to the missing fetch in CI.

**Fix (PR #94).** Explicit `git fetch` of base and head; a dedicated `scripts/ci/detect-pr-migration-changes.mjs` (triple-dot with `base..head` fallback); a fail-closed cross-check (job fails if the detector and canonical detection disagree); a regression test; and a no-op smoke migration to prove a migration PR now triggers the push.

**Verification.** After the fix, detection reports `changed=true` and the staging apply runs (no longer skipped). The staging ledger was repaired to the canonical repo versions (`20260617120000`, `20260618120000`), removing the drift introduced during the manual fix.

---

## Finding 3 — Near-miss: accidental write to production (mitigated)

**What.** During a manual MCP operation intended for staging, `DATABASE_URL` pointed at production, and a no-op migration was written to prod. The SQL is harmless (`DO $$ BEGIN NULL; END $$`) — no schema or data effect — but the prod ledger received an entry from a staging-intended operation.

**Root cause.** No guard prevented a staging-intended write from reaching production; correctness relied on the `DATABASE_URL` value being right.

**Mitigation (PR #95).** A fail-closed environment-target guard (`scripts/ci/assert-db-target.mjs`) run as the first step on every write path:
- **Layer A (authoritative):** reads a sentinel row from `_meta.environment` in the connected database (`production` / `staging`) and requires it to equal the declared `--expect`. Because it reads the database's own content, it is robust against a wrong `DATABASE_URL`.
- **Layer B (cross-check):** parses the project ref from the connection and aborts on contradiction.
- **Fail-closed:** a missing sentinel or failed read aborts.

The guard is a shared helper wired into both CI jobs (`--expect staging` / `--expect production`) and all manual write paths; password-only pushes were removed. The guard's own bootstrap is ref-confirmed (Layer B only, since the sentinel does not yet exist) so it cannot mislabel a database. Production was bootstrapped under this ref-confirmed path and verified end-to-end; the prod ledger is consistent with the repo across all migrations.

**Standing behaviour.** With the migration gate fixed, the default path is guarded CI `db push`; raw manual MCP applies against a `DATABASE_URL` are deprecated and, when unavoidable, go through the same guard.

---

## Controls strengthened

- **Verify before re-baseline.** Golden snapshots are never blindly re-baselined; deltas are enumerated, mapped to intended migrations, and scope-checked first. This caught Finding 1.
- **Live-verify production writes.** Migration/security changes on prod are confirmed by live `pg_get_functiondef` and a live negative call — never by CI status alone, which has demonstrably lied.
- **Fail-closed environment guard** on every database write path (Finding 3).
- **Honest migration detection** with a fail-closed cross-check (Finding 2).

---

## Follow-ups (open)

- **Standing integration gate.** Wire `tests/db/suspend-rpc.test.ts` (and ideally a broader RPC-authz suite) as a required, regularly-running gate against a live database. The golden snapshot tracks `private.*` functions and policies but not `public.*` RPC bodies, so a future re-point of a `lp_company_*` RPC to a weaker gate would be caught by this test, not by drift.
- **`schema_migrations` reconciliation** (pre-existing, separate): the broader ledger drift on prod remains to be reconciled.

---

## Change log

| PR | Purpose | Key artifacts |
|----|---------|---------------|
| #92 | Strict provider-admin gate on company lifecycle | migration `20260618120000`; `suspend-rpc.test.ts` |
| #93 | RLS golden re-baseline against prod | golden snapshot |
| #94 | HOTFIX-C: migration change-detection | `detect-pr-migration-changes.mjs` + test; no-op `20260630120000` |
| #95 | Fail-closed env-target guard | `assert-db-target.mjs`; migration `20260701120000` (`_meta.environment`) |
