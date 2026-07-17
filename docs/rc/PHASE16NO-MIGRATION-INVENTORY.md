# PHASE 16NO — PRODUCTION MIGRATION INVENTORY

**Production head (before):** `20260818120000` (`anon_grant_lockdown`)  
**Norway release target head:** `20260902120000` (`norway_first_country_activation`)  
**Excluded:** `20260901120000_global_15g3b_review_operations`

## Range to apply (ordered)

| Version | Name | Class | Notes |
|---------|------|-------|-------|
| 20260819120000 | canonical_invite_accept_rpcs | additive / RPC | Invite accept RPCs |
| 20260820120000 | provider_self_service_registration | additive | Provider registration |
| 20260821120000 | agreement_status_values | additive / constraint | Agreement statuses |
| 20260821130000 | company_agreement_lifecycle | additive | Agreement lifecycle |
| 20260822120000 | kitchen_batch_driver_assignment | additive | Kitchen/driver |
| 20260823120000 | invoice_only_billing_lifecycle | additive | Invoice-only billing |
| 20260824120000 | commission_invoice_only_settlement | additive | Commission settlement |
| 20260824130000 | commission_invoice_rpc_variable_conflict_fix | additive / fix | RPC fix |
| 20260825120000 | global_tax_accounting_readiness | additive / policy | Market approvals + gates |
| 20260825130000 | invoice_currency_truth | additive / constraint | Invoice currency |
| 20260825140000 | market_gate_legacy_tenant_scope | additive / policy | Market gate scope |
| 20260826120000 | superadmin_norwegian_translations | additive | NO translations |
| 20260827120000 | orders_currency_market_truth | additive / constraint | Order currency truth |
| 20260827130000 | order_line_snapshots_detach_fk | additive / FK | Snapshot FK detach |
| 20260828120000 | global_21_tax_legal_foundation | additive | Tax/legal foundation |
| 20260829120000 | global_15g1_evidence_jurisdictions_review | additive | Evidence/jurisdictions |
| 20260830120000 | global_15g2_technical_completion | additive | Kill switch default false |
| 20260831120000 | global_15g2b_provider_technical_status | additive | Provider technical status |
| 20260902120000 | norway_first_country_activation | additive / policy | Norway-first gates |

## Classification summary

- Destructive / irreversible DROP of production data tables: **none identified in inventory**
- RLS remains enabled on new tables
- Kill switch remains `global_cutover_allowed = false`
- Non-NO activation forbidden by trigger
- Norway fiscal enable requires `accountant_tax_confirmation = CONFIRMED`

## Required before production apply

1. Production backup PASS + checksum/reference
2. PITR / restore rehearsal on isolated environment PASS
3. Full migration dry-run on rehearsal PASS
4. Norway Golden Path on rehearsal PASS
5. Manual authorised production migrate workflow only

## Abort conditions

- Unexplained destructive DDL
- Protected org rule regression (Melhus, Pettersen & Co, provider≠customer)
- RLS disabled
- Unexpected production baseline SHA/migration head drift
