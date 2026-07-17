# PHASE 16NO — NORWAY FIRST LIVE REPORT

**Generated:** 2026-07-17T15:25:00Z  
**Decision:** `NORWAY_READY_ACCOUNTANT_CONFIRMATION_REQUIRED`

## Release

- Previous production SHA: `98b3b15e258966dd61ad967af5876982bcfcb959` (verified via `/api/health`)
- Norway release SHA: `a40acaf387d397868239af827b8906884d29e23a` (`release/norway-first-live`)
- SOURCE_RC_SHA: `b88aaf99780e0a5d71404e831fd87eb90031fb6e`
- Deployment ID: NOT APPLIED (fiscal activation blocked)
- Production URL: https://app.lunchportalen.no
- Deployment time: N/A
- Migration head before: `20260818120000`
- Migration head after: unchanged (production not migrated)
- Applied migrations: none (production)
- Target migration range: `20260819120000` → `20260902120000` (excludes review-ops `20260901120000`)
- Production locks after release: ACTIVE (unchanged)

## Country activation

- Norway production: DISABLED (awaiting accountant)
- Norway registration: DISABLED
- Norway ordering: DISABLED
- Norway invoice_only: DISABLED
- Norway commission: DISABLED
- Other countries disabled: 20/20 (runtime + DB trigger)
- Non-Norway bypass attempts: blocked by design (`COUNTRY_PRODUCTION_DISABLED`)

## Business model

- Commercial model ID: `agency_commission_invoice_only_v1`
- Provider is seller: YES (21/21)
- Provider invoices customer: YES (21/21)
- Platform invoices provider: YES (21/21)
- Platform collects customer funds: NO (0/21)
- Commission rate: 500 bps (5%)
- Commission basis: net excluding customer tax
- Stripe: OFF
- Country model consistency: LOCKED (US marketplace_facilitator override removed)
- 21-country invariant test: PASS (`npm run test:phase16no`)

## Norway tax model

- Food MVA configuration: 15% (provider responsibility)
- Provider-arranged delivery: 15% with food
- External transport treatment: 25% to provider (packet item 3)
- Platform commission VAT: 25%
- Tax code: `NO_PLATFORM_SERVICE_STANDARD_VAT_25`
- Owner confirmation: **CONFIRMED** (`docs/evidence/owner/OWNER_NORWAY_TAX_MODEL_CONFIRMATION.md`)
- Accountant confirmation: **REQUIRED**
- Evidence packet: `docs/rc/PHASE16NO-ACCOUNTANT-CONFIRMATION-PACKET.md`
- Intake scaffold: `docs/evidence/accountant/`

## Golden Path

- Not executed on production (blocked by accountant gate)
- Rehearsal / canary: prepared in runbooks; not started against live customers

## Financial example (locked math)

- Customer net: NOK 10 000,00
- Food MVA: NOK 1 500,00
- Customer gross: NOK 11 500,00
- Commission net: NOK 500,00
- Commission MVA: NOK 125,00
- Platform invoice total: NOK 625,00
- Balance difference: 0 (unit-tested)

## Safety

- Backup metadata: PASS ([run 29591062152](https://github.com/Lunchportalen/lunchportalen/actions/runs/29591062152); latest backup `1135896161`)
- Restore rehearsal: PREPARED_NOT_EXECUTED (`docs/rc/PHASE16NO-RESTORE-REHEARSAL.md`)
- Staging gate rehearsal: PASS (fail-closed)
- RLS: remains required; new activation table RLS-enabled
- Data loss: none
- Duplicate orders/invoices/commission: none (no prod fiscal writes)
- Secrets exposed: 0
- Stripe calls: 0
- Umbraco changed: NO
- Azure changed: NO
- lunchportalen.no changed: NO

## Monitoring

- Durable 15G.3E outreach pipeline: ACTIVE (separate from Norway cutover)
- Norway production monitoring: not started (not live)

## Completed this phase (reversible)

1. Verified production baseline SHA + migration head (no unexpected drift)
2. Built `release/norway-first-live` from SOURCE_RC_SHA
3. Excluded review-ops + outreach commits from runtime candidate
4. Locked global commercial model + ADR-020
5. Norway-first activation module + DB migration `20260902120000`
6. CI gates + invariant tests PASS
7. Owner tax model confirmation recorded with checksum
8. Accountant confirmation packet + intake scaffold prepared
9. Migration inventory classified
10. Dark-deploy + legal/privacy checklists written
11. Production backup metadata captured
12. Staging Norway-first gates rehearsed fail-closed
13. Restore rehearsal runbook prepared (execution pending ops window)

## Owner interruption (required)

**Provide written accountant confirmation** of the six Norway model points in  
`docs/rc/PHASE16NO-ACCOUNTANT-CONFIRMATION-PACKET.md`, then store under  
`docs/evidence/accountant/` and run the record script.

Until then: no production migration activation of fiscal flags, no Norway ordering, no commission invoicing.

## Decision

**NORWAY_READY_ACCOUNTANT_CONFIRMATION_REQUIRED**
