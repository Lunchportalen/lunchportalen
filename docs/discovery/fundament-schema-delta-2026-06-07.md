# Fundament-schema DELTA — live prod vs. ratifisert mål (Fase 0)

**Dato:** 2026-06-07  
**Prosjekt:** `hkpokyapzarefrgqzkos` (eu-west-1)  
**Modus:** 100 % read-only · MCP `execute_sql` · live katalog = sannhet  
**Mål-spec (§3, ratifisert):** `organizations(type provider|customer)` × `memberships(user×org×rolle)` × `platform_admins` (atskilt fra tenant-RLS); `agreements` scopet til kunde-org (valgfritt lokasjons-sett); RLS på `active_org_id`-claim.

---

## Read-only-attestasjon

| Krav | Status |
|------|--------|
| Ingen DDL/DML/RPC med side-effekt | ✓ Kun `SELECT` via MCP |
| Ingen migrasjon, commit, PR, kodeendring | ✓ |
| Konklusjoner kryss-sjekket mot live katalog | ✓ (`information_schema`, `pg_policies`, `pg_trigger`, `pg_get_functiondef`, `pg_enum`) |
| PII | ✓ Kun counts; e-post maskert (`kit***@lunchportalen.no`) |
| Denne filen committes ikke | ✓ |

**Metode:** Supabase MCP `execute_sql` mot prod ref `hkpokyapzarefrgqzkos`, 2026-06-07.

---

## 1. Executive summary

Live prod har **ingen** av de tre fundament-tabellene (`organizations`, `memberships`, `platform_admins`). Tenant-identitet lever i et **dual-modell**-skjema:

- **Kunde:** `companies` (+ `company_locations`)
- **Leverandør:** `providers`
- **Medlemskap:** tre parallelle tabeller (`company_memberships`, `location_memberships`, `provider_memberships`)
- **Plattform-admin:** `profiles.role = superadmin'` (2 brukere) + tom `platform_user_roles` (0 rader)

**Avstand til mål:** **Langt.** Alle kjernepilarer i fundament-spec mangler eller divergerer:

| Pilar | Live | Avstand |
|-------|------|---------|
| Unified `organizations` | `companies` + `providers` | Strukturell erstatning |
| Unified `memberships` | 3 membership-tabeller + `profiles.company_id` | Fragmentert modell |
| `platform_admins` | `platform_user_roles` (tom) + `profiles.role` | KONFLIKTERER |
| `org_type` / `app_role` enum | Finnes ikke | MANGLER |
| `membership_status` | `invited\|active\|suspended\|revoked` | DIVERGERER fra spec |
| `agreements` org-scope | `(company_id, location_id)` begge NOT NULL + `provider_id` | DIVERGERER (ikke valgfritt lokasjonssett) |
| `orders` FK | `company_id`, `location_id`, `agreement_id`, `provider_id`; `provider_id` hydreres av trigger | DIVERGERER |
| RLS `active_org_id` claim | 0 policies/functions med `active_org_id`; alle helpers gjør DB-oppslag per request | MANGLER |
| `custom_access_token_hook` | 0 `pg_proc`; repo `config.toml` kommentert ut | MANGLER |

**Migrasjonshistorikk:** `supabase_migrations.schema_migrations` = **28** rader (matcher 28 aktive filer i `supabase/migrations/`). **253** arkiverte migrasjoner i `_archive/` er **ikke** applied-state; live er baseline-squashed (`20260528000000_baseline_prod_schema.sql`). Historisk drift antatt; live katalog er autoritativ.

**Konklusjon:** Migrasjon mot mål er en **strukturell refaktor** (ny identitetslag + claim-basert RLS + avvikling av dual auth/RLS-bridge), ikke inkrementell kolonne-add.

---

## 2. DELTA-tabell (mål §3 vs. live)

