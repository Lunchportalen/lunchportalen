# Patch 4 — Provider core DB schema + RLS baseline

**Dato:** 2026-05-20  
**Autorisert av:** Bruker (Phase E.4 apply-flyt)  
**Metode:** MCP `apply_migration` (staging → prod)

---

## Discovery / avvik fra PROVIDER-PLAN §4

| Funn | Handling |
|------|----------|
| `public.audit_log` finnes allerede | B2c partitioned row-audit (`20260518125753`) — **kan ikke** opprettes på nytt |
| PROVIDER-PLAN §4 `audit_log` (entity lifecycle) | Implementert som **`lifecycle_audit_log`** med samme semantikk (uuid, actor_id, action, entity_type, entity_id, reason, metadata) |
| Eksisterende tabeller | **Urørt** — ingen `provider_id` (Patch 5) |
| `is_platform_admin()` | Finnes i prod/staging (`20260517000000_capture_prod_rls_drift`) |

---

## Migrasjonsfiler (repo)

| Fil | LOC | Innhold |
|-----|-----|---------|
| `supabase/migrations/20260520150000_provider_core_schema.sql` | 142 | Enums, 4 tabeller, indexes, comments, verification |
| `supabase/migrations/20260520150001_provider_core_rls_baseline.sql` | 48 | RLS enable + superadmin baseline policies |

---

## Apply-rekkefølge

| Steg | Miljø | Migrasjon | MCP resultat |
|------|--------|-----------|--------------|
| 1 | Staging `uigxsboqeruxflgzqztl` | `provider_core_schema` | success |
| 2 | Staging | `provider_core_rls_baseline` | success |
| 3 | Prod `hkpokyapzarefrgqzkos` | `provider_core_schema` | success |
| 4 | Prod | `provider_core_rls_baseline` | success |

**MCP `schema_migrations` (prod):**

- `20260520110148` — `provider_core_schema`
- `20260520110152` — `provider_core_rls_baseline`

---

## Pre-state

| Objekt | Staging | Prod |
|--------|---------|------|
| `providers` | Nei | Nei |
| `provider_memberships` | Nei | Nei |
| `provider_service_areas` | Nei | Nei |
| `lifecycle_audit_log` | Nei | Nei |
| `provider_status` / `provider_role` enums | Nei | Nei |
| `user_role` provider_* | Nei | Nei |

`public.audit_log` (B2c): **finnes** i begge (uendret).

---

## Post-state (verifisert)

### Tabeller (4)

| Tabell | Staging | Prod |
|--------|---------|------|
| `providers` | Ja | Ja |
| `provider_memberships` | Ja | Ja |
| `provider_service_areas` | Ja | Ja |
| `lifecycle_audit_log` | Ja | Ja |

### Enums

- `provider_status`: ACTIVE, PAUSED, SUSPENDED, CLOSED
- `provider_role`: provider_admin, provider_kitchen, provider_viewer
- `user_role` utvidet: +3 provider-verdier (begge miljø)

### RLS

| Tabell | RLS | Policy |
|--------|-----|--------|
| `providers` | ON | `providers_superadmin_all` (ALL, `is_platform_admin()`) |
| `provider_memberships` | ON | `provider_memberships_superadmin_all` (ALL) |
| `provider_service_areas` | ON | `provider_service_areas_superadmin_all` (ALL) |
| `lifecycle_audit_log` | ON | `lifecycle_audit_log_superadmin_select` (SELECT only) |

**Policy-telling:** 4 policies (3× ALL + 1× SELECT på lifecycle).

### Data

- **0 rader** i `providers` / `lifecycle_audit_log` (ingen seed — Patch 5)

### Schema parity

`providers`-kolonner identiske staging ↔ prod (20 kolonner).

---

## Ikke inkludert (bevisst)

- `can_access_provider()` — Patch 6
- Provider-scope RLS — Patch 6
- `lifecycle_audit_log` INSERT policies / suspend RPCs — Patch 7
- `provider_id` på companies/agreements/orders — Patch 5
- Melhus seed — Patch 5

---

## Referanser

- PROVIDER-PLAN-V1 §4 (`docs/audit/provider-plan-v1.md`, commit `08b3cf49`)
- Patch 3 types (`lib/providers/types.ts`, commit `c0f5ccac`)

**Neste:** Patch 5 — `provider_id` + Melhus default backfill.
