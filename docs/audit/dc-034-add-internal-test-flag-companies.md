# DC-034 — Add internal/test flag to companies

**Status:** OPEN (ticket)  
**Dato:** 2026-05-24  
**Kontekst:** K6 LIVE Del 5 — prod test-tenant «Lunchportalen QA»

## Problem

`public.companies` har ingen kolonne for å markere intern/QA/test-tenant:

| Kolonne søkt | Finnes (prod) |
|--------------|---------------|
| `is_internal` | ✗ |
| `is_test` | ✗ |
| `tenant_type` | ✗ |
| `metadata` (jsonb) | ✗ |

Uten flagg er QA-tenant kun identifiserbar via navn (`Lunchportalen QA`) og dedikert orgnr (`888888888`).

## Anbefalt løsning

```sql
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.companies.is_internal IS
  'True for Lunchportalen-owned QA/load-test tenants; excludes from commercial reporting.';
```

Valgfritt: partial index `WHERE is_internal = true` for superadmin-filter.

## K6 LIVE impact

Migrasjon `20260524130000_k6_prod_tenant.sql` oppretter tenant uten flagg.  
Revert/navigation til intern tenant krever manuell navne-sjekk inntil DC-034 deployes.

## Acceptance

- [ ] Kolonne + default `false` på staging og prod
- [ ] «Lunchportalen QA» satt til `is_internal = true`
- [ ] Superadmin company-list kan filtrere intern (future)
