# Supabase Health Audit — Verification Report

**Purpose:** Verify that the database satisfies the four audit areas (A–D) and provide idempotent SQL fixes only when the verification script reports findings. **No changes are executed automatically.**

---

## 1. VERIFICATION STATUS

| Phase | Check | Status | Note |
|-------|--------|--------|------|
| **A** | Public tables without primary key | **NOT RUN** | No real query output available. |
| **B** | Public tables without RLS | **NOT RUN** | No real query output available. |
| **C** | RLS enabled but zero policies | **NOT RUN** | No real query output available. |
| **D** | FK without supporting index | **NOT RUN** | No real query output available. |

**Reason:** The verification script `docs/db/SUPABASE_HEALTH_VERIFICATION_RUN.sql` was not executed against a live database. The local run attempt (`node scripts/db/run-health-audit.mjs`) failed with `connect ECONNREFUSED` (no Supabase/local Postgres reachable). Interpretation and SQL suggestions require **real result sets** from that script.

---

## 2. How to verify (get real results)

1. Open **Supabase Dashboard → SQL Editor** (or ensure `DATABASE_URL` is set and run `node scripts/db/run-health-audit.mjs`).
2. Open `docs/db/SUPABASE_HEALTH_VERIFICATION_RUN.sql` and run the **entire** script.
3. You will get **four result sets** (one per phase). For each:
   - **Empty result** → **OK**
   - **One or more rows** → **ISSUE FOUND**; note schema, table, constraint/columns.
4. Paste or save the four result sets, then re-run this verification report using those results only.

---

## 3. Audit verification (interpretation rules)

| Phase | Check | Status rule | Empty = |
|-------|--------|-------------|---------|
| **A** | Public tables without primary key | Any rows = **CRITICAL** | OK |
| **B** | Public tables without RLS | Any rows = **REVIEW REQUIRED** (not automatic CRITICAL) | OK |
| **C** | RLS enabled but zero policies | Any rows = **CRITICAL** | OK |
| **D** | FK without supporting index | Any rows = **IMPORTANT** | OK |

**Phase B:** For each table returned, classify as **SHOULD ENABLE RLS** or **MAY REMAIN WITHOUT RLS** (server-only / CMS / internal). Do not blindly enable RLS for all.

---

## 4. FINDINGS BY PHASE (when results exist)

*No real results available — findings will be filled when verification is run.*

### A. Tables without primary key
- *(none until verification returns rows)*

### B. Tables without RLS
- *(per-row: schema, table, and classification: SHOULD ENABLE RLS vs MAY REMAIN WITHOUT RLS)*

### C. Tables with RLS but no policies
- *(schema, table; why it matters: deny-all by default)*

### D. Foreign keys lacking index
- *(schema, table, fk_name, fk_column_names; why: deletes/updates on referenced table and lock contention)*

---

## 5. SQL SUGGESTIONS

**Only for actual findings.** No suggestions until verification returns rows.

- **Phase A:** Exact PK fix per table (idempotent).
- **Phase B:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` only for tables classified as SHOULD ENABLE RLS; then add policies (Phase C pattern).
- **Phase C:** Minimal safe policy pattern (e.g. superadmin-only or tenant-scoped) with `DO $$ ... IF NOT EXISTS (pg_policies) ...`.
- **Phase D:** `CREATE INDEX IF NOT EXISTS ... ON public.<table>(<fk_column_names>)` using returned column names.

---

## 6. FINAL HEALTH STATUS

**VERIFICATION PENDING**

- **CLEAN** — All four phases returned empty result sets. No action required.
- **MINOR PERFORMANCE IMPROVEMENTS SUGGESTED** — Only Phase D had findings. Add suggested FK indexes.
- **CRITICAL ISSUES FOUND** — One or more of A, B, or C had findings. Address before relying on app for tenant isolation.

*Current:* Cannot classify until the verification script is run and the four result sets are available.

---

## 7. Quality bar

- **Deterministic:** Results depend only on current catalog (pg_catalog, pg_constraint, pg_indexes, pg_policies, pg_class, pg_namespace).
- **Minimal:** Fixes are suggested only for issues that appear in the verification output.
- **Production-safe:** All suggested SQL uses `IF NOT EXISTS` / guards; no automatic execution.
- **No inference from migrations.** No application code changes.

**Next step:** Run `docs/db/SUPABASE_HEALTH_VERIFICATION_RUN.sql` in the Supabase SQL Editor, capture the four result sets, then update this report (or request a follow-up pass) with findings and idempotent SQL only for those rows.