| Mål-objekt (spec §3) | Live-tilstand (query-bevis) | Klassifisering | Migrasjons-implikasjon |
|----------------------|----------------------------|----------------|------------------------|
| `organizations(id, type: provider\|customer, …)` | `to_regclass('public.organizations')` → **NULL**. Eksisterer: `companies` (10 rader), `providers` (1 rad). Ingen `type`-kolonne. | **MANGLER** | Opprett `organizations`; backfill `companies`→`customer`, `providers`→`provider`; FK-remapping på alle tenant-tabeller. Destruktiv fase etter cutover. |
| `memberships(user_id, org_id, role, status)` | `to_regclass('public.memberships')` → **NULL**. Eksisterer: `company_memberships` (36), `location_memberships` (34), `provider_memberships` (0). Kolonner: `user_id`, `company_id`/`location_id`/`provider_id`, `role` (enum varierer), `status`/`active`. | **MANGLER** / **KONFLIKTERER** | Konsolider til én tabell; map `membership_role`/`provider_role`/`user_role` → `app_role`. Avvikle 3-tabells modell + `profiles`-scope. |
| `platform_admins(user_id)` atskilt fra tenant-RLS | `to_regclass('public.platform_admins')` → **NULL**. `platform_user_roles`: 0 rader. Superadmin via `profiles.role='superadmin'` (2 brukere). `is_superadmin()` leser `profiles`. | **MANGLER** / **KONFLIKTERER** | Opprett `platform_admins`; migrer superadmin fra `profiles.role`; koble `is_platform_admin()` til ny tabell, ikke `profiles`. |
| Enum `org_type` (`provider\|customer`) | `pg_enum` query på `org_type` → **0 rader**. | **MANGLER** | `CREATE TYPE org_type AS ENUM ('provider','customer')`. |
| Enum `app_role` | `pg_enum` query på `app_role` → **0 rader**. Live har: `user_role`, `membership_role`, `provider_role`, `platform_role` (se §2.1). | **MANGLER** / **KONFLIKTERER** | Ny `app_role`; deprecate/ map fra 4 eksisterende enums. |
| Enum `membership_status` (`pending\|active\|suspended\|terminated`) | Finnes: `invited`, `active`, `suspended`, `revoked` (MCP `pg_enum`). Live data: `active`=33, `invited`=3 i `company_memberships`. | **FINNES_DIVERGERER** | Enum-remap eller ny kolonne + data-migrering (`invited`→`pending`, `revoked`→`terminated`). |
| `agreements` scopet til kunde-org, valgfritt lokasjonssett | Kolonner (MCP `information_schema.columns`): `company_id` NOT NULL, `location_id` NOT NULL, `provider_id` NOT NULL. FK: `agreements_company_id_fkey`→`companies`, `agreements_company_location_fk` composite→`company_locations`, `agreements_provider_id_fkey`→`providers`. Status enum: `PENDING\|ACTIVE\|PAUSED\|CLOSED\|REJECTED`. Counts: ACTIVE=5, PENDING=1. | **FINNES_DIVERGERER** | Erstatt `(company_id, location_id)` med `customer_org_id` + lokasjonssett (junction eller array); `provider_id` blir org-relasjon org↔org. Modellendring, ikke rename. |
| `agreements` PENDING→ACTIVE mekanisme | RPC: `lp_agreement_approve_active`, `lp_agreement_activate` (MCP `pg_get_functiondef`). Trigger: `trg_agreement_lifecycle_hook` → `lp_agreement_lifecycle_hook()` (outbox ved ACTIVE). Ingen auto-PENDING→ACTIVE uten RPC/superadmin. | **FINNES_MATCHER** (mekanisme finnes, scope divergerer) | Behold aktiverings-RPC konseptuelt; rewire til ny org-FK. |
| `orders` eksplisitte FK (ingen implicit hydrate) | Kolonner: `company_id`, `location_id`, `agreement_id`, `provider_id` (alle NOT NULL unntatt `location_id` som er nullable i schema men enforced av triggers). Ingen `customer_org_id`/`provider_org_id`. Trigger `a0_orders_hydrate_core_fields` (MCP `pg_trigger`). | **FINNES_DIVERGERER** | Erstatt trigger-hydrate med NOT NULL FK til `organizations`; fjern `tg_orders_hydrate_core_fields`. |
| `orders.provider_id` trigger | `pg_get_functiondef('tg_orders_hydrate_core_fields')`: setter `new.provider_id := coalesce(v_agreement.provider_id, companies.provider_id)` når NULL. | **FINNES_DIVERGERER** | Fjern hydrate-gren; krev eksplisitt `provider_org_id` ved INSERT. |
| RLS på `active_org_id` JWT-claim | `pg_policies`: 0 rader med `active_org_id` eller `auth.jwt()`. `prosrc ILIKE '%active_org_id%'` → 0 funksjoner. Policies bruker `can_access_company`, `can_admin_company`, `can_kitchen_location`, `private.can_view_order` — alle DB-oppslag på `auth.uid()`. | **MANGLER** | Krever `custom_access_token_hook` + full policy-rewrite. Default-deny på claim. |
| `custom_access_token_hook` | `pg_proc` WHERE `proname ILIKE '%custom_access_token%'` → **0 rader**. Repo: `supabase/config.toml:263-265` kommentert ut. | **MANGLER** | Deploy hook + enable i Auth config. Blocker for claim-RLS. |
| Tenant-RLS atskilt fra platform | Dual path: `private.*` helpers (PUR-basert) + `public.*` bridge (`profiles.role`, `is_superadmin()`). Se §4. | **KONFLIKTERER** | Én autoritativ path; platform via `platform_admins`, tenant via claim. |

