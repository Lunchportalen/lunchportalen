# PHASE 16NO.2 — COMMERCIAL LIVE GATE

**Captured:** 2026-07-17  
**Branch:** `release/norway-first-live`  
**Legal status (locked):** `NORWAY_LEGAL_STATUS = OWNER_APPROVED_EXTERNAL_REVIEW_PENDING`

Do **not** claim lawyer / accountant / regulator / LEGAL_APPROVED certification.

## Documents delivered (nb-NO, versioned + checksummed)

| Document | Type | Role |
|----------|------|------|
| Catering provider agreement | `provider_terms` | provider |
| Platform commission / invoice terms | `invoice_payment_terms` | provider |
| Allergen/menu/tax/delivery responsibility | `allergen_food_responsibility` | provider |
| Privacy notice | `privacy_notice` | provider, company, employee |
| DPA | `dpa` | provider |
| Company/customer terms | `company_terms` | company |
| Cancellation and refund | `cancellation_refund` | company |
| End-user terms | `employee_terms` | employee |

Pack version: `1.0.0-owner-2026-07-17` · effective `2026-07-17`  
Source: `lib/legal/norwayDocuments.ts`

## Clickwrap enforcement

- Checkbox not pre-selected (`NorwayLegalClickwrap`)
- Links open exact document version (`GET /api/legal/norway/documents/[type]`)
- Server validates checksum + version (`validateNorwayAcceptanceBatch`)
- Persist requires actor (`ACTOR_REQUIRED`)
- Immutable rows + triggers (`20260903120000_norway_legal_clickwrap_enforcement.sql`)
- Reacceptance on material version/checksum change
- Audit event `NORWAY_LEGAL_ACCEPTANCE` on batch persist
- Superadmin inspect read-only: `/superadmin/legal/norway` — fabricate forbidden

## Role gates

- Company registration / onboarding: company docs required
- Provider registration (NO): provider docs required (pending until actor materializes)
- Employee `/week` + `GET /api/week`: employee docs required

## MVA-safe mode (unchanged)

- Real platform MVA invoices blocked
- MVA suffix / EHF VAT invoice submission blocked
- Norway ordering + commission accrual remain enabled

## Restore

- Status remains: `RESTORE_REHEARSAL_LIMITED`
- Runbook: `docs/rc/PHASE16NO1-RESTORE-REHEARSAL-LIMITED.md` (updated)

## Decision

See final report section below after deploy evidence is attached.
