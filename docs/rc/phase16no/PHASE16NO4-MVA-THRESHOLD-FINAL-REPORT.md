# PHASE 16NO.4 — AUTOMATIC NORWAY MVA THRESHOLD CONTROL

**Branch:** `release/norway-mva-threshold-16no4`  
**Report time (UTC):** 2026-07-17T23:00:00Z  
**Decision:** `OWNER_ACTION_REQUIRED` (code + gates complete; controlled production deploy/migration pending Vercel auth + Production environment approval)

---

## Release

| Field | Value |
|-------|--------|
| Previous production SHA | `38b18c38742e1b50eb727f6bf807e1a1499f69fb` |
| MVA release SHA | `fe79096920b20c9e5ea22b72b1476c6cf08a7781` (tip; feature `9827efc8`) |
| Deployment ID | unchanged (production not redeployed) |
| Migration head before | `20260902120000` |
| Migration head after | *(not applied)* — target `20260904120000` after `20260903120000` |
| Applied migrations | none in production for 16NO.4 |
| Production locks | ACTIVE (deploy lock + migration lock) — not opened |

### Why not LIVE yet

1. Phase 16NO.3A revoked the exposed Vercel token and did **not** create a replacement.
2. Controlled production migration requires Production environment approval.
3. Spec requires dark-deploy → migrate → activate controller → synthetic canary → restore locks.

Code, tests, CI gates, migration, and canary math are ready on the release branch.

---

## Current fiscal state (production, re-read)

| Field | Value |
|-------|--------|
| Official MVA registration | NO (`mva_registered=false`) |
| Recognized taxable turnover | NOK 0.00 (0 ledger rows) |
| Invoiced commission turnover | NOK 0.00 |
| Recognized but uninvoiced | NOK 0.00 |
| Threshold | NOK 50,000.00 (`5_000_000` minor) |
| Amount remaining | NOK 50,000.00 |
| Threshold percentage | 0% |
| Current warning band | NONE |
| Predicted crossing date | n/a (no pending events) |

---

## Recognition and calculation

| Field | Value |
|-------|--------|
| Recognition event | `commission_ledger.created_at` on delivery-posted commission |
| Rolling window | calendar `ROLLING_12_MONTHS` |
| Atomic supply | one ledger commission event; never split |
| Threshold comparison | `STRICTLY_GREATER_THAN` |
| Financial integer handling | BigInt / integer minor units |
| Calculation checksum | FNV-1a fingerprint in `checksumThresholdCalculation` |
| Unexplained mismatches | 0 (empty books) |

---

## Invoicing

| Field | Value |
|-------|--------|
| Pre-registration invoicing | ENABLED in code (issue/deliver without MVA when controller allows) |
| Invoice tax treatment | `NO_PLATFORM_SERVICE_NOT_REGISTERED_NO_VAT` |
| Crossing policy | `HOLD_UNTIL_REGISTERED` (default) |
| Crossing invoice status | n/a (no crossing) |
| Later invoices | held after crossing (batch assign) |
| MVA suffix | blocked before registration |
| EHF MVA transmission | blocked before registration |
| Credit/reissue | capability reserved (`INVOICE_WITH_MVA_RESERVATION_AND_REISSUE`) — not auto-selected |
| Duplicate invoices | 0 |

---

## Registration

| Field | Value |
|-------|--------|
| Official verification | Brønnøysund Enhetsregisteret client |
| Last status check | evidence file + DB table after migrate/activate |
| Polling | daily cron `/api/cron/norway-mva-threshold` |
| Registration evidence packet | `buildNorwayMvaRegistrationEvidencePacket` |
| Owner action | none until crossing |
| VAT activation | only after Brreg `registrertIMvaregisteret=true` |

---

## Notifications

Durable `norway_mva_threshold_warnings` + outbox dedupe by legal entity / band / window / turnover.

Bands: EARLY_35, WARNING_80/90/98, AT_THRESHOLD, CROSSED.

---

## Security and recovery

| Field | Value |
|-------|--------|
| Restore rehearsal | PASS (16NO.3) |
| Security cleanup | PASS (16NO.3A) |
| Vercel token revoked | YES — do not rotate again |
| Unauthorized Vercel activity | 0 |
| Temporary files | cleared from worktree start |
| Secrets exposed | 0 (no token reprint) |
| Production mutation during recovery | 0 |
| Recovery evidence | sealed under `docs/rc/phase16no/evidence/` |

---

## Platform safety

| Field | Value |
|-------|--------|
| Norway ordering | ENABLED |
| Commission accrual | ENABLED |
| Provider customer invoicing | unchanged (provider) |
| Other countries disabled | 20/20 (`other_enabled=0`) |
| Stripe | OFF / invoice_only |
| RLS | threshold tables superadmin/service_role |
| Cross-tenant | 0 expected |
| Wrong provider | 0 expected |
| Production health | PASS |

---

## Implemented artifacts

- `lib/markets/norwayMvaTurnover.ts` — pure engine
- `lib/markets/norwayMvaController.ts` — runtime orchestration
- `lib/markets/norwayMvaEvidencePacket.ts` — registration packet
- `lib/integrations/brreg/enhetsregisteret.ts` — official check
- `supabase/migrations/20260904120000_norway_mva_threshold_controller.sql`
- `app/api/cron/norway-mva-threshold/route.ts`
- `app/superadmin/mva-terskel/page.tsx`
- Provider terms `1.1.0-owner-2026-07-18` (material MVA threshold wording)
- Tests + `ci:phase16no4-gates` + synthetic canary script

---

## Owner actions to reach `MVA_THRESHOLD_AUTOMATION_LIVE`

1. Provide approved Vercel deploy credential (or GH Actions deploy path) — **do not reuse revoked token**
2. Approve Production migration for `20260903120000` then `20260904120000`
3. Dark-deploy release SHA with `controller_enabled=false`
4. Activate controller: `UPDATE norway_mva_threshold_config SET controller_enabled=true WHERE id=1`
5. Run synthetic canary A–D (no real invoice transmission)
6. Verify health PASS, other countries 20/20, MVA still blocked
7. Restore deploy + migration locks

---

## Decision

**OWNER_ACTION_REQUIRED**