### 2.1 Live enum-inventar (relevant)

MCP `pg_enum` 2026-06-07:

| Enum | Verdier |
|------|---------|
| `agreement_status` | PENDING, ACTIVE, PAUSED, CLOSED, REJECTED |
| `order_status` | DRAFT, SUBMITTED, LOCKED, PREPARED, DISPATCHED, DELIVERED, ACTIVE, CANCELLED, PAUSED |
| `membership_status` | invited, active, suspended, revoked |
| `user_role` | employee, company_admin, superadmin, kitchen, driver, provider_admin, provider_kitchen, provider_viewer |
| `membership_role` | employee, location_admin, company_admin, company_finance |
| `provider_role` | provider_admin, provider_kitchen, provider_viewer |
| `platform_role` | platform_admin, platform_ops, kitchen, courier, finance_internal |
| `company_status` | LEAD, PENDING, ACTIVE, PAUSED, CLOSED, TERMINATED |
| `provider_status` | ACTIVE, PAUSED, SUSPENDED, CLOSED |

**Spec-enums som mangler:** `org_type`, `app_role`.

---

## 3. Rolle-kilde i dag + kjokken@/kitchen@-drift

### 3.1 Autoritative kilder (live, prioritert i praksis)

| Lag | Mekanisme | Bevis |
|-----|-----------|-------|
| **Primær (app + mange RLS-bridge policies)** | `profiles.role` (`user_role` enum) + `profiles.company_id` / `profiles.location_id` | `current_profile_role()`: `SELECT p.role FROM profiles WHERE p.id = auth.uid()`. `is_superadmin()`: `profiles.role = 'superadmin'`. |
| **Membership-basert (nyere `private.*` helpers)** | `company_memberships` (`status='active'`) + `location_memberships` (`active=true`) | `private.can_access_company`: oppslag `company_memberships` + `platform_user_roles`. `public.can_admin_company`: memberships **og** `profiles`. |
| **Provider-scope** | `provider_memberships` (0 rader i prod) | `can_access_provider`: `provider_memberships` OR `is_platform_admin()`. |
| **Platform roller (PUR)** | `platform_user_roles` (0 rader) | `private.has_platform_role`: `SELECT FROM platform_user_roles WHERE user_id = auth.uid()`. |
| **Auth metadata** | `auth.users.raw_app_meta_data` | Systembrukere (`kitchen@`, `driver@`): `app_meta_role` = **NULL** (MCP). `raw_user_meta_data.role` satt (`kitchen`, `driver`) — user-editable, **ikke** brukt i DB helpers. |
| **E-post-bundet rolle (app-kode)** | `systemRoleByEmail()` | `lib/system/emailAddresses.ts:7`: canonical `KITCHEN_EMAIL = "kjokken@lunchportalen.no"`. `lib/system/emails.ts:57-63`: matcher **kun** `kjokken@`, ikke `kitchen@`. |

