# Supabase Health Check — Real Audit Results

**Source:** Audit pack from `docs/db/SUPABASE_HEALTH_CHECK_AUDIT_PACK.md`.  
**Rule:** Findings below are based **only** on actual SQL query output. No inference from migration files.

---

## 1. AUDIT EXECUTION STATUS

| Check | Status | Note |
|-------|--------|-----|
| **A.** Public tables without primary keys | **NOT RUN** | Database connection failed (see below). |
| **B.** Public tables without RLS | **NOT RUN** | Database connection failed. |
| **C.** Public tables with RLS but zero policies | **NOT RUN** | Database connection failed. |
| **D.** Foreign keys lacking supporting indexes | **NOT RUN** | Database connection failed. |
| **G.** Policy overview for key backoffice tables | **NOT RUN** | Database connection failed. |

**Execution attempt:** The audit script `scripts/db/run-health-audit.mjs` was run locally. It attempted to connect to:

- `process.env.DATABASE_URL` if set, otherwise  
- `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (local Supabase).

**Result:** `Could not connect: connect ECONNREFUSED 127.0.0.1:54322` — no database was reachable at the time of execution. Therefore **no audit queries were executed** and there are **no real query results** to interpret.

---

## 2. REAL FINDINGS SUMMARY

Because no queries were run, there are no real findings.

| Section | Result count | Findings |
|---------|--------------|----------|
| **A.** Tables without primary keys | — | **No findings** (check not run). |
| **B.** Tables without RLS | — | **No findings** (check not run). |
| **C.** Tables with RLS but no policies | — | **No findings** (check not run). |
| **D.** FKs lacking supporting indexes | — | **No findings** (check not run). |
| **G.** Policy overview for key tables | — | **No findings** (check not run). |

**Why each check matters (for when you run them):**

- **A:** Tables without a primary key can complicate replication, backups, and safe updates.
- **B:** Tables without RLS may be exposed to cross-tenant or over-privileged access if app logic is wrong.
- **C:** RLS with no policies usually means no rows are visible/writable (deny-all); often a misconfiguration.
- **D:** FKs without an index on the source columns can cause slow deletes/updates and lock contention.
- **G:** Policy overview confirms RLS policy names, roles, and commands for key backoffice tables.

---

## 3. PRIORITY ORDER

No real issues were identified by the audit (no queries ran). Priority order is therefore **not applicable** until you have real results.

- **Critical:** —
- **Important:** —
- **Nice to have:** —

---

## 4. EXCLUDED (not proven by audit)

The following were **not** verified by this audit and must **not** be treated as current findings:

- Any table names previously inferred as missing primary keys (e.g. `invoice_exports`, `daily_company_rollup`, `daily_employee_orders`).
- Any table names previously inferred as missing RLS.
- Any foreign key previously inferred as lacking an index (e.g. `content_experiments.variant_id`).
- Any policy or trigger gaps inferred from migration files.

**To get real findings:** Run the audit when the database is reachable (see below), then re-run this interpretation against the new output.

---

## How to run the audit and get real results

**Option 1 — Supabase SQL Editor (recommended)**  
1. Open your Supabase project → SQL Editor.  
2. Copy each query from `docs/db/SUPABASE_HEALTH_CHECK_AUDIT_PACK.md` (sections A, B, C, D, G).  
3. Run them one by one and note the result rows.  
4. Re-run `scripts/db/run-health-audit.mjs` after saving the output, or paste the result sets into this document and update sections 1–4 from those results only.

**Option 2 — Local script (when DB is reachable)**  
1. Start local Supabase: `supabase start` (or set `DATABASE_URL` to your Supabase Postgres URL).  
2. Run: `node scripts/db/run-health-audit.mjs`  
3. The script prints JSON with `results.A.rows`, `results.B.rows`, etc.  
4. Update this document with the real row counts and findings from that JSON.

After you have real query output, you can request a follow-up pass that fills in sections 1–4 from **actual audit results only**.
