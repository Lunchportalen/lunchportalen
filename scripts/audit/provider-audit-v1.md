# PROVIDER-AUDIT v1

**Date:** 2026-05-20  
**Scope:** Read-only Lunchportalen-kartlegging for PROVIDER-PLAN-V1 (multi-leverandør SaaS-pivot)  
**Method:** Repo-crawl + Supabase MCP `execute_sql` (staging `uigxsboqeruxflgzqztl`, prod `hkpokyapzarefrgqzkos`)  
**HV:** Ingen e-post, UUID eller PII i klartekst i denne rapporten.

---

## TL;DR

1. **Single-tenant i praksis:** Én operativ leverandør (Lunchportalen) uten `provider_id` i schema. All tenant-isolasjon skjer via `company_id` / `location_id` og membership-tabeller.
2. **Rollemodell er dual-track:** `profiles.role` (`user_role`-enum) er runtime-sannhet for app-gating; `company_memberships` / `location_memberships` (`membership_role`) er parallell modell med trigger-sync fra legacy `profiles`; `platform_user_roles` (`platform_role`) finnes men er **tom i prod**.
3. **Superadmin** = `profiles.role = 'superadmin'` (via `getAuthContext` / `isSuperadminProfile`). **`is_platform_admin()`** er separat SECURITY DEFINER-funksjon brukt i RLS — ikke identisk med superadmin.
4. **190 RLS-policies** i `public`/`auth`; dominerende mønstre: `can_access_company`, `can_admin_company`, `is_platform_admin()`, `is_superadmin()`, `private.*`-helpers.
5. **Tre-tier avtaler** (`agreement_tier`: BASIS/LUXUS/ENTERPRISE) er i DB og app etter Enterprise Patch 2, men **prod har kun BASIS-avtaler** (5/5). **ENTERPRISE fakturering er ikke komplett** (TODO i outbox; `billing_products` finnes i migrasjon men **ikke i prod-DB**).
6. **Sanity `menuDay`** har 3-tier `planTier`; **`productPlan`-schema er fortsatt 2-tier** (basis/luxus). Ingen provider-scope på CMS-innhold.
7. **Kjøkken:** `superadmin` ser **alle** ordrer for dato (`tenant: "system"`); `kitchen`-rolle scopes til `profiles.company_id` + `profiles.location_id`.
8. **Registrering:** Public form → `POST /api/public/register-company` → RPC `lp_company_register` → `company_registrations` (PENDING) → superadmin godkjenner via `lp_agreement_approve_active`.
9. **Tripletex:** Kanonisk klient er `lib/integrations/tripletex/client.ts`. **`lib/tripletex/client.ts` er legacy/orphan** (2-tier, ingen imports i repo).
10. **Staging DB er tom** (alle kjerne-counts = 0 etter B4.2.1-wipe). **Prod tilgjengelig via MCP** — liten dataset (9 firma, 19 profiler).
11. **Umbraco** = kun public marketing CMS; ingen applikasjonslogikk. Provider-branding lever ikke i Umbraco i dag.
12. **Provider-pivot impliserer:** nye tabeller (`providers`, `provider_memberships`), `provider_id`-kolonner på scope-sensitive tabeller, RLS-omskriving (~190 policies), Sanity provider-scope på menyer, nye `/leverandør`-routes — **ikke** endring av core JWT/auth-flow.

---

## Seksjon 1 — Roller og Auth

### 1.1 `profiles`-tabell (MCP staging)

| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| id | uuid | NO | — |
| email | text | YES | — |
| full_name | text | YES | — |
| **role** | **USER-DEFINED (`user_role`)** | NO | `'employee'::user_role` |
| company_id | uuid | YES | — |
| location_id | uuid | YES | — |
| active | boolean | NO | true |
| disabled_at | timestamptz | YES | — |
| archived_at | timestamptz | YES | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| phone | text | YES | — |
| dietary_notes | text | YES | — |
| allergy_notes | text | YES | — |
| is_active | boolean | YES | true |

**Rolle-relaterte kolonner:** Kun `role` (enum). Ingen `is_admin`, `is_superadmin`, `plan_tier` på profiles.

**Merk:** `active` og `is_active` coexister (legacy/normalisering pågår i triggers og auth).

### 1.2 Global rolle-enum: `user_role`

Verdier (MCP `pg_enum`):

| enum | labels |
|------|--------|
| `user_role` | employee, company_admin, superadmin, kitchen, driver |

**Relaterte enums (ikke på profiles direkte):**

| enum | labels | Bruk |
|------|--------|------|
| `membership_role` | employee, location_admin, company_admin, company_finance | company/location_memberships |
| `company_role` | company_owner, company_admin, finance, location_manager, employee | company_contracts m.m. |
| `platform_role` | platform_admin, platform_ops, kitchen, courier, finance_internal | platform_user_roles |

**Kode-roller utover DB-enum:** `company_finance`, `location_admin` normaliseres i `lib/auth/role.ts` men finnes **ikke** i `user_role`-enum — de mappes via membership eller alias.

### 1.3 Membership-tabeller

**Tabeller med «membership» i navn:** `company_memberships`, `location_memberships`.

#### `company_memberships`

| Kolonne | Type | Nullable | Default |
|---------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| company_id | uuid | NO | — |
| role | membership_role | NO | employee |
| active | boolean | NO | true |
| created_at / updated_at | timestamptz | NO | now() |
| source | text | NO | 'manual' |
| location_id | uuid | YES | — |
| status | membership_status | YES | invited |
| employee_number, cost_center | text | YES | — |
| granted_by | uuid | YES | — |
| activated_at | timestamptz | YES | — |

**FK:** `user_id → profiles.id`, `company_id → companies.id`, `location_id → company_locations.id`

#### `location_memberships`

| Kolonne | Type | Nullable | Default |
|---------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| company_id | uuid | NO | — |
| location_id | uuid | NO | — |
| role | membership_role | NO | employee |
| active | boolean | NO | true |
| source | text | NO | 'manual' |
| created_at / updated_at | timestamptz | NO | now() |

**FK:** Composite FK til `company_locations(company_id, id)`; `user_id → profiles.id`; also FK chain til `company_memberships(user_id, company_id)`.

#### `platform_user_roles`

| Kolonne | Type | Nullable |
|---------|------|----------|
| user_id | uuid | NO |
| role | platform_role | NO |
| granted_by | uuid | YES |
| created_at | timestamptz | NO |

**Prod count:** 0 rader (tom tabell).

### 1.4 Auth-helpers i kode

#### `require*` / guard-mønstre