### 3.2 Systembrukere (maskert, MCP 2026-06-07)

| E-post (maskert) | `profiles.role` | `company_id` | `location_id` | `loc_memberships` | `app_meta_role` |
|------------------|-----------------|--------------|---------------|-------------------|-----------------|
| `kit***@lunchportalen.no` | kitchen | satt (Lunchportalen AS) | satt (Hovedkontor) | 1 aktiv | NULL |
| `kit***@test.lunchportalen.no` | kitchen | NULL | NULL | 0 | NULL |
| `dri***@lunchportalen.no` | driver | satt | satt | — | NULL |
| `dri***@test.lunchportalen.no` | driver | NULL | NULL | — | NULL |
| `sup***@lunchportalen.no` | superadmin | satt | NULL | — | NULL |
| `sup***@test.lunchportalen.no` | superadmin | NULL | NULL | — | NULL |

### 3.3 kjokken@ vs kitchen@ — konkret drift

| Påstand | Bevis |
|---------|-------|
| **`kjokken@lunchportalen.no` finnes ikke i prod auth** | MCP: `SELECT COUNT(*) FROM auth.users WHERE email ILIKE 'kjokken@%'` → **0** |
| **`kitchen@lunchportalen.no` finnes og er operativ DB-bruker** | MCP: 1 rad; `profiles.role=kitchen`, aktiv `location_memberships` |
| **App canonical e-post er `kjokken@`** | `lib/system/emailAddresses.ts:7` |
| **`systemRoleByEmail('kitchen@…')` returnerer NULL** | `lib/system/emails.ts:61`: kun `KITCHEN_EMAIL` (`kjokken@`) mappes |
| **DB RLS for kjøkken bruker `profiles.role='kitchen'`**, ikke e-post | `can_kitchen_location`: join `profiles` + `location_memberships`; krever `lower(p.role)='kitchen'` |

**Drift-effekt:** App-layer e-post-gating og DB-layer `profiles.role` er **desynkronisert** for produksjons-kjøkkenbruker (`kitchen@` ≠ canonical `kjokken@`). Kjøkken-RLS fungerer via `profiles` når membership finnes; app `systemRoleByEmail` gir ikke kitchen for `kitchen@`.

**Driver:** Canonical `driver@lunchportalen.no` (`emailAddresses.ts:8`) matcher prod-bruker. Ingen tilsvarende alias-drift observert.

---

## 4. RLS-divergens — policies som må erstattes for claim-basert default-deny

### 4.1 Mønster i live

**Ingen claim-basert RLS.** Alle tenant-policies resolver tilgang via **per-request DB-oppslag** på `auth.uid()`:

- `profiles` (rolle, company_id)
- `company_memberships` / `location_memberships`
- `provider_memberships`
- `platform_user_roles` (tom i prod → fallback til `profiles`/`is_superadmin`)

`auth.jwt()` brukes kun i `jwt_email_lower()` og `private.lp_is_elevated_caller` — **ikke** i tenant RLS policies (MCP: 0 policies med `auth.jwt()`).

RLS enabled på alle tenant-tabeller (MCP `pg_tables.rowsecurity` = true).

### 4.2 Dual-policy / bridge-problem

Flere tabeller har **parallelle** policy-sett (legacy bridge + nyere private helpers):

| Tabell | Policy-antall (utvalg) | Bridge (profiles/is_superadmin) | Private/PUR-basert |
|--------|------------------------|--------------------------------|--------------------|
| `orders` | 6 | `orders_select_bridge_scoped` (`can_admin_company`, `can_kitchen_location`, `profiles`-implicit) | `orders_select` → `private.can_view_order` |
| `agreements` | 6 | `agreements_select_scoped` | `agreements_select_provider_scope` |
| `companies` | 6 | `companies_write_superadmin`, `companies_select_provider_scope` | `companies_select` → `private.can_access_company` |
| `profiles` | 6 | `profiles_select_authenticated_scoped` | `profiles_select` → `private.can_view_profile` |
| `company_memberships` | 4 | `company_memberships_select_self_admin_or_platform` | `company_memberships_select` → `private.can_access_company` |
| `company_locations` | 4 | **Kun** `current_profile_role()` / `current_profile_company_id()` | Ingen private.* variant |

