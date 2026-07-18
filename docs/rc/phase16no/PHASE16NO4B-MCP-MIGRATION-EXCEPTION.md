# PHASE 16NO.4B — Owner-authorized MCP production migration exception

**Status:** DOCUMENTED  
**Classification:** Controlled release exception (not a security incident)  
**MCP_MIGRATION_EXCEPTION_DOCUMENTED:** YES

## Reason

GitHub Environment `Production` has `prevent_self_review=true` with sole required reviewer `Lunchportalen`.  
The merge actor for PR #500 was the same identity, so workflow run `29629468104` (`Supabase Migrate + Verify + Evidence + Typegen`) deadlocked waiting for Production approval that the actor cannot grant to themselves. The run was later **cancelled** (completed 2026-07-18T03:54:40Z).

Owner authorized a controlled out-of-band apply via Supabase MCP on production project `hkpokyapzarefrgqzkos`, with ledger repair to canonical migration versions/checksums.

## Approved migration range

| Version | Name | SHA256 (file) |
|---------|------|----------------|
| `20260903120000` | `norway_legal_clickwrap_enforcement` | `481CEDFD0BFFFEE0F5C317B48B769B58A60B1F08BD8C13858897E99C3C5A0130` |
| `20260904120000` | `norway_mva_threshold_controller` | `98DB0249DF73619C6BE75CE580B9856008B04A00E0E04E883841478FF61920E3` |

## Operator

| Field | Value |
|-------|--------|
| Operator | Owner / Lunchportalen (phase 16NO.4A controlled release) |
| Channel | Supabase MCP `apply_migration` / `execute_sql` (production `hkpokyapzarefrgqzkos`) |
| Authorization | Owner verbal/chat authorization during 16NO.4A Gate after GH deadlock |

## Timestamps (UTC)

| Event | Timestamp |
|-------|-----------|
| Merge / migrate workflow start | 2026-07-18T03:48:23Z (run `29629468104`) |
| MCP apply + ledger repair window | ~2026-07-18T03:52Z – 2026-07-18T03:54Z |
| Controller activation (`controller_enabled=true`) | 2026-07-18T03:54:40.367026+00 |
| Migrate workflow cancelled | 2026-07-18T03:54:40Z |

## Resulting migration head

`20260904120000`

Canonical ledger contains both:

- `20260903120000` / `norway_legal_clickwrap_enforcement`
- `20260904120000` / `norway_mva_threshold_controller`

## Post-migration validation (at apply + reconfirmed 16NO.4B)

| Check | Result |
|-------|--------|
| Ledger head | `20260904120000` |
| Both versions present | YES |
| App health | PASS |
| Production SHA | `771a4207e9743fd232971eb95ecc27e45723a89d` |
| Controller enabled | YES |
| Official MVA registration (`mva_registered`) | NO |
| 25% MVA (`platform_invoice_vat_25_enabled`) | NO / BLOCKED |
| Other countries ordering | disabled 20/20 |
| Stripe / online payment | OFF (`invoice_only`, `allowOnlinePayment=false`) |
| Canary A–D (16NO.4A) | PASS (pure math; 0 real taxable holds) |

## Explicit non-goals of this exception

- No redeploy
- No additional migrations beyond the approved range
- No fiscal configuration changes in 16NO.4B
- No Stripe enablement
- No other-country activation
- No 25% MVA enablement before Brønnøysund registration