| Fil | Funksjon | Formål |
|-----|----------|--------|
| `lib/auth/scope.ts` | `requireRole`, `requireSuperadmin`, `requireCompanyAdmin`, `requireEmployee`, `requireKitchen`, `requireDriver` | Scope-basert rolle-gating etter `getScope()` |
| `lib/auth/requireRoleServer.ts` | `requireRoleServer(allowed: Role[])` | Server layout/API |
| `lib/auth/requireRole.ts` | `requireRole(["superadmin" \| "company_admin" \| "employee"])` | Legacy smal allowlist |
| `lib/superadmin/auth.ts` | `requireSuperadmin()` | **Legacy:** sjekker `user_metadata.role` — avviker fra kanonisk `profiles.role` |
| `lib/superadmin/rootMode.ts` | `requireRootIfNeeded` | Break-glass / root mode |
| `lib/http/routeGuard.ts` | `scopeOr401`, `requireRoleOr403`, `requireCompanyScopeOr403` | **Kanonisk API-gate** for de fleste routes |

#### `with*` wrappers

| Fil | Status |
|-----|--------|
| `lib/http/withRole.ts` | **LEGACY** — flagges av `scripts/audit-api-routes.mjs` |
| `withCompanyAccess` / `withAuth` | **Ikke funnet** som aktive wrappers |

#### Supabase server-klienter

| Kilde | Bruk |
|-------|------|
| `lib/supabase/server.ts` → `supabaseServer()` | Cookie-bound SSR-klient (layouts, auth) |
| `lib/auth/getAuthContext.ts` | `createServerClient` / `createClient` med cookie eller Bearer |
| `lib/auth/scope.ts` | `supabaseFromRequest(req)` for API scope |
| `lib/supabase/admin.ts` | Service role (superadmin handlers, kitchen load, outbox) |

#### JWT / metadata

| Mønster | Forekomst | Vurdering |
|---------|-----------|-----------|
| `raw_user_meta_data` | SQL triggers (`handle_new_user`, profile sync) | Kun display name — **ikke auth-gate** |
| `app_metadata.role` | `app/api/cron/daily-sanity/route.ts` | Cron-spesifikk; **ikke primær gate** |
| `user_metadata.role` | `lib/superadmin/auth.ts` (legacy) | **Unsikker mønster** — avviker fra AGENTS.md anbefaling |

**Kanonisk auth-sannhet:** `getAuthContext()` → `lookupMembership()` → `profiles` (eller RPC `lp_membership_get` hvis aktivert via `LP_AUTH_MEMBERSHIP_SOURCE`).

### 1.5 Eksisterende roller — oppsummering

| Rolle | Landing (role.ts) | Layout-guard | Typiske routes/API |
|-------|-------------------|--------------|-------------------|
| superadmin | `/superadmin` | `app/superadmin/layout.tsx` | `/superadmin/*`, `/api/superadmin/*`, system repairs |
| company_admin | `/admin` | `app/admin/layout.tsx` | `/admin/*`, `/api/admin/*` |
| company_finance | `/admin/insights` | admin layout | Insights, billing read |
| location_admin | `/admin/locations` | admin layout | Location admin |
| employee | `/week` | `app/(app)/layout.tsx` | `/week`, `/api/orders/*` |
| kitchen | `/kitchen` | `app/kitchen/layout.tsx` | `/kitchen/*`, `/api/kitchen/*` |
| driver | `/driver` | `app/driver/layout.tsx` | `/driver/*`, `/api/driver/*` |

**Hvor sjekkes det:**

| Lag | Mekanisme |
|-----|-----------|
| Layout (server) | `getAuthContext()` + `auth.role !== X` → redirect |
| API | `scopeOr401` + `requireRoleOr403` |
| RLS | `profiles.role`, `is_superadmin()`, `is_platform_admin()`, membership-joins via `private.can_*` |
| DB triggers | Order/agreement gates uavhengig av app |

**Prod profil-fordeling (aggregert, ingen PII):**

| role | count |
|------|-------|
| employee | 7 |
| company_admin | 6 |
| superadmin | 2 |
| kitchen | 2 |
| driver | 2 |

### 1.6 Superadmin-mønster

| Spørsmål | Svar |
|----------|------|
| Hvordan defineres superadmin? | `profiles.role = 'superadmin'` (`user_role` enum). `isSuperadminProfile()` delegater til `getRoleForUser()`. |
| Hvor sjekkes tilgang? | Layout guards, `requireRoleOr403(..., ["superadmin"])`, RLS `is_superadmin()` og `profiles.role = 'superadmin'` på enkelte policies. |
| Finnes `is_platform_superadmin`? | **Nei.** Finnes `is_platform_admin()` og `is_superadmin()` som separate SECURITY DEFINER-funksjoner. |
| Allowlist e-post? | `systemRoleByEmail` i `getAuthContext` for systemkontoer (f.eks. order-bot) — ikke superadmin-definisjon. |

**Viktig skille for provider-plan:**

- `superadmin` = Lunchportalen plattform-eier (Control Tower)
- `is_platform_admin()` = bredere platform-rolle inkl. `platform_user_roles` — brukes i RLS for admin-operasjoner
- Provider-admin vil trolig **ikke** være `superadmin` — ny rolle/membership (`provider_admin`) bør speile `company_admin`-mønsteret

---

## Seksjon 2 — RLS-Policies

### 2.1 Oversikt

**Totalt:** 190 policies i `public` + `auth` (MCP staging).

Policies returnert via:

```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'auth')
ORDER BY tablename, policyname;
```

### 2.2 Policy-kategorier (mønstre)

#### A) Superadmin-only (eksplisitt profiles.role)

Tabeller med `profiles.role = 'superadmin'`:

- `agreement_cleanup_audit`, `agreement_requests`, `content_pages`, `content_page_variants`, `lead_pipeline`, `social_posts`

#### B) `is_superadmin()` / `is_platform_admin()`

- `companies` (write_superadmin + select via private helpers)
- `enterprise_groups`, `esg_daily`, `esg_monthly`, `production_manifests`
- AI-tabeller, audit, outbox, idempotency, incidents, system_health_snapshots

#### C) Company/location membership scope

Via `can_access_company()`, `can_admin_company()`, `can_access_location()`, `can_admin_location()`, `can_kitchen_location()`:

- `agreements`, `agreement_delivery_days`, `closed_dates`, `deliveries`, `orders`, `company_memberships`, `location_memberships`, m.fl.

#### D) `private.*` schema helpers

Eksempler:

- `private.can_access_company`, `private.can_manage_company`, `private.can_finance_company`
- `private.can_view_order`, `private.can_edit_order`
- `private.has_platform_role(ARRAY['platform_admin', ...])`

Brukes på: `companies`, `orders`, `order_items`, `invoice_*`, `billing_adjustments`, `products`, `delivery_runs`

#### E) Profile-direct (legacy kitchen/employee)