### 4.3 Policies/helpers som må erstattes ved claim-RLS (anbefalt scope)

**Erstatt/remove (tenant default-deny på `active_org_id` + `app_role` claims):**

1. **Hele bridge-laget:** policies som kaller `is_superadmin()`, `current_profile_role()`, `current_profile_company_id()`, `can_admin_company`, `can_kitchen_location` uten claim.
2. **`private.can_view_order` / `private.can_edit_order`:** gjør subquery mot `orders` + membership — erstatt med `orders.customer_org_id = (auth.jwt()->>'active_org_id')::uuid` (+ rolle-claim).
3. **`private.can_access_company` / `public.can_access_company`:** membership-oppslag — erstatt med org-claim.
4. **`can_access_provider`:** `provider_memberships`-oppslag — erstatt med org-claim der org.type=provider.
5. **`company_locations_*` policies:** hardkodet `profiles.role` — full rewrite.
6. **Duplikat SELECT policies** på `orders`, `agreements`, `companies`, `profiles`, `company_memberships` — konsolider til én policy per cmd.

**Behold konseptuelt (med ny kilde):**

- Platform-admin bypass — fra `platform_admins` tabell via hook-claim, **ikke** `profiles.role`.
- Fail-closed default (ingen policy = deny).

### 4.4 Drift-risiko ( dokumentert )

Policies som kaller `can_*` helpers med **nested SELECT per rad** (initplan-problem) + **to autorisasjonsmodeller** (PUR vs profiles) → uforutsigbar effektiv tilgang. Prod har `platform_user_roles` = 0 → `has_platform_role` er alltid false → kitchen/courier platform-tilgang i `private.can_view_order` er **inaktiv**; bridge-policy dekker kitchen via `can_kitchen_location`.

---

## 5. Migrasjons-rekkefølge (anbefaling — ikke migrasjon)

| Fase | Objekter | Type | Avhengigheter |
|------|----------|------|---------------|
| **A1** | `org_type`, `app_role`, ny `membership_status` (eller map) | Additive enum | Ingen |
| **A2** | `organizations` + backfill fra `companies`/`providers` | Additive + data | A1 |
| **A3** | `memberships` unified + backfill fra 3 membership-tabeller | Additive + data | A2 |
| **A4** | `platform_admins` + backfill fra `profiles.role=superadmin` | Additive + data | A2 |
| **A5** | `custom_access_token_hook` (pg function + Auth enable) | Additive | A2–A4 (org/membership/platform claims) |
| **B1** | `agreements`: add `customer_org_id`, `provider_org_id`; lokasjonssett | Additive kolonner | A2 |
| **B2** | `orders`: add org-FK kolonner; parallel write | Additive | B1 |
| **C1** | Ny RLS policies (claim-basert) på tenant-tabeller | Replace policies | A5 |
| **C2** | Fjern bridge policies + deprecate public `can_*` | Destruktiv (policy) | C1 verified |
| **D1** | Fjern `tg_orders_hydrate_core_fields` provider/agreement hydrate | Destruktiv (trigger) | B2 backfill complete |
| **D2** | Drop legacy FK `companies.provider_id`; remap app queries | Destruktiv | B1, C1 |
| **D3** | Drop `company_memberships`, `location_memberships`, `provider_memberships`, `platform_user_roles` | Destruktiv | A3, A4, C1 |
| **D4** | Drop eller archive `companies`/`providers` (post-cutover views) | Destruktiv | Full app cutover |

**Additive først, destruktiv sist.** Ingen DROP før dual-write + claim-RLS verifisert.

---

## 6. Live counts (maskert)

