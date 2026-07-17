# PHASE 16NO.1 — RESTORE REHEARSAL (LIMITED)

**Status:** `RESTORE_REHEARSAL_LIMITED`  
**Captured:** 2026-07-17T17:50:00Z  
**Production project:** `hkpokyapzarefrgqzkos`

## Provider limitation (exact)

1. Supabase Management API backup metadata for production returns physical backups (`COMPLETED`) but `pitr` / point-in-time restore fields are **null / not enabled** in the API response used by `prod-backup-read-only` (run `29598013983`, latest physical backup id `1135896161`).
2. Supabase MCP `create_branch` creates a **schema-only** branch (`with_data: false`). Production row data does **not** carry over. Auto-applying the full migration history on a fresh branch previously failed mid-chain (`phase16no-mig-rehearsal`, since deleted).
3. Therefore a complete data-bearing PITR restore rehearsal **cannot** be claimed as PASS from API/automation alone on the current plan/API surface.

## What was verified instead (non-mutating)

| Check | Result |
|-------|--------|
| Production physical backup metadata | PASS (8 COMPLETED; latest `1135896161`) |
| Staging Norway gate / migration rehearsal | PASS (owner waiver + MVA invoice block) |
| Production migration apply (cutover) | PASS → head `20260902120000` |
| Production not mutated by this restore doc | YES (read-only / no restore execute) |

## Concrete recovery runbook (operator — Dashboard)

Use this when a real restore is required. **Do not restore in place on production.**

1. Supabase Dashboard → project `hkpokyapzarefrgqzkos` → **Database** → **Backups**.
2. Confirm latest physical backup id (target: `1135896161` or newer COMPLETED).
3. If PITR is available on the plan: create a **new isolated project** or restore-to-new from the chosen restore point.  
   If only downloadable/logical backup: restore into a new empty project.
4. Never point Vercel production (`app.lunchportalen.no`) at the restore project.
5. On the isolate only, verify:
   - `schema_migrations` head matches expected production head (currently `20260902120000`)
   - tenant counts: companies / providers / profiles sample
   - order / invoice / commission_period totals vs production snapshot taken just before incident
   - RLS enabled on tenant tables (`orders`, `profiles`, `provider_commission_invoices`, `country_production_activation`)
   - auth boot via isolate anon/service keys against a throwaway Vercel preview if needed
   - protected orgs intact (Melhus Catering AS, Pettersen&Co — IDs from Golden Path docs, never hardcode in app)
   - `lp_country_production_allowed('SE'|'DK'|…,'order') = false`
   - Norway flags match intended operating mode
6. Capture evidence under `docs/rc/phase16no/restore-evidence-<run>/`.
7. Dispose or pause the isolate.

## Upgrade path to full PASS

- Enable / confirm Supabase PITR on production plan, **or**
- Perform one documented Dashboard restore-to-new and store checksummed evidence.

Until then: **do not report PITR PASS**.
