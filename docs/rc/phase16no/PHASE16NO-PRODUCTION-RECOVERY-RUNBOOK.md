# PHASE 16NO — PRODUCTION RECOVERY RUNBOOK

**Status of this document:** Proven end-to-end in 16NO.3 — decision `RESTORE_REHEARSAL_PASS`  
(evidence: `docs/rc/phase16no/evidence/restore-rehearsal/20260717T194500Z/PHASE16NO3-FINAL-REPORT.md`).

Do not store secrets in this file.

## 0) Roles

| Step class | Who |
|------------|-----|
| Declare incident / kill Norway ordering | Lunchportalen owner |
| Freeze financial jobs / migrations | Superadmin + GitHub Production approver |
| Select backup / restore-to-new-project | Supabase Owner (Dashboard; cost confirm + optional 2FA) |
| Isolate recovery outbound | Operator (agent/ops) |
| Deploy exact SHA to recovery preview | Vercel Owner / CLI operator |
| Cutover DNS / production alias | Lunchportalen owner + Vercel Owner |
| Delete recovery project | Supabase Owner |

## 1) Identify incident

1. Confirm production health: `GET https://app.lunchportalen.no/api/health`
2. Record SHA (`data.version`), deployment ID, migration head, country gates, MVA block.
3. Snapshot aggregate financial totals (no PII) before any restore decision.

## 2) Disable Norway ordering (production)

Owner decision only. Prefer feature flags / `country_production_activation` ordering disable via controlled migration path — **not** ad-hoc SQL from chat. Keep deploy + migration locks ACTIVE unless owner opens a change window.

## 3) Freeze financial jobs

- Pause commission settlement cron consumers
- Pause invoice generation crons
- Do not send EHF / Stripe / real email

## 4) Select backup

```
GET /v1/projects/hkpokyapzarefrgqzkos/database/backups
```

Prefer latest COMPLETED physical backup. Record id + `inserted_at`.  
PITR: only if enabled (currently **NO**). Do not enable paid PITR without cost approval.

Honest RPO:

```
SNAPSHOT_RPO_SECONDS = now - backup.inserted_at
```

## 5) Restore to a new project (REQUIRED for PASS)

Dashboard only:

https://supabase.com/dashboard/project/hkpokyapzarefrgqzkos/database/backups/restore-to-new-project

- Select backup id
- Confirm mirrored monthly cost
- Complete 2FA if prompted
- Wait until new project ACTIVE_HEALTHY
- **Never** call in-place `POST …/database/backups/restore` on production

## 6) Isolate external effects (recovery project)

Immediately after restore:

- Disable/unschedule `pg_cron` jobs
- Disable `pg_net` / http wrappers
- Neutralize database webhooks
- Point SMTP/SMS/EHF/Slack to disabled adapters
- Ensure Stripe remains off
- No production domain / cron / webhooks

Evidence: `external-side-effect-report.json` with  
`REAL_EMAILS_SENT=0 REAL_SMS_SENT=0 REAL_EHF_SENT=0 REAL_WEBHOOKS_SENT=0 REAL_PAYMENTS_SENT=0 STRIPE_CALLS=0`

## 7) Validate restored data

Compare source vs restored aggregates/hashes:

- migration head, schema/table/function/trigger/index/policy counts
- orgs/providers/companies/users/orders/invoices/commission/legal/audit
- financial sums by currency
- Classify: MATCH / EXPECTED_POST_BACKUP_DELTA / UNEXPLAINED_MISMATCH  
Required: `UNEXPLAINED_MISMATCHES = 0`

Replay post-backup migrations on recovery only until head matches production.

## 8) Storage

Production currently: bucket `provider-logos` (1 object, ~27KB).  
Not required for Norway Golden Path ordering. If agreement PDFs/media buckets appear later, copy via approved Storage/S3 path and verify counts/bytes/sample hashes.

## 9) Deploy exact application SHA to recovery

- Isolated Vercel project only (never `app.lunchportalen.no`)
- Env: recovery Supabase URL/keys only; `RECOVERY_REHEARSAL=true`; outbound disabled; MVA invoice blocked; Stripe off; include `SYSTEM_MOTOR_SECRET` + `CRON_SECRET`
- `APP_VERSION` = production SHA
- Protect preview access

## 10) Auth + Golden Path

Synthetic tenant only (`RECOVERY_REHEARSAL_ONLY=true`).  
Canary economics: net 10 000 → food MVA 1 500 → gross 11 500 → commission 500 → platform MVA calc 125 → internal total 625; real invoice **BLOCKED**.

## 11) Cutover vs repair

Owner decision. If cutting over:

1. Freeze production writes
2. Point app to restored project only after checklist PASS
3. Re-enable jobs carefully
4. Reconcile post-backup delta manually

## 12) Rollback decision

If recovery fails integrity/Golden Path: keep production alias; delete recovery; do not cut DNS.

## 13) Cleanup

Delete recovery Vercel env + project; delete Supabase recovery project; revoke temp credentials; verify production health/locks/Norway/other-countries/MVA block unchanged.

## One-page emergency checklist

1. Health + SHA recorded  
2. Norway ordering disabled (owner)  
3. Financial jobs frozen  
4. Latest physical backup id recorded  
5. Restore-to-new-project (Dashboard + cost)  
6. Outbound disabled on recovery  
7. Manifest compare PASS  
8. Exact SHA preview PASS  
9. Golden Path PASS  
10. Owner cutover/repair decision  
11. Cleanup + evidence retained  

## 16NO.3 rehearsal record

| Field | Value |
|-------|-------|
| Decision | `RESTORE_REHEARSAL_PASS` |
| Backup | `1135896161` |
| Recovery ref (deleted) | `msecmoqfncvxrucnlpmm` |
| Exact SHA | `38b18c38742e1b50eb727f6bf807e1a1499f69fb` |
| Snapshot RPO | ~14.81 h |
| App RTO | ~2.29 h |
