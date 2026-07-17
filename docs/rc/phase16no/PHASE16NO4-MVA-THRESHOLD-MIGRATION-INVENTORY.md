# Phase 16NO.4 — Migration inventory

**Migration:** `supabase/migrations/20260904120000_norway_mva_threshold_controller.sql`  
**Prerequisite in repo:** `20260903120000_norway_legal_clickwrap_enforcement.sql`  
**Production head at planning:** `20260902120000` (clickwrap not yet applied)

## Statement classification

| Class | Objects |
|-------|---------|
| Additive tables | `norway_mva_taxable_events`, `norway_mva_threshold_calculations`, `norway_mva_invoice_holds`, `norway_mva_registration_checks`, `norway_mva_threshold_warnings`, `norway_mva_threshold_audit`, `norway_mva_threshold_config` |
| Indexes | recognition/crossing/status/dedupe indexes on new tables |
| Constraints | UNIQUE ledger_event_id, UNIQUE dedupe_key, CHECK enums |
| Policies | RLS enable + superadmin SELECT via `lp_is_superadmin()` |
| Function replace | `lp_country_production_allowed` (+ `platform_invoice_without_mva`) |
| Function create | `lp_is_superadmin`, immutability triggers |
| Backfill | none |
| Destructive | **0** |
| Existing financial row mutation | **0** |

## Dark-deploy default

`norway_mva_threshold_config.controller_enabled = false`

## Rollback / forward-fix

- Forward-fix preferred: set `controller_enabled=false`; keep tables.
- Do not DROP tables in production without owner approval.
- VAT remains blocked by `mva_registered=false` + `platform_invoice_vat_25_enabled=false`.

## Rehearsal checklist

1. Apply on isolated DB (staging branch or recovery project)
2. Idempotent re-apply (CREATE IF NOT EXISTS / OR REPLACE)
3. RLS: anon/authenticated non-superadmin cannot read holds
4. `lp_country_production_allowed('NO','platform_invoice_without_mva')` true when no holds
5. `lp_country_production_allowed('SE','order')` false
6. No change to `commission_ledger` / invoice totals