- `day_choices`: employee own-row + kitchen same company/location
- `kitchen_batches`: kitchen role + matching `location_id`
- `company_locations`: `current_profile_role()` + `current_profile_company_id()`

#### F) Service role only

- `ai_action_memory`, `system_settings`, `company_registrations` (service_role full)

### 2.3 Utvalgte policies per kjerne-tabell

#### `profiles`

| policy | cmd | Sjekk |
|--------|-----|-------|
| profiles_select | SELECT | `private.can_view_profile(id)` |
| profiles_select_authenticated_scoped | SELECT | self OR platform_admin OR can_admin_company(company_id) |
| profiles_update | UPDATE | self OR platform_admin |
| profiles_insert_none | INSERT | false |
| profiles_delete_none | DELETE | false |

#### `orders`

| policy | cmd | Sjekk |
|--------|-----|-------|
| orders_select | SELECT | `private.can_view_order(id)` |
| orders_select_bridge_scoped | SELECT | platform_admin OR own OR admin OR kitchen_location OR driver delivery join |
| orders_insert | INSERT | own + can_access_location OR can_manage_location OR platform_role |
| orders_update | UPDATE | can_view + edit rules |

**Merk:** Duplikat SELECT-policies (`orders_select` + `orders_select_bridge_scoped`) — dokumentert i `docs/audit/orders-select-rls-consolidation-plan.md`.

#### `companies`

| policy | cmd | Sjekk |
|--------|-----|-------|
| companies_select | SELECT | `private.can_access_company(id)` |
| companies_update | UPDATE | `private.can_manage_company(id)` |
| companies_insert | INSERT | platform_role admin/ops |
| companies_write_superadmin | ALL | `is_superadmin()` |

### 2.4 SECURITY DEFINER-funksjoner (utvalg)

Totalt ~55 `prosecdef=true` i `public` (MCP).

| Funksjon | Formål |
|----------|--------|
| `is_superadmin()` | RLS bypass-gate for superadmin |
| `is_platform_admin()` | Platform admin inkl. platform_user_roles |
| `can_access_company(uuid)` | Membership-basert read |
| `can_admin_company(uuid)` | Admin write scope |
| `can_kitchen_location(uuid)` | Kitchen read for location |
| `current_profile_role()` / `_company_id()` / `_location_id()` | Legacy profile snapshot for RLS |
| `sync_memberships_from_legacy_profile()` | Trigger: profiles → memberships |
| `recompute_profile_legacy_scope()` | Memberships → profiles tilbakesync |
| `lp_company_register(...)` | Atomic company registration |
| `lp_agreement_approve_active(...)` | Registration → active company |
| `lp_order_set(...)` | Order mutation RPC |
| `lp_outbox_claim` / `_mark_sent` / `_mark_failed` | Outbox worker |

**RLS-policies som bruker dem:** Nesten all scoped access i `agreements`, `orders`, `deliveries`, `company_memberships`.

### 2.5 Tabell-gruppering av policies (190 totalt)

| Tabellgruppe | Antall tabeller (ca.) | Dominant mønster |
|--------------|----------------------|------------------|
| Orders / items / status | 3 | private.can_view/edit_order |
| Companies / locations / memberships | 5 | can_access/admin_company + platform |
| Agreements / delivery_days | 3 | scoped + platform_admin |
| Invoices / billing / tripletex | 8 | can_finance_company + platform_admin |
| Kitchen / production | 4 | profile role + location match |
| AI / system / audit | 15+ | platform_admin only |
| CMS i DB (legacy) | 5 | superadmin_only |
| Products / allergens / tags | 6 | platform_role OR company scoped |
| Driver / deliveries | 5 | driver_user_id + admin scope |
| Forms / marketing_pages | 3 | platform_admin |

**Auth schema policies:** Ingen eksplisitte policies listet i export for auth.* — Supabase default auth schema RLS.

### 2.6 RLS-mønstre identifisert

| Mønster | Eksempler | Provider-mirror |
|---------|-----------|-----------------|
| User owns row via FK | orders.user_id, day_choices.user_id | + provider_id filter |
| User has company membership | companies, agreements | + provider_membership join |
| User is superadmin | enterprise_groups, esg | Platform vs provider-admin split |
| User is kitchen at location | kitchen_batches, orders bridge | Kitchen scoped per provider |
| Platform admin | AI, outbox, audit | Provider-ops vs platform-ops |
| Service role bypass | company_registrations insert | Worker keys per provider? |

---

## Seksjon 3 — Database Schema (public)

### 3.1 Alle public base tables (staging MCP)

**Kjerne (operativ):** companies, company_locations, company_memberships, location_memberships, profiles, agreements, agreement_delivery_days, orders, order_items, day_choices, company_registrations, company_invites, employee_invites, deliveries, delivery_runs, driver_runs, kitchen_batches, production_days, production_manifests, menu_service_days, menu_service_day_items, products, outbox, invoices, invoice_lines, invoice_runs, tripletex_customers, tripletex_invoices, billing_adjustments, closed_dates, standing_orders, enterprise_groups

**Støtte/audit:** audit_events, audit_log (+ partitions), audit_log_legacy, profile_cleanup_audit, agreement_cleanup_audit, idempotency, repair_jobs, system_health_snapshots, system_incidents, ops_events

**AI (platform):** ai_config, ai_jobs, ai_suggestions, ai_activity_log, ai_action_memory, ai_health_checks, ai_config_audit

**Legacy/migration stubs:** `_migration_legacy_stub_*`, `_migration_orders_location_id_backup`

**CMS i DB (deprecated/parallel):** content_pages, content_page_variants, marketing_pages, media_items, forms, form_submissions

**Totalt:** ~100+ tabeller inkl. audit_log partitions.

### 3.2 Kjerne-tabeller — kolonner (staging)

#### `companies`

PK: `id`. Status: `company_status` enum (LEAD, PENDING, ACTIVE, PAUSED, CLOSED, TERMINATED).

Viktige kolonner: name, orgnr, organization_number, status, employee_count, contact_*, address, billing_email, enterprise_group_id, default_location_id, slug, timezone, deleted_at.

#### `company_locations`

PK: `id`. FK: company_id → companies. name, address, status, slot_policy.

#### `agreements`

PK: `id`. FK: company_id, location_id.

| Kolonne | Type | Merknad |
|---------|------|---------|
| tier | agreement_tier | BASIS \| LUXUS \| ENTERPRISE |
| status | agreement_status | PENDING \| ACTIVE \| PAUSED \| CLOSED \| REJECTED |
| delivery_days | jsonb | Legacy weekday array |
| price_per_meal_nok / _luxus_nok / _enterprise_nok | integer | Prising per tier |
| agreement_delivery_days | separat tabell | Per-day tier (Patch 2) |

