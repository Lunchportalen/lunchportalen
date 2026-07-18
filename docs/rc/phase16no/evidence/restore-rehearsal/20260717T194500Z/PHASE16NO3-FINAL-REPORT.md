# PHASE 16NO.3 — REAL PRODUCTION RESTORE REHEARSAL

## Decision

**RESTORE_REHEARSAL_PASS**

## Source

- Production SHA: `38b18c38742e1b50eb727f6bf807e1a1499f69fb`
- Production deployment (untouched): `dpl_8B1yGxcLccWLx642kaUSJ3K7q1m1` / `https://app.lunchportalen.no`
- Production migration head: `20260902120000` (89 migrations)
- Backup type: `DAILY_PHYSICAL_BACKUP`
- Backup reference: `1135896161`
- Backup timestamp: `2026-07-17T05:07:31.069Z`
- PITR enabled: **NO**
- Snapshot RPO: **53301 s (~14.81 h)** at restore start

## Recovery project

| Field | Value |
|-------|-------|
| Recovery project ref | `msecmoqfncvxrucnlpmm` (Lunchportalen v2) |
| Region | `eu-west-1` |
| Restore started | `2026-07-17T19:55:52.286Z` |
| Restore completed | `2026-07-17T19:55:52.286Z` (ACTIVE_HEALTHY on first operator poll) |
| COST_APPROVED | Owner confirmed via Dashboard (amount not stored in evidence) |
| External actions disabled | YES (cron inactive; outbox PENDING/FAILED → FAILED_PERMANENT; no pg_net) |
| Production mutation | **0** |

## Integrity

| Check | Result |
|-------|--------|
| Schema / migration head after replay | MATCH (`20260902120000`, 89) |
| Companies / providers / profiles / auth_users / orders (pre-synthetic) | MATCH (5 / 9 / 50 / 50 / 17) |
| company_id_hash / provider_id_hash | MATCH |
| public tables / RLS / policies / functions | MATCH (199 / 198 / 322 / 463) |
| audit_events | EXPECTED_POST_BACKUP_DELTA (452 vs 453) |
| Norway gates (after mirror) | MATCH intent (order+commission on; platform MVA invoice blocked; 20/20 others off) |
| Auth users | MATCH then +1 synthetic for Golden Path |
| Storage | MATCH (1 bucket / 1 object; non-critical for Golden Path) |
| UNEXPLAINED_MISMATCHES | **0** |

Post-backup migrations replayed on recovery only (19 + legal clickwrap at prod ledger version `20260717181720`).

## Security / outbound

- REAL_EMAILS_SENT = 0
- REAL_SMS_SENT = 0
- REAL_EHF_SENT = 0
- REAL_WEBHOOKS_SENT = 0
- REAL_PAYMENTS_SENT = 0
- STRIPE_CALLS = 0
- Secrets in evidence / repo = 0
- Cross-tenant leak (synthetic RLS check) = 0 Pettersen rows

## Application

- Exact SHA deployed to isolated Vercel project `lunchportalen-16no` only
- Recovery health: **PASS** (`ok=true`, version=`38b18c38742e1b50eb727f6bf807e1a1499f69fb`)
- `app.lunchportalen.no` never pointed at recovery

## Financial canary + Golden Path

- Synthetic Norway Golden Path via `lp_order_set` (JWT sub simulation): PASS
- Canary NOK minor units: net 10000 → food MVA 1500 → gross 11500 → commission 500 → platform MVA calc 125 → internal 625: PASS
- Platform MVA invoice gate blocked: PASS
- Idempotency / zero duplicate commission+invoice rows: PASS
- Kill-switch forward-fix (ordering off→on): PASS

Evidence: `01-integrity-compare.json`, `02-golden-path-financial.json`, `03-external-side-effects.json`, `06-app-deploy.json`

## Recovery performance

| Metric | Value |
|--------|-------|
| Snapshot RPO | ~14.81 h (daily physical; no PITR) |
| Application / full-service RTO | ~8240 s (~2.29 h) from restore start to recovery health PASS |
| Manual actions required | Owner Dashboard restore-to-new + cost confirm |

See `04-rto-rpo.json`.

## Cleanup

| Item | Status |
|------|--------|
| Recovery Vercel env removed | YES (17) |
| Recovery Vercel deployments removed | YES (6) |
| Recovery Vercel project deleted | YES (HTTP 204) |
| Recovery Supabase project deleted | YES (HTTP 200, run `29617454933`) |
| Temporary GH secrets revoked | YES (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_16NO`) |
| Production health | PASS |
| Production locks / Norway / 20 disabled / MVA block | Unchanged |

See `05-cleanup.json`.

## Notes / follow-ups (non-blocking for PASS)

1. PITR remains disabled — honest RPO is daily physical snapshot age.
2. **16NO.3A complete:** exposed Vercel CLI token revoked; local auth wiped; repo/Actions matches = 0 → `SECURITY_CLEANUP_PASS` (see `PHASE16NO3A-SECURITY-CLEANUP.md`).
3. One-shot CI workflows added on `main` for this rehearsal may be removed in a later hygiene PR.
4. Exact Supabase recovery-project invoice line: confirm in Dashboard billing (API class USD 10/month).