| Entitet | Count | Kilde |
|---------|------:|-------|
| `auth.users` | 39 | MCP |
| `companies` | 10 (ACTIVE=7, PENDING=1, PAUSED=1, CLOSED=1) | MCP |
| `providers` | 1 (Melhus Catering AS, ACTIVE) | MCP |
| `agreements` | 6 (ACTIVE=5, PENDING=1) | MCP |
| `company_memberships` | 36 (active=33, invited=3) | MCP |
| `location_memberships` | 34 | MCP |
| `provider_memberships` | 0 | MCP |
| `platform_user_roles` | 0 | MCP |
| `orders` | 11 (ACTIVE=5, CANCELLED=6) | MCP |
| `profiles` by role | employee=27, company_admin=6, kitchen=2, superadmin=2, driver=2 | MCP |
| `schema_migrations` (prod) | 28 | MCP |

---

## 7. UVERIFISERT-liste

| # | Punkt | Hva mangler for verifisering |
|---|-------|------------------------------|
| U1 | **Supabase Dashboard Auth hook config** | MCP kan lese `pg_proc` (tom), ikke Dashboard «Auth → Hooks» enable-state. Repo `config.toml:263-265` er kommentert ut — indikerer ikke prod Dashboard. |
| U2 | **JWT custom claims i utstedte tokens i dag** | Krever inspisering av faktisk access token (runtime), ikke SQL. Ingen `active_org_id` i DB-funksjoner. |
| U3 | **`kjokken@` fremtidig bruker** | 0 rader i prod; kun kode-kanon (`emailAddresses.ts:7`). Om/intended prod-opprettelse ukjent. |
| U4 | **Full `_archive/` (253 filer) vs live objekt-diff** | Spot-check på nøkkeltabeller gjort; komplett diff ikke kjørt i denne Fase 0. |
| U5 | **`private.lp_is_elevated_caller` JWT-bruk** | Funksjon funnet med `auth.jwt()` i `prosrc`; full def ikke inkludert i DELTA — ikke brukt i listede tenant-policies. |
| U6 | **App `getAuthContext` prioritet profiles vs memberships** | App-kode ikke del av DB Fase 0; DB bevis viser dual kilde. |

---

## 8. Vedlegg — nøkkelobjekt live

### 8.1 Tenant-tabeller — kolonner + FK (utdrag)

**`companies`:** `id`, `name`, `status` (company_status), `provider_id` NOT NULL → `providers.id`, `default_location_id` → `company_locations.id`, + billing/archive kolonner.

**`providers`:** `id`, `name`, `slug`, `status` (provider_status), `org_number`, …

**`company_locations`:** `id`, `company_id` → `companies.id`, `name`, `address`, `status` (text, default ACTIVE).

**`agreements`:** `company_id`, `location_id`, `provider_id` (alle NOT NULL), `status`, prising, lifecycle timestamps (`activated_at`, `approved_at`, …).

**`orders`:** `user_id`, `company_id`, `location_id`, `agreement_id`, `provider_id`, `status` (order_status), …

### 8.2 `tg_orders_hydrate_core_fields` — provider_id-gren (MCP `pg_get_functiondef`)

```sql
if new.provider_id is null then
  new.provider_id := coalesce(
    v_agreement.provider_id,
    (select c.provider_id from public.companies c where c.id = new.company_id limit 1)
  );
end if;
```

Trigger: `a0_orders_hydrate_core_fields` BEFORE INSERT OR UPDATE ON `orders`.

### 8.3 Agreement activation (finnes)

- `lp_agreement_approve_active(p_agreement_id, p_actor_user_id)` — setter `agreements.status=ACTIVE`, `companies.status=ACTIVE`, registration APPROVED.
- `lp_agreement_activate(p_agreement_id)` — superadmin only via `current_profile_role()`; pauser andre ACTIVE på samme location.
- `trg_agreement_lifecycle_hook` — outbox ved ACTIVE/tier change.

---

**STOPP.** Rapport levert. Ingen migrasjon, ingen fiks, ingen PR. Avvent beslutning per DELTA-linje.