#### `orders`

PK: `id`. FK: user_id, company_id, location_id, agreement_id.

Viktige: date, status (order_status), tier (agreement_tier), slot, unit_price_nok, cutoff_at, locked_at, prisfelt (cents).

#### `company_registrations`

PK: `id`. status text default PENDING. plan_tier text, weekday_meal_tiers jsonb, submitted_payload jsonb. FK: company_id, agreement_id, reviewed_by.

#### `profiles`

Se seksjon 1.1.

### 3.3 Plan-relaterte enums

| Enum | Verdier |
|------|---------|
| `agreement_tier` | BASIS, LUXUS, ENTERPRISE |
| `agreement_status` | PENDING, ACTIVE, PAUSED, CLOSED, REJECTED |

**`plan_tier` som kolonne:** Finnes på `company_registrations.plan_tier` (text), **ikke** på `agreements` (bruker `tier`).

**CHECK constraint plan_tier:** Ikke funnet som separat CHECK — styres via enum på agreements.

### 3.4 Triggers (utvalg)

| Trigger | Tabell | Funksjon |
|---------|--------|----------|
| **trg_profiles_sync_memberships** | profiles INSERT/UPDATE | `sync_memberships_from_legacy_profile()` |
| trg_profiles_audit_legacy_scope_write | profiles UPDATE | `audit_direct_profile_scope_write()` |
| trg_company_memberships_recompute_profile_legacy_scope | company_memberships | `recompute_profile_legacy_scope()` |
| trg_location_memberships_recompute_profile_legacy_scope | location_memberships | idem |
| orders_require_active_agreement | orders | agreement gate |
| orders_require_active_company | orders | company gate |
| orders_cutoff_0800 | orders | cutoff enforcement |
| order_status_history | orders | audit trail |

**`trg_profiles_sync_memberships` — bekreftet:** Eksisterer på INSERT/UPDATE av profiles. Synkroniserer membership-rader når legacy profile-felt endres — **sentral for membership↔profile dual-write**.

### 3.5 ER-diagram (tekstuelt)

```
auth.users
    │ 1:1
    ▼
profiles ─────────────────────────────┐
    │ role (user_role)                │
    │ company_id, location_id         │
    │                                 │
    ├──► company_memberships ◄────────┤
    │         │ role (membership_role)│
    │         ▼                       │
    │    companies ◄──────────────────┘
    │         │ 1:N
    │         ├── company_locations
    │         │       ▲
    │         │       │ location_memberships
    │         │       │
    │         ├── agreements (tier, status)
    │         │       ├── agreement_delivery_days (per weekday tier)
    │         │       └── company_registrations (approval pipeline)
    │         │
    │         ├── orders (date, tier, user_id, location_id)
    │         │       ├── order_items
    │         │       └── day_choices
    │         │
    │         ├── invoices / invoice_runs / tripletex_*
    │         └── company_invites / employee_invites

platform_user_roles (user_id → platform_role)  [tom i prod]

[outbox] ──► Tripletex sync events
[menu_service_days/items] ◄── Sanity publish webhook (operativ meny i DB)
```

**Mangler for provider-modell:** `providers`, `provider_memberships`, `provider_id` FK på companies/agreements/orders/menu_service_days/kitchen scope.

### 3.6 Indekser og constraints (utvalg)

#### `orders`

- PK: `id`
- Typiske indexes (fra schema dump): `(date, company_id)`, `(date, location_id)`, `(user_id, date)`, `(agreement_id)`, `(status)`
- FK: company_id → companies, location_id → company_locations, user_id → profiles, agreement_id → agreements
- CHECK/trigger-enforced: active company, active agreement, cutoff, closed dates, frozen production days

#### `company_memberships`

- UNIQUE implisitt via (user_id, company_id) i praksis — verifiser i dump
- Indexes: company_id, user_id
- Trigger: `validate_company_membership_scope` — location_id må tilhøre company

#### `agreement_delivery_days`

- Kolonner: agreement_id, weekday (text), tier (agreement_tier)
- Patch 2: erstatter/ supplerer agreements.delivery_days jsonb for tier-per-day

### 3.7 `outbox`-tabell (worker-kontrakt)

Kolonner (fra migrasjon-preflight): event_key, status, attempts, last_error, locked_at, locked_by, payload, created_at, updated_at.

| status | Betydning |
|--------|-----------|
| PENDING | Klar for claim |
| PROCESSING | Locked av worker |
| SENT | Fullført |
| FAILED | Retrybar |
| FAILED_PERMANENT | Dead letter |

**Dedup:** UNIQUE på event_key — idempotent upsert for invoice.ready.

### 3.8 `menu_service_days` / `menu_service_day_items` (operativ meny)

Materialisert fra Sanity publish — **tenant-bound via location_id** på menu_service_days.

RLS:

- SELECT: `private.can_access_menu_day(id)`
- MANAGE: `private.can_manage_menu_day(id)` + location manage check

**Provider-gap:** location → company → **mangler provider**. Provider-pivot må enten:

- legge provider_id på menu_service_days direkte, eller
- joine company → provider for RLS

### 3.9 Full enum-inventar (public schema)

| enum | count labels |
|------|--------------|
| user_role | 5 |
| membership_role | 4 |
| membership_status | 4 |
| platform_role | 5 |
| agreement_tier | 3 |
| agreement_status | 5 |
| company_status | 6 |
| order_status | 8 |
| invoice_status | 10 (inkl. legacy lowercase) |
| delivery_status | 13 (duplikat casing legacy) |
| billing_mode | 3 |
| menu_state | 4 |
| production_status | 3 |
| tripletex_sync_status | 5 |

**Legacy-duplikater:** delivery_status og invoice_status har både UPPER og lower case labels — normaliser ved provider-migrasjon.

---

## Seksjon 4 — Prod-Data Status

### 4.1 Prod-DB tilgjengelig via MCP

