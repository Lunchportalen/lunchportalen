# PHASE 16NO — NORWAY RELEASE CANDIDATE

**Branch:** `release/norway-first-live`  
**Recorded:** 2026-07-17

## Baseline (verified before mutation)

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| Production app SHA | `98b3b15e258966dd61ad967af5876982bcfcb959` | `/api/health` version match | PASS |
| Production Supabase | `hkpokyapzarefrgqzkos` | MCP query | PASS |
| Production migration head | `20260818120000` | `anon_grant_lockdown` | PASS |
| Staging Supabase | `uigxsboqeruxflgzqztl` | MCP query | PASS |
| Staging migration head | `20260901120000` | confirmed (includes review-ops) | PASS |
| Certified technical RC | `b88aaf99780e0a5d71404e831fd87eb90031fb6e` | SOURCE | PASS |

## Release composition

| Field | Value |
|-------|-------|
| SOURCE_RC_SHA | `b88aaf99780e0a5d71404e831fd87eb90031fb6e` |
| NORWAY_RELEASE_SHA | *(set after commit on this branch)* |
| Migration range | `20260819120000` → `20260831120000` + `20260902120000_norway_first_country_activation` |
| Excluded migration | `20260901120000_global_15g3b_review_operations` (review-ops, not runtime) |

## Excluded commits (with reason)

| Commit range | Reason |
|--------------|--------|
| `0bd565d5..b528cf63` (Phase 15G.3B review ops) | Reviewer operations / evidence APIs — out of production runtime |
| `5d5f3272..63407bc5` (15G.3E durable outreach pipeline on main) | Outreach/IMAP ops — not portal runtime; keep on main separately |
| `20260901120000` migration | Review operations schema — not Norway cutover |

## Included

1. Certified operational portal functionality from SOURCE_RC_SHA
2. Production migrations through `20260831120000`
3. Norway-first activation controls (`20260902120000`)
4. Immutable commercial model `agency_commission_invoice_only_v1` (ADR-020)
5. No Umbraco / Azure SQL / marketing-site changes
6. No secrets, local browser state, or outreach evidence packs

## Activation policy

- Dark deploy allowed after gates
- Production migration allowed after backup + rehearsal PASS
- Norway fiscal flags remain **off** until `ACCOUNTANT_NORWAY_TAX_CONFIRMATION=CONFIRMED`
- Other 20 countries hard-blocked in DB trigger + runtime guards
- Stripe OFF · invoice_only

## Decision posture (pre-accountant)

`NORWAY_READY_ACCOUNTANT_CONFIRMATION_REQUIRED`
