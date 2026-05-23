# PR-X2 DC-018 RLS billing_* — 2026-05-23

## Pre-state (staging + prod)

| Tabell | Miljø | RLS | Policies | Grants (non-postgres) | Row count |
| ------ | ----- | --- | -------- | --------------------- | --------- |
| billing_products | staging | false | 0 | `service_role`: SELECT | 3 |
| billing_tax_codes | staging | false | 0 | `service_role`: SELECT | 4 |
| billing_products | prod | false | 0 | `anon`, `authenticated`, `service_role`: ALL | 3 |
| billing_tax_codes | prod | false | 0 | `anon`, `authenticated`, `service_role`: ALL | 4 |

**Bekrefter DC-018:** `rowsecurity=false`, ingen policies på begge tabeller i begge miljøer.

**Prod-eksponering før fix:** `anon` og `authenticated` hadde full CRUD-grant uten RLS — katalogdata var lesbar/skrivbar via PostgREST for alle roller med grant.

---

## Migration

- **Fil:** `supabase/migrations/20260609120000_dc018_enable_rls_billing.sql`
- **Mønster (Q3-godkjent):** ENABLE RLS + `authenticated` SELECT-policy + `GRANT SELECT TO authenticated`; write kun via `service_role` (ingen write-policy)
- **Staging apply:** SUCCESS (MCP `uigxsboqeruxflgzqztl`, 2026-05-23)
- **Prod apply:** SUCCESS (MCP `hkpokyapzarefrgqzkos`, 2026-05-23)

---

## Post-state

| Tabell | Miljø | RLS | Policy | Verifikasjon |
| ------ | ----- | --- | ------ | ------------ |
| billing_products | staging | true | `billing_products_authenticated_select` (SELECT, authenticated) | authenticated: 3 rader; INSERT denied |
| billing_tax_codes | staging | true | `billing_tax_codes_authenticated_select` (SELECT, authenticated) | authenticated: 4 rader; INSERT denied |
| billing_products | prod | true | `billing_products_authenticated_select` | authenticated: 3 rader; INSERT RLS-blocked |
| billing_tax_codes | prod | true | `billing_tax_codes_authenticated_select` | authenticated: 4 rader; anon: 0 rader (RLS) |

### SQL-tester (prod)

```sql
-- authenticated SELECT → bp=3, btc=4 (uendret)
SET LOCAL ROLE authenticated;
SELECT count(*) FROM billing_products;  -- 3

-- authenticated INSERT → RLS policy violation
-- anon SELECT → 0 rader (ingen anon-policy)
```

### App-smoke

- Ingen dedikert offentlig billing-endpoint i appen; verifisert via direkte SQL + rolle-impersonering.
- **Sentry prod/staging (manuell):** sjekk siste 5 min for RLS-relaterte feil etter apply.

---

## Anbefaling

- [x] **PR-X2 LUKKET** — klar for PR-X3 (DC-019 tenant-scoped RLS)
