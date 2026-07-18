# PHASE 16NO — NORWAY FIRST LIVE REPORT

**Generated:** 2026-07-17T17:35:00Z  
**Final decision:** `NORWAY_TECHNICALLY_LIVE_PLATFORM_INVOICING_AWAITS_MVA_REGISTRATION`

## Owner tax decision

| Key | Value |
|-----|--------|
| OWNER_NORWAY_TAX_MODEL_CONFIRMATION | CONFIRMED |
| OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY | YES |
| ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER | YES |
| ACCOUNTANT_NORWAY_TAX_CONFIRMATION | NOT_REQUIRED_FOR_CUTOVER |
| Accountant confirmation required for cutover | **NO** |
| NORWAY_TAX_MODEL_STATUS | `OWNER_APPROVED_WITH_OFFICIAL_SOURCE_SUPPORT` |

Do **not** represent as accountant approved, externally reviewed, or independently certified.

## MVA registration

| Key | Value |
|-----|--------|
| Legal name | LUNCHPORTALEN AS |
| Org.nr | 937155239 |
| LUNCHPORTALEN_MVA_REGISTERED | **NO** |
| PLATFORM_INVOICE_VAT_25_ENABLED | **FALSE** |
| Source | Brønnøysundregistrene Enhetsregisteret API |
| Evidence SHA-256 | `19032673fbeec4b6102ab97cb2207b74ddf018ba106828faaf13df3c788a9ed2` |
| Owner action | `docs/rc/phase16no/evidence/mva/OWNER_MVA_REGISTRATION_ACTION.md` |

## Release control

| Key | Value |
|-----|--------|
| VERIFIED_NORWAY_RELEASE_SHA | `79d3e67b968e80f93f13e25d14222af271c6b052` |
| SOURCE_RC_SHA | `b88aaf99780e0a5d71404e831fd87eb90031fb6e` |
| Production baseline app SHA (before) | `98b3b15e258966dd61ad967af5876982bcfcb959` |
| Production app SHA (after) | `79d3e67b968e80f93f13e25d14222af271c6b052` (`APP_VERSION`) |
| Production DB head (before) | `20260818120000` |
| Production DB head (after) | `20260902120000` |
| Migration range applied | `20260819120000` → `20260902120000` (excluded `20260901120000`) |
| Backup | PASS — run `29598013983` / latest physical `1135896161` |
| Deployment | `dpl` aliased to https://app.lunchportalen.no |

## Country activation

| Key | Value |
|-----|--------|
| Norway production | ENABLED |
| Norway registration | ENABLED |
| Norway ordering | ENABLED |
| Norway invoice_only (payment mode) | ENABLED |
| Norway commission calculation | ENABLED |
| Real platform MVA invoicing | **BLOCKED** (MVA not registered) |
| Other countries disabled | 20/20 |
| Global 21-country kill switch | false |

## Business / tax model

- Commercial model: `agency_commission_invoice_only_v1`
- Commission: 5% of net excl. customer MVA
- Platform service VAT code: `NO_PLATFORM_SERVICE_STANDARD_VAT_25` (eligible only after MVA registration)
- Stripe: OFF

## Canary / financial balance (unit + gate)

| Line | Amount |
|------|--------|
| Customer net | NOK 10 000,00 |
| Food MVA 15% | NOK 1 500,00 |
| Commission net 5% | NOK 500,00 |
| Commission MVA 25% | NOK 125,00 |
| Platform invoice total | NOK 625,00 |

- `npm run` / vitest phase16no: PASS (commission not computed from gross/MVA)
- `issueCommissionInvoice` gated by `assertPlatformMvaInvoiceAllowed` → blocked while unregistered
- Stripe calls policy: OFF
- Full live employee Golden Path order against production customers: not executed this window (math/gates + DB allow-order verified)

## Safety

| Check | Result |
|-------|--------|
| Backup | PASS |
| Restore rehearsal (data PITR) | NOT AVAILABLE via API (`pitr: null`); schema branch auto-migrate FAILED; staging owner/MVA gate rehearsal PASS |
| Migrations | PASS (19 applied) |
| RLS on new activation table | ENABLED |
| Health after redeploy | PASS |
| Login | 200 |
| Cross-tenant / wrong-provider live negative suite | not re-run this window (prior golden-path locks remain) |
| Legal/privacy clickwrap productization | stubs present; not forged LEGAL_APPROVED |
| Umbraco / Azure / marketing | untouched |

## Monitoring

- Start 24h health watch on `/api/health` version = `79d3e67b…`
- 7-day commission reconciliation: no real MVA invoices should appear until Merverdiavgiftsregisteret = YES

## Final decision

**NORWAY_TECHNICALLY_LIVE_PLATFORM_INVOICING_AWAITS_MVA_REGISTRATION**