**Project ref:** `hkpokyapzarefrgqzkos` (Lunchportalen's Project, eu-west-1, Postgres 17).

#### Table counts (aggregert)

| Tabell | Count |
|--------|-------|
| companies | 9 |
| agreements | 5 |
| profiles | 19 |
| orders | 5 |
| company_registrations | 2 |

#### Plan/tier-fordeling (agreements.tier)

| tier | count |
|------|-------|
| BASIS | 5 |

**Ingen LUXUS eller ENTERPRISE i prod-data ennå.**

#### Agreement status

| status | count |
|--------|-------|
| PENDING | 1 |
| ACTIVE | 4 |

#### Company status

| status | count |
|--------|-------|
| PENDING | 1 |
| ACTIVE | 6 |
| PAUSED | 1 |
| CLOSED | 1 |

#### Eldste company

| metric | value |
|--------|-------|
| MIN(created_at) | 2026-05-08 (UTC) |

**Tolkning:** Prod-dataset er lite og ungt — migrasjonsrisiko for provider-pivot er **moderate** (få rader), men **schema-kompleksitet** er høy.

#### `billing_products` i prod

```sql
SELECT ... FROM billing_products
```

**Resultat:** `relation "billing_products" does not exist` — migrasjon `20260218_norwegian_standard_billing.sql` er **ikke applied** i prod, eller tabell droppet. **Blokkerer Tripletex produkt-mapping i prod.**

#### `platform_user_roles` i prod

Count: **0** — platform_role-systemet er skalert men ubrukt.

### 4.2 Prod tilgjengelighet

**Status:** Prod-DB **lesbar via MCP** — ingen manuell count nødvendig fra bruker.

### 4.3 Staging-data (B4.2.1-wipe bekreftet)

Staging ref: `uigxsboqeruxflgzqztl`

| Tabell | Count |
|--------|-------|
| companies | 0 |
| agreements | 0 |
| profiles | 0 |
| orders | 0 |
| company_registrations | 0 |
| company_memberships | 0 |
| location_memberships | 0 |
| products | 0 |
| outbox | 0 |

**Bekreftet:** Staging er tom operativ data; schema er synket fra prod dump (B3a).

---

## Seksjon 5 — Sanity (CMS)

### 5.1 Schema-typer (studio/schemaTypes)

| Document type | Fil | Formål |
|---------------|-----|--------|
| menuDay | menuDay.ts | Dagmeny per planTier + category — **WeekPlanner** |
| productPlan | productPlan.ts | Kommersiell plan (pris, allowedMeals) |
| lunchCategory | lunchCategory.ts | Statisk kategoriinnhold |
| mealIdea | mealIdea.ts | Varmmatbank / basebank |
| menu | menu.ts | Legacy meny-dokument |
| weekTemplate | weekTemplate.ts | Ukemal |
| closedDate | closedDate.ts | Stengte dager |
| pricingInfo | pricingInfo.ts | Prisinformasjon |
| announcement | announcement.ts | Kunngjøringer |
| page | page.ts | CMS-side |

**Registrering:** `studio/schemaTypes/index.ts` eksporterer alle typer.

#### `menuDay` — nøkkelfelt

- `date` (date, required)
- **`planTier`**: BASIS | LUXUS | **ENTERPRISE** (radio, required)
- `category`: paasmurt, salat, sushi, pokebowl, thai, varmrett
- `mealRef` → mealIdea
- Uniqueness validation per (date, planTier, category)

#### `productPlan` — nøkkelfelt

- `name`: **kun basis | luxus** (radio) — **mangler enterprise**
- `price`, `includesWarm`, `allowedMeals`, `rules.allowDailyVariation`

#### `lunchCategory` / `mealIdea`

- `allowedPlanTiers` på mealIdea (Patch 2: item-level tier filtering)
- Statiske kategorier for basis/luxus/enterprise meal keys

### 5.2 Plan-håndtering i Sanity

| Spørsmål | Svar |
|----------|------|
| Hvordan refereres plan_tier? | `menuDay.planTier` string enum (BASIS/LUXUS/ENTERPRISE). DB bruker `agreement_tier`. |
| Hardkodet eller dynamisk? | Hardkodet lister i schema options — **ikke** DB-drevet. |
| Legacy 2-tier schemas? | **Ja:** `productPlan.name` kun basis/luxus; `allowedMealTypes` legacy felt. |

**Sanity → DB pipeline:** Publish webhook (`/api/sanity/webhook` el.l.) materialiserer `menu_service_days` / `menu_service_day_items` i Supabase — **ingen provider_id i dag**.

### 5.3 Sanity content counts

**Status:** Sanity content counts **ikke hentet** i denne audit (krever `SANITY_WRITE_TOKEN` / client_token i runtime).

**Project/dataset (fra docs):**

| Env | project_id | dataset |
|-----|------------|---------|
| Prod | 4udoq5d8 | production |
| Staging | 4udoq5d8 | staging (tom utenom bootstrap) |

**Anbefaling for PROVIDER-PLAN:** GROQ count queries per `_type` og per `planTier` når token tilgjengelig.

---

## Seksjon 6 — Registreringsflyt

### 6.1 Code paths

```
app/(auth)/registrering/page.tsx
    └── components/auth/CompanyRegistrationForm.tsx (client)
            POST /api/public/register-company/route.ts
                └── supabaseAdmin().rpc("lp_company_register", {...})
                        └── INSERT company_registrations (PENDING)
                        └── (ev. company stub — avhenger av RPC-implementasjon)
```

**Alternativ path:** `app/api/public/onboarding/register/route.ts` — samme RPC.

#### Form-felter (CompanyRegistrationForm)

| Felt | Validering |
|------|------------|
| companyName, orgnr (9 siffer) | required |
| employeesCount | min 20 |
| contactName, contactEmail, contactPhone | required |
| addressLine, postalCode (4), postalCity | required |
| confirmAuthority | must be true |
| weekdayTiers | per weekday: BASIS/LUXUS/ENTERPRISE via parseRegistrationPlanPayload |
| deliveryWindowFrom/To, termsBindingMonths, termsNoticeMonths | plan payload |

**UI tier-select:** Viser BASIS, Luxus — **ENTERPRISE i weekdayTiers type men ikke alle UI-paths**.

#### RPC `lp_company_register` (fra schema dump)

Signatur:

```sql
lp_company_register(
  p_company_name text, p_orgnr text, p_employee_count integer,
  p_contact_name text, p_contact_email text, p_contact_phone text,
  p_address_line text, p_postal_code text, p_postal_city text
) RETURNS json
```

**Atferd (høynivå):**

1. Idempotency via hash av input
2. Validerer orgnr (9 siffer), company name, employee count
3. INSERT into company_registrations (status PENDING)
4. Returnerer `{ company_id, status, receipt }` JSON
5. **Service role only** — public route bruker supabaseAdmin()

Utvidet plan payload (weekday_meal_tiers) sendes via separat kolonne-oppdatering eller utvidet RPC i nyere versjoner — verifiser i live schema dump (`scripts/audit/staging-schema-dump-2026-05-20.sql`).

### 6.2 Approval-flow

| Steg | Aktør | Mekanisme |
|------|-------|-----------|
| 1. Innsending | Public (anon) | RPC `lp_company_register` via service role |
| 2. Review queue | superadmin | `/superadmin` company registrations / agreements list |
| 3. Godkjenning | superadmin | `POST /api/superadmin/agreements/[id]/approve` → RPC `lp_agreement_approve_active` |
| 4. Avslag | superadmin | `POST .../reject` → `lp_agreement_reject_pending` |
| 5. Onboarding invite | system | `company_invites` + e-post med activate token |

**Status-transitions:**

```
company_registrations: PENDING → (approved via agreement flow)
agreements: PENDING → ACTIVE (approve) | REJECTED (reject)
companies: PENDING → ACTIVE (ved approve)
```

**Trigger/RPC lager company + agreement:** `lp_agreement_approve_active` — atomisk; **ikke** separat client-side multi-write.

**RLS på company_registrations:**

- service_role: full access
- authenticated superadmin: ALL via profiles.role check

---

## Seksjon 7 — Billing / Tripletex

### 7.1 Tripletex-klienter

| Fil | Status | Tier-støtte |
|-----|--------|-------------|
| `lib/integrations/tripletex/client.ts` | **KANONISK** — brukt av outbox, tripletexEngine | ensureCustomer, ensureProduct, createInvoice |
| `lib/tripletex/client.ts` | **ORPHAN/LEGACY** — ingen imports i repo | Kun BASIS \| LUXUS i TripletexProductInput |

**Forskjell:**

- Integrations-klient: moderne error taxonomy (`TripletexClientError`), retry, `ensureCustomer`/`ensureProduct` med DB-mapping (`billing_products`, `tripletex_customers`)
- Legacy-klient: eldre `TripletexError`, 2-tier product input — **kandidat for sletting etter Patch 2.1**

### 7.2 Plan → produkt mapping

| Lag | Konfigurasjon |
|-----|---------------|
| DB | `billing_products` (tier → tripletex_product_id, revenue_account, tax_code) — **finnes i migrasjon, mangler i prod** |
| Kode | `fetchBillingProductConfig()` i outbox — kun BASIS/LUXUS |
| Superadmin | `app/api/superadmin/invoices/generate/route.ts` → `loadBillingProducts()` |

**ENTERPRISE-status (post Patch 2):**

- Outbox `handleInvoiceReadyEvent`: eksplisitt TODO — Enterprise product mapping **ikke konfigurert**
- Ved tier=ENTERPRISE → `INVOICE_PERIOD_TIER_INVALID` eller defer

### 7.3 Outbox

**Processor:** `app/api/system/outbox/process/route.ts`

**Event keys (observed):**

| event_key pattern | Handler |
|-------------------|---------|
| `invoice.ready:{unique_ref}` | Tripletex invoice create (claim from outbox) |
| `invoice.sent:{unique_ref}` | Post-send marker (enqueued after success) |

**Flyt:**

1. Cron/superadmin genererer invoice period → upsert outbox `invoice.ready:*`
2. Outbox worker claim (`lp_outbox_claim` / `outbox_claim_next`)
3. Load company billing profile + tripletex_customers mapping
4. ensureCustomer → ensureProduct (BASIS/LUXUS lines; MIXED = both)
5. createInvoice → mark SENT → enqueue invoice.sent

**Andre outbox events (referert i kodebase):** `order:set` (production-check docs) — ikke fullt kartlagt i denne audit.

**RLS:** outbox — authenticated insert/update/delete **false**; select platform_admin only. Worker bruker **service role**.

---

## Seksjon 8 — Kjøkken

### 8.1 Kitchen-routes (full liste)

**Pages:**

| Path | Fil |
|------|-----|
| `/kitchen` | app/kitchen/page.tsx |
| `/kitchen/report` | app/kitchen/report/page.tsx |
| `/kitchen/print` | app/kitchen/print/page.tsx |

**API routes:**

| Method | Path | Fil |
|--------|------|-----|
| GET | /api/kitchen | app/api/kitchen/route.ts |
| GET | /api/kitchen/today | app/api/kitchen/today/route.ts |
| GET | /api/kitchen/day | app/api/kitchen/day/route.ts |
| GET | /api/kitchen/orders | app/api/kitchen/orders/route.ts |
| GET | /api/kitchen/orders.csv | app/api/kitchen/orders.csv/route.ts |
| POST | /api/kitchen/orders/batch-status | app/api/kitchen/orders/batch-status/route.ts |
| GET | /api/kitchen/companies | app/api/kitchen/companies/route.ts |
| GET | /api/kitchen/company | app/api/kitchen/company/route.ts |
| GET | /api/kitchen/report | app/api/kitchen/report/route.ts |
| GET | /api/kitchen/report.csv | app/api/kitchen/report.csv/route.ts |
| GET | /api/kitchen/demand-forecast | app/api/kitchen/demand-forecast/route.ts |
| * | /api/kitchen/batch/* | batch/start, set, list, summary, get, upsert, reset |

**Komponenter:** KitchenView.tsx, KitchenClient.tsx, KitchenProductionPanel.tsx, KitchenRuntimeClient.tsx

**Tester:** tests/kitchen/* (grouping, cutoff, api envelope, loadOperativeKitchenOrders)

**Layout guard:** `kitchen` OR `superadmin` (`app/kitchen/layout.tsx`).

### 8.2 lib/kitchen/*

| Modul | Funksjon |
|-------|----------|
| `kitchenFetch.ts` | Client fetch + normalize `{ ok, rid, data }` envelope |
| `loadOperativeKitchenOrders.ts` | **Kjerne:** henter ACTIVE orders for date; tenant scope |
| `report.ts` | Aggregeringer for rapport |
| `groupKitchen.ts` / `buildProductionHierarchy.ts` | Deterministisk grouping: date → slot → company → location |
| `dayData.ts`, `ordersFeed.ts`, `batchSummary.ts` | Støtte |

**Data kjøkken ser:**

- orders (ACTIVE) for valgt dato
- day_choices (meal selection, not CANCELLED)
- profiles (employee name) via admin client
- companies/locations names
- tier (BASIS/LUXUS/ENTERPRISE) per order
- menu_title/description (fra menu_service_day_items eller CMS cache)

### 8.3 Implikasjon for provider-scope

| Rolle | Scope i dag |
|-------|-------------|
| **superadmin** | `tenant: "system"` → **ALLE ordrer** for dato på tvers av companies |
| **kitchen** | `tenant: { companyId, locationId }` fra profiles → **kun eget firma/lokasjon** |

**Svar:** Kjøkken **kan** i dag se alle ordrer **hvis** bruker er superadmin. Vanlig kitchen-bruker er **scoped til én location**. 

**Provider-pivot:** Dagens `kitchen`-rolle antar **én leverandør med mange company-kunder**. Multi-provider krever:

- Enten provider-scoped kitchen user (ser alle companies **under sin provider**)
- Eller beholde location-scope hvis hver location tilhører én provider

**RLS:** `can_kitchen_location(location_id)` + `kitchen_batches` policy matcher profile location.

---

## Seksjon 9 — Umbraco (bekreftelse)

### 9.1 Eksisterende templates/views

| Asset | Plassering |
|-------|------------|
| MarketingPage.cshtml | `Umbraco/Views/MarketingPage.cshtml` |
| uSync ContentTypes | `Umbraco/uSync/v17/ContentTypes/*` (marketingPage, heroBanner, textBlock, …) |
| DataTypes | LP-prefixed block lists (LPHeroBanner*, LPDualPromo*, …) |

**Ingen** provider-spesifikke document types funnet.

### 9.2 Applikasjonslogikk i Umbraco?

**Nei** — per `docs/architecture/PUBLIC_SITE_AND_APP_BOUNDARIES.md`:

- Umbraco = public marketing HTML (Azure)
- Next.js = operativ app (Vercel)
- Middleware redirecter marketing paths til `UMBRACO_PUBLIC_SITE_URL` når satt

### 9.3 Provider-content (logo, beskrivelse)

**I dag:** Public brand i `/public/brand/` (Next). Umbraco har generiske marketing blocks — **ingen provider entity**.

**For provider-pivot:** Provider-branding bør **ikke** i Umbraco (med mindre white-label public sites) — anbefalt i app/DB (`providers.logo_url`, `providers.display_name`).

---

## Seksjon 10 — Dokumentasjon (eksisterende docs)

### 10.1 docs/ — utvalg med 1-linje beskrivelse

#### docs/audit/ (relevant for provider)

| Fil | Beskrivelse |
|-----|-------------|
| staging-env-mapping-2026-05-20.md | B3e staging env mapping Vercel↔Supabase↔Sanity |
| supabase-state.md | Supabase miljøstatus |
| sanity-live-state.md | Sanity live/prod dataset status |
| current-menu-architecture.md | Meny flyt Sanity→DB→Week |
| week-flow-architecture.md | Employee /week dataflow |
| admin-flow-architecture.md | Company admin flows |
| orders-select-rls-consolidation-plan.md | Duplikat RLS på orders |
| CRON_WORKER_AND_OUTBOX_REPORT.md | Cron + outbox worker kartlegging |
| b4-volume-seed-plan-v1.md | Volume seed plan staging |
| API_SURFACE_AND_GATING_REPORT.md | API route auth audit |

#### docs/architecture/

| Fil | Beskrivelse |
|-----|-------------|
| PUBLIC_SITE_AND_APP_BOUNDARIES.md | Umbraco vs Next ansvarsdeling |
| membership-role-company-finance.md | company_finance rolle design |
| menu-publish-pipeline.md | Sanity publish → menu_service_days |
| cron-jobs.md | Scheduled jobs oversikt |
| employee-vs-admin-price-visibility.md | Pris synlighet per rolle |

#### docs/ (øvrig)

| Fil | Beskrivelse |
|-----|-------------|
| staging-strategy.md | Variant C staging strategi |
| rls-golden.md | RLS testforventninger |
| multitenant-p-backlog.md | Multitenant backlog (relatert) |

#### docs/rc/ og docs/performance (utvalg)

| Fil | Beskrivelse |
|-----|-------------|
| docs/staging-strategy.md | Variant C: tom staging data + prod schema |
| docs/volume-seed-strategy.md | B4 volume seed strategi |
| docs/performance-p-backlog.md | Performance backlog |
| docs/multitenant-p-backlog.md | Multitenant discovery backlog |
| docs/hot-paths.md | Kritiske request paths |
| docs/rls-golden.md | Golden RLS test cases |
| docs/audit-log-strategy.md | Partitionert audit_log strategi |

#### docs/umbraco/

| Fil | Beskrivelse |
|-----|-------------|
| CANONICAL_CONTENT_MODEL.md | Umbraco content type modell |
| FOUNDATION2_HOME_TRUTH.md | Forside canonical struktur |
| EDITORIAL_UMBRACO_LOCK.md | Redaksjonelle låser |

### 10.2 README og high-level

| Fil | Status |
|-----|--------|
| README.md | **Tom/placeholder** (redeploy note only) |
| ARCHITECTURE.md | **Ikke i root** — se `cua/docs/architecture.md` og docs/architecture/* |
| Provider-dokumentasjon | **Finnes ikke ennå** |

---

## Seksjon 11 — Enterprise State (post Patch 2)

### 11.1 Patch 2-scope (git history)

Enterprise/tre-tier arbeid spenner over commits (nyeste først):

| Commit | Beskrivelse |
|--------|-------------|
| c7450d01 | Sanity item-level allowedPlanTiers + lunchCategory |
| 2f35a3d2 | Week-planner tier-aware auto-fill BASIS/LUXUS/ENTERPRISE |
| a4468414 | Billing 15% MVA + ENTERPRISE price branch |
| a879bb01 | lunchCategory schema + allowedPlanTiers on mealIdea |
| 2374bf4e | **feat: tre-tier meny, agreement-gate, admin shell phase 1** (+ sanity dumps) |
| 776463a9 | tier-per-day fra agreement_delivery_days |
| da8c832b | mixed-tier label SystemStatus |

**Root commit 2374bf4e endret:** primært sanity dump docs under `docs/audit/sanity-dump/` — schema/endring spredt over påfølgende commits.

### 11.2 Patch 2.1 gjenværende hull (2-tier-antagelser)

| Fil/område | Problem |
|------------|---------|
| `lib/tripletex/client.ts` | 2-tier only, **orphan** (ingen imports) |
| `app/superadmin/agreements/[id]/agreement-detail-client.tsx` | `cmsForTier = agreement.tier === "LUXUS" ? cmsLuxus : cmsBasis` — **ENTERPRISE fallthrough til Basis CMS** |
| `app/api/kitchen/route.ts` | KitchenRow tier type: `"BASIS" \| "LUXUS" \| null` — mangler ENTERPRISE i API type |
| `app/onboarding/OnboardingForm.tsx` | Tier type har ENTERPRISE men UI-knapper kun BASIS/LUXUS |
| `studio/schemaTypes/productPlan.ts` | Kun basis/luxus i name enum |
| `app/api/system/outbox/process/route.ts` | TODO: Enterprise billing_products mapping |
| **Prod DB** | `billing_products` tabell mangler |
| `components/auth/CompanyRegistrationForm.tsx` | Tier select options BASIS/LUXUS (ENTERPRISE i weekday type) |

**Grep-baserte 2-tier rester:** `fetchBillingProductConfig(tier: "BASIS" | "LUXUS")`, TripletexProductInput i legacy client.

---

## Seksjon 12 — Oppsummering + Implikasjoner for provider-modell

### 12.1 Eksisterende mønstre som GJENBRUKES

| Mønster | Dagens impl | Provider-mirror |
|---------|-------------|-----------------|
| Company membership | `company_memberships(user_id, company_id, role)` | `provider_memberships(user_id, provider_id, role)` |
| Location sub-scope | `location_memberships` under company | `provider_locations` + location memberships under provider |
| Profile legacy sync | `trg_profiles_sync_memberships` | Utvid sync trigger for provider scope |
| Auth context | `getAuthContext` → role + company_id + location_id | Legg til `provider_id` i AuthContext for provider-roller |
| API guards | `scopeOr401` + `requireRoleOr403` | `requireProviderRole`, `mustProviderId(scope)` |
| RLS helpers | `can_access_company(id)` | `can_access_provider(id)`, `can_admin_provider(id)` |
| Registration pipeline | RPC atomisk create | `lp_provider_register` / `lp_company_register` med provider_id |
| Kitchen tenant | `OperativeKitchenTenant` system vs company | `provider` vs `system` vs `company` |
| Outbox | Idempotent event_key | Provider-scoped billing events |

### 12.2 Hva som MÅ endres

#### Database

- [ ] `providers` (id, name, slug, status, branding, billing config)
- [ ] `provider_memberships` (user_id, provider_id, role, status)
- [ ] `provider_id NOT NULL` på: companies, agreements, orders, menu_service_days, products(?), kitchen_batches
- [ ] Nye RLS policies (~190 må re-evalueres — ikke alle trenger rewrite, men core tables ja)
- [ ] SECURITY DEFINER helpers: `can_access_provider`, `current_provider_id()`
- [ ] Migrering av eksisterende data → default provider «Lunchportalen»

#### Sanity

- [ ] `providerRef` eller `providerSlug` på menuDay, mealIdea, lunchCategory
- [ ] productPlan: enterprise + provider scope
- [ ] GROQ queries i WeekPlanner filtrert på provider
- [ ] Evt. dataset-per-provider (tungt) vs. shared dataset med provider field (anbefalt)

#### UI / Routes

- [ ] `/leverandor` eller `/provider` admin shell (speil `/admin` mønster)
- [ ] Provider header tabs i HeaderShell (ny rolle-tab-set)
- [ ] Superadmin: provider management under `/superadmin/providers`
- [ ] Kitchen: provider-scoped order feed

#### Auth

- [ ] Ny rolle: `provider_admin` (eller gjenbruk `kitchen`+membership?) — **designvalg**
- [ ] `landingForRole` + post-login allowlist for `/provider*`
- [ ] **JWT/session:** kan gjenbrukes — provider_id i profiles eller membership lookup

#### Billing

- [ ] `billing_products` per provider (eller provider_id på eksisterende)
- [ ] ENTERPRISE + multi-provider Tripletex mapping
- [ ] Apply manglende billing migrasjon i prod

### 12.3 Hva som IKKE endres

| Område | Begrunnelse |
|--------|-------------|
| Umbraco public CMS | Marketing only; provider white-label er separat fase |
| Core Supabase Auth | JWT/cookies/session flow bevares |
| Employee `/week` UX mønster | Uendret UX; data scope får provider filter i backend |
| company_admin rolle | Fortsatt company-scoped; companies får provider_id FK |
| Middleware login gates | Kun nye paths legges til allowlist |
| Canonical header primitives | Nye tabs, samme HeaderShell |

### 12.4 Risikoer identifisert

| Risiko | Alvorlighet | Mitigering |
|--------|-------------|------------|
| RLS policy omfang (~190) | **Høy** | Faseinndelt: providers → companies → orders; bruk private schema helpers |
| Dual membership/profile sync | **Medium** | Ett skriv-path; provider_memberships med samme trigger-mønster |
| Sanity content migration | **Medium** | Default provider tag på alt eksisterende innhold |
| billing_products mangler i prod | **Høy** | Apply migrasjon før provider billing |
| ENTERPRISE ikke fakturerbar | **Medium** | Fullfør Patch 2.1 før provider pivot billing |
| Kitchen global superadmin view | **Lav** | Bevisst design; provider-admin får egen scope |
| Legacy lib/tripletex/client.ts | **Lav** | Slett etter bekreftet zero-import |
| lib/superadmin/auth.ts user_metadata | **Medium** | Fjern legacy gate; bruk getAuthContext overalt |
| Prod dataset lite | **Lav** | Gunstig for migrering — få rader å backfille |
| platform_user_roles ubrukt | **Info** | Avklar om provider_ops mappes hit vs ny enum |

### 12.5 Anbefalt PROVIDER-PLAN-V1 sekvens (forslag)

1. **Domain model doc** — provider entity, role matrix, data ownership
2. **DB migration fase 1** — providers + provider_memberships + default backfill
3. **Auth fase** — provider_id i getAuthContext for provider-roller
4. **RLS fase 1** — companies.orders.agreements provider filter
5. **Sanity fase** — providerSlug på menuDay
6. **UI fase** — /provider shell read-only → write
7. **Billing fase** — per-provider billing_products + Tripletex
8. **Kitchen fase** — provider-scoped production view

---

## Appendix A — MCP Query Log (referanse)

All SQL kjørt read-only via Supabase MCP `execute_sql`:

- Staging project: `uigxsboqeruxflgzqztl`
- Prod project: `hkpokyapzarefrgqzkos`

Queries inkludert: information_schema.columns (profiles, memberships), pg_policies full export, pg_enum, pg_proc prosecdef, information_schema.triggers, table counts, prod tier/status aggregations, platform_user_roles count.

**Timeouts/feil dokumentert:**

- `billing_products` SELECT on prod → relation does not exist
- `billing_products` SELECT on staging → connection timeout (schema dump confirms table in migration)

---

## Appendix B — Filreferanser (kanoniske)

| Område | Path |
|--------|------|
| Auth context | `lib/auth/getAuthContext.ts` |
| Role normalization | `lib/auth/role.ts` |
| Scope + gates | `lib/auth/scope.ts` |
| API guard | `lib/http/routeGuard.ts` |
| Superadmin layout | `app/superadmin/layout.tsx` |
| Registration RPC caller | `app/api/public/register-company/route.ts` |
| Agreement approve | `app/api/superadmin/agreements/[agreementId]/approve/route.ts` |
| Outbox worker | `app/api/system/outbox/process/route.ts` |
| Tripletex (canonical) | `lib/integrations/tripletex/client.ts` |
| Kitchen loader | `lib/server/kitchen/loadOperativeKitchenOrders.ts` |
| Sanity schemas | `studio/schemaTypes/*.ts` |
| Billing migration | `supabase/migrations/20260218_norwegian_standard_billing.sql` |
| Agents law | `AGENTS.md` |

---

*End of PROVIDER-AUDIT v1 — read-only, 2026-05-20*
