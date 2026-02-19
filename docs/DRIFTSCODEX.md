# DRIFTSCODEX

## Scope
This document records the enterprise hardening changes delivered for cron authentication, outbox retry policy, SQL constraints, and order RPC atomicity.

## Delivered Controls
- Cron endpoints now authenticate only with:
  - `Authorization: Bearer <CRON_SECRET>`
  - `x-cron-secret: <CRON_SECRET>`
- Query secret transport (`?key=`) is forbidden.
- Shared helper: `lib/http/cronAuth.ts`.
- Outbox worker now supports `FAILED_PERMANENT` and max 10 attempts.
- Database constraints enforced via migration.
- `lp_order_set` and `lp_order_cancel` write outbox events in the same transaction.
- Smoke and production checklist scripts added.

## Evidence Paths
- `scripts/smoke/*.sh`
- `scripts/prod-check.sh`
- `scripts/sql/verify_enterprise_hardening.sql`
- `supabase/migrations/20260217_enterprise_cron_outbox_rpc.sql`

## Verification Summary
1. `npm run typecheck`
2. `npm run lint`
3. `npm run build:enterprise`
4. `npm run test:run -- tests/outbox-policy.test.ts`
5. `bash scripts/smoke/cron-smoke.sh`
6. `bash scripts/prod-check.sh`

## Sign-off
Signed by: Codex (GPT-5 coding agent)
Date: 2026-02-17
Status: Delivered for verification
