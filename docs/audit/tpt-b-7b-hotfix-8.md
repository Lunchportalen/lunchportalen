# TPT-B-7b-hotfix-8 — Full GRANT-audit for B-7-worker

**Dato:** 2026-05-22  
**Forrige:** hotfix-7 (`a320b59a`) — `/ledger/vatType` + decimal rate-match

---

## Rotårsak

Staging schema-drift: `service_role` mangler table-level GRANTs som prod har. Hotfix-6 fikset `billing_tax_codes`; hotfix-7 passerte VAT men feilet på `billing_products` (`can_select=false`).

---

## FASE 1 — Audit (B-7 onboarding worker)

| Tabell | Worker-access | Staging (før) | Prod |
|--------|---------------|---------------|------|
| `agreements` | SELECT | ✓ | ✓ |
| `companies` | SELECT | ✓ | ✓ |
| `billing_tax_codes` | SELECT | ✓ (hotfix-6) | ✓ |
| `billing_products` | SELECT | **✗** | ✓ |
| `provider_tripletex_credentials` | SELECT/UPDATE (via RPC) | ✓ | ✓ |
| `provider_tripletex_products` | SELECT/INSERT/UPDATE | ✓ | ✓ |
| `tripletex_customers` | SELECT/INSERT/UPDATE | ✓ (hotfix-6) | ✓ |
| `lifecycle_audit_log` | INSERT (sync handlers) | **✗** | ✓ |
| `outbox` | SELECT/UPDATE | ✓ | ✓ |

---

## Fix

Migration `20260607120000_tpt_b7_hotfix8_service_role_grants.sql`:

- `GRANT SELECT ON billing_products`
- `GRANT SELECT, INSERT ON lifecycle_audit_log`
- Defensive repeat: `billing_tax_codes`, `tripletex_customers`

---

## Pattern-lærdom

Legg til CI GRANT-coverage-test som sammenligner `has_table_privilege('service_role', …)` staging vs prod for worker-tabeller — fanger drift før smoke.

---

## Verifikasjon

Etter apply + dispatch: onboarding event `SENT`, `onboarding_provisioning_complete_at` satt, produkter og kunder opprettet.
