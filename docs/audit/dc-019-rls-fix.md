# PR-X3 DC-019 tenant RLS — 2026-05-23

## Del 1 — Discovery

### Pre-state (staging + prod)

| Tabell | Miljø | RLS | Policies | Tenant-kolonne | Rows |
| ------ | ----- | --- | -------- | -------------- | ---- |
| invoice_periods | staging | false | 0 | `company_id` (NOT NULL) | 0 |
| invoice_periods | prod | false | 0 | `company_id` (NOT NULL) | 0 |
| tripletex_exports | staging | false | 0 | **ingen** — kun `unique_ref`, `tripletex_invoice_id`, `created_at` | 0 |
| tripletex_exports | prod | false | 0 | **ingen** (dedupe-map) | 0 |
| company_deletions | staging | false | 0 | `company_id` (NOT NULL) | 0 |
| company_deletions | prod | false | 0 | `company_id` (NOT NULL) | 0 |

**Bekrefter DC-019:** `rowsecurity=false`, 0 policies på alle tre i begge miljøer.

### Grants (PR-X2-drift)

| Miljø | invoice_periods | tripletex_exports | company_deletions |
| ----- | ----------------- | ----------------- | ----------------- |
| **staging** | kun `postgres` | kun `postgres` | kun `postgres` |
| **prod** | `anon`, `authenticated`, `service_role`: ALL | samme | samme |

Migrasjon inkluderer `GRANT SELECT TO authenticated` (staging manglet).

### Schema-avvik: tripletex_exports

Tabellen har **ikke** `company_id` eller `provider_id`. Den er en global dedupe-map (`unique_ref` PK) med referanser til:

| unique_ref-mønster | Kilde | Tenant-oppløsning |
| ------------------ | ----- | ----------------- |
| `{company_id}:{period}` | `invoice_periods.unique_ref` | JOIN → `company_id` |
| `lp_agreement:{id}` | `agreement_invoices` | JOIN → `company_id` |
| `lp_bw:{company_id}:…` | billing window | `split_part` → UUID |
| `lp_saas:{id}` | `provider_invoices` | **kun** `is_platform_admin()` (provider-scoped; ikke company) |

All app-lesing i dag skjer via `supabaseAdmin()` (service_role) — RLS er defense-in-depth for PostgREST.

---

## Kopierte patterns

| Type | Canonical kilde | Policy qual |
| ---- | --------------- | ----------- |
| **Tenant-scoped** | `agreements.agreements_select_scoped` (company-delen) | `is_platform_admin() OR can_access_company(company_id)` |
| **Superadmin-only** | `lifecycle_audit_log.lifecycle_audit_log_superadmin_select` | `is_platform_admin()` |

Helper-funksjoner brukt (public schema, eksisterende):
- `public.is_platform_admin()`
- `public.can_access_company(uuid)` — inkl. `company_memberships`, `location_memberships`, `profiles`

---

## Migration

- **Fil:** `supabase/migrations/20260609130000_dc019_enable_rls_tenant_tables.sql`
- **Staging apply:** SUCCESS (`uigxsboqeruxflgzqztl`, 2026-05-23)
- **Prod apply:** SUCCESS (`hkpokyapzarefrgqzkos`, 2026-05-23)

---

## Post-state

| Tabell | RLS | Policy | Verifikasjon |
| ------ | --- | ------ | ------------ |
| invoice_periods | true | `invoice_periods_tenant_select` | authenticated uten JWT → 0 rader; INSERT → RLS-blocked |
| tripletex_exports | true | `tripletex_exports_tenant_select` (JOIN-basert) | authenticated uten JWT → 0 rader |
| company_deletions | true | `company_deletions_superadmin_select` | authenticated uten JWT → 0 rader |

### Funksjonelle tester

| Rolle | invoice_periods | tripletex_exports | company_deletions |
| ----- | --------------- | ----------------- | ----------------- |
| `anon` (staging) | permission denied (ingen grant) | — | — |
| `authenticated` uten uid | 0 | 0 | 0 |
| `authenticated` INSERT | RLS policy violation (prod) | — | — |

**Tripletex/cron:** Flow 2 webhook + cron bruker `service_role` — bypasser RLS, upåvirket.

**App-smoke:** Ingen dedikert billing-UI for `invoice_periods` via PostgREST; Sentry manuell sjekk anbefalt (siste 5 min).

---

## Anbefaling

- [x] **PR-X3 LUKKET** — klar for PR-X4 (DC-026 Tripletex Flow 1 flag)
