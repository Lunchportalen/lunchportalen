# PHASE 16NO.1 / 16NO.2 — RESTORE REHEARSAL (LIMITED)

**Status:** `RESTORE_REHEARSAL_LIMITED` (unchanged — do **not** report full PITR PASS)  
**Captured:** 2026-07-17T17:50:00Z · **16NO.2 refresh:** 2026-07-17  
**Production project:** `hkpokyapzarefrgqzkos`  
**Exact Supabase backup reference (last verified):** physical backup id `1135896161` (COMPLETED; verify newer COMPLETED id in Dashboard before any restore)

## Provider limitation (exact)

1. Supabase Management API backup metadata for production returns physical backups (`COMPLETED`) but `pitr` / point-in-time restore fields are **null / not enabled** in the API response used by `prod-backup-read-only` (run `29598013983`, latest physical backup id `1135896161`).
2. Supabase MCP `create_branch` creates a **schema-only** branch (`with_data: false`). Production row data does **not** carry over. Auto-applying the full migration history on a fresh branch previously failed mid-chain (`phase16no-mig-rehearsal`, since deleted).
3. Therefore a complete data-bearing PITR restore rehearsal **cannot** be claimed as PASS from API/automation alone on the current plan/API surface.

## What was verified instead (non-mutating)

| Check | Result |
|-------|--------|
| Production physical backup metadata | PASS (8 COMPLETED; latest `1135896161`) |
| Staging Norway gate / migration rehearsal | PASS (owner waiver + MVA invoice block) |
| Production migration apply (cutover) | PASS → head `20260902120000` (16NO.2 legal migration `20260903120000` applied separately when approved) |
| Production not mutated by this restore doc | YES (read-only / no restore execute) |

## Concrete recovery runbook (owner / operator — Dashboard)

Use this when a real restore is required. **Do not restore in place on production.**

### Owner / operator actions

1. Declare incident; freeze production deploys and migrations (locks already ACTIVE).
2. Snapshot current production identity: Vercel deployment SHA / `APP_VERSION`, DB migration head, Norway activation flags, commission period totals.
3. Supabase Dashboard → project `hkpokyapzarefrgqzkos` → **Database** → **Backups**.
4. Confirm target physical backup id (`1135896161` or newer COMPLETED). Record the id in evidence.
5. If PITR is available on the plan: create a **new isolated project** or restore-to-new from the chosen restore point.  
   If only downloadable/logical backup: restore into a new empty project.
6. Never point Vercel production (`app.lunchportalen.no`) at the restore project until owner GO after verification.
7. Expected restore time (operator planning): physical restore-to-new typically **30–90 minutes** depending on backup size and Dashboard queue; full verification checklist below adds **30–60 minutes**. Do not promise a hard SLA from this LIMITED rehearsal.

### Schema / data verification (isolate only)

- [ ] `schema_migrations` head matches expected production head
- [ ] Tenant count verification: `companies`, `providers`, `profiles` (sample + totals vs pre-incident snapshot)
- [ ] Financial total verification: orders / invoice basis / `provider_commission_invoices` / commission period totals
- [ ] RLS verification: RLS enabled on `orders`, `profiles`, `provider_commission_invoices`, `country_production_activation`, `legal_acceptances`
- [ ] Auth boot via isolate anon/service keys against a throwaway Vercel preview if needed
- [ ] Protected orgs intact (Melhus Catering AS, Pettersen&Co — IDs from Golden Path docs, never hardcode in app)
- [ ] `lp_country_production_allowed('SE'|'DK'|…,'order') = false` (other 20 countries disabled)
- [ ] Norway flags match intended operating mode (ordering/commission on; platform MVA invoice blocked until MVA registered)
- [ ] `legal_acceptances` immutability triggers present after 16NO.2 migration

### Rollback decision points

1. **STOP / stay on current prod** if isolate verification fails any tenant, financial, RLS, or country-activation check.
2. **Do not cut DNS/env to isolate** until owner signs the verification checklist.
3. If cutover to restored isolate was started and a defect appears: roll Vercel `APP_VERSION` / deployment back to last known-good SHA; keep DB freeze; do not re-run speculative migrations.
4. Capture evidence under `docs/rc/phase16no/restore-evidence-<run>/`.
5. Dispose or pause the isolate.

## Upgrade path to full PASS

- Enable / confirm Supabase PITR on production plan, **or**
- Perform one documented Dashboard restore-to-new and store checksummed evidence.

Until then: **do not report PITR PASS**. Status remains `RESTORE_REHEARSAL_LIMITED`.
