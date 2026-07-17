# PHASE 16NO — RESTORE REHEARSAL RUNBOOK

**Status:** `PREPARED_NOT_EXECUTED`  
**Updated:** 2026-07-17T15:25:00Z  
**Decision impact:** Required PASS before production migrate; does **not** unlock fiscal flags.

## Why this exists

Production migrate of `20260819120000` → `20260902120000` requires proven recoverability.
Backup metadata alone is not enough; an isolated restore rehearsal must PASS.

## Evidence already captured (read-only)

| Item | Value |
|------|--------|
| Backup workflow | `prod-backup-read-only` |
| Run | https://github.com/Lunchportalen/lunchportalen/actions/runs/29591062152 |
| Project | `hkpokyapzarefrgqzkos` |
| Latest physical backup | `1135896161` @ 2026-07-17T05:07:31Z |
| Local evidence | `docs/rc/phase16no/backup-evidence-29591062152/` |

## Branching truth (read-only inventory)

Listed from production parent `hkpokyapzarefrgqzkos`:

| Branch | Ref | with_data | Status | Notes |
|--------|-----|-----------|--------|-------|
| main | `hkpokyapzarefrgqzkos` | false | ACTIVE_HEALTHY | Production |
| staging | `uigxsboqeruxflgzqztl` | false | MIGRATIONS_FAILED (branch metadata) | Staging project healthy; used for gate rehearsal |
| staging-abc-signoff | `iyrytpjacujscveivtfb` | false | INACTIVE | Do not use |

**Important:** Supabase `create_branch` does **not** copy production data. Schema-only branches are useful for migration dry-run, but they are **not** a PITR data restore proof.

## Rehearsal options (operator)

### Option A — PITR / clone with data (preferred for restore PASS)

1. In Supabase Dashboard (or Management API), restore/clone production to an **isolated** project using a recent physical backup (e.g. `1135896161`).
2. Confirm clone is not pointed at by Vercel production.
3. Record clone project ref + restore timestamp under `docs/rc/phase16no/restore-evidence-<run>/`.
4. On the clone only: apply migration range `20260819120000` → `20260902120000` (exclude `20260901120000`).
5. Verify:
   - migration head = `20260902120000`
   - `lp_country_production_allowed('NO','order')` = false until accountant row
   - non-NO enable blocked
   - Melhus / Pettersen protected-org invariants
6. Delete or pause clone after evidence captured.

### Option B — Schema-only branch dry-run (supplementary, not restore PASS)

1. Create ephemeral branch from production parent (ops window).
2. Apply only the Norway release migration range.
3. Capture PASS/FAIL logs.
4. Delete branch.
5. Mark as `SCHEMA_DRY_RUN_PASS` — still requires Option A for full restore PASS.

## Hard stops

- Do **not** run restore against production in place.
- Do **not** merge rehearsal branches into production.
- Do **not** set `ACCOUNTANT_NORWAY_TAX_CONFIRMATION=CONFIRMED` from this runbook.
- Do **not** enable Norway ordering/commission flags.
- Do **not** treat staging MCP apply of gates as production migrate proof.

## Staging note (already done)

Staging (`uigxsboqeruxflgzqztl`) has Norway-first fail-closed gates rehearsed.
MCP apply used a timestamped migration version (`20260717151311`) for the gate SQL —
production must apply the canonical file version `20260902120000` only.

## Acceptance criteria for `RESTORE_REHEARSAL_PASS`

- [ ] Isolated environment created from production backup/PITR
- [ ] Evidence directory + checksums stored
- [ ] Reviewed migration range applied successfully on isolate
- [ ] Fail-closed Norway fiscal gates verified on isolate
- [ ] Protected Golden Path orgs intact on isolate
- [ ] Isolate disposed or locked read-only
- [ ] Production project untouched (head remains `20260818120000` until authorised migrate)

Until then: `RESTORE_REHEARSAL = PREPARED_NOT_EXECUTED`
