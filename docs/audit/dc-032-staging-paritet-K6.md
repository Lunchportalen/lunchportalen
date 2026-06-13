# DC-032 — Staging schema-paritet for K6 LIVE

**Dato:** 2026-05-24  
**Scope:** Read-only discovery (Del 1)  
**Env:** staging `uigxsboqeruxflgzqztl` · prod `hkpokyapzarefrgqzkos`  
**Forløper:** DC-028 bypass OK · k6 goja-fixes lokalt (ikke committet)

---

## Executive summary

| Metrikk | Staging | Prod | Repo |
|---------|---------|------|------|
| `schema_migrations` count | **61** | **97** | **264 filer** |
| Ledger-gap (prod − staging) | — | **36** | — |

**Konklusjon:** K6-relevante **tabellkolonner er identiske** mellom staging og prod. Staging ble bootstrappet via `baseline_schema_dump_from_prod_2026_05_20_v1_REROLLED` + provider/TPT-stack — ikke via prod sin inkrementelle May-7–18-kjede.

**K6-blokkerer ikke primært schema-drift**, men:

1. **App-kode:** `app/api/week/route.ts` spør `profiles.user_id` — kolonnen finnes **ikke** i canonical schema (heller ikke prod). Se `20260325000000_tenant_rls_profiles_id_fix.sql`: `profiles.id = auth.users.id`.
2. **Test-data:** Company A har **0 ACTIVE avtaler** på staging.
3. **Grant-gap:** `company_current_agreement` mangler `GRANT SELECT TO authenticated` på staging (finnes på prod).

**Anbefaling Del 2:** Ikke apply 47 prod-only migrasjoner blindt. Målrettet: grant + seed avtale + **app-fix** (`.eq("id", user.id)` eller `loadProfileByUserId`).

---

## 1.1 Migration-ledger

```
staging = 61
prod    = 97
repo    = 264
gap     = 36  (prod − staging, forventet ~36 ✓)
```

Staging starter med baseline-dump; prod har 36 inkrementelle migrasjoner (May 7–18 + naming-drift) som **ikke** er i staging-ledger, men hvis schema allerede er absorbert i baseline → **ledger-gap ≠ schema-gap**.

---

## 1.2 Profiles — kolonner (kjent K6-blokker)

| Kolonne | Staging | Prod |
|---------|---------|------|
| `id` | ✓ | ✓ |
| `email` … `deleted_at` (20 kolonner totalt) | ✓ | ✓ |
| **`user_id`** | **✗** | **✗** |

**Diff:** ingen. Begge env bruker canonical `profiles.id = auth.uid()`.

**Root cause K6 `/api/week` 500:** kode bruker `.eq("user_id", user.id)` → PostgREST-feil → `PROFILE_LOOKUP_FAILED`.  
**Fix (Del 2):** app-kode, **ikke** `ALTER TABLE ADD user_id`.

Referanse: `lib/db/profileLookup.ts` prøver `id` først, deretter `user_id` fallback.

---

## 1.3 K6-relevante tabeller — kolonne-diff

| Tabell | Kolonner kun i prod | Kolonner kun i staging | Notat |
|--------|---------------------|------------------------|-------|
| `profiles` | — | — | Identisk (20 kolonner) |
| `company_memberships` | — | — | Identisk (14 kolonner) |
| `orders` | — | — | Identisk (37 kolonner) |
| `agreements` | — | — | Identisk (35 kolonner) |
| `agreement_delivery_days` | — | — | Identisk (4 kolonner) |
| `day_choices` | — | — | Identisk (12 kolonner) |
| `menus` | — | — | **Finnes ikke** i public (begge env) |
| `menu_days` | — | — | **Finnes ikke** i public (begge env) |

**Views/objekter verifisert på begge:** `company_current_agreement` (VIEW), `kitchen_batches` (TABLE).

---

## 1.4 Missing migrations i staging (prod \ staging)

**47 migrasjonsnavn** finnes i prod-ledger men ikke staging-ledger (normalisert diff).

### Prod-only (full liste)

| # | Migration name |
|---|----------------|
| 1 | `add_rls_missing_tables` |
| 2 | `add_system_settings_autopilot_enabled` |
| 3 | `normalize_status_enums_uppercase_v6_constraints` |
| 4 | `create_kitchen_batches` |
| 5 | `create_day_choices` |
| 6 | `add_kitchen_batch_day_choices_rls_policies` |
| 7 | `add_day_choices_date_company_user_index` |
| 8 | `create_company_current_agreement_view` |
| 9 | `add_agreements_start_date` |
| 10 | `create_invite_tables` |
| 11 | `add_companies_default_location_id` |
| 12 | `add_rejected_agreement_status` |
| 13 | `create_company_registrations` |
| 14 | `extend_agreements_review_fields` |
| 15 | `extend_company_invites_for_company_admin` |
| 16 | `replace_lp_company_register_pending_agreement` |
| 17 | `company_registration_approval_flow` |
| 18 | `add_missing_fk_indexes` |
| 19 | `tier_per_day_v2` |
| 20 | **`grant_authenticated_company_current_agreement`** |
| 21 | `20260514181500_day_choices_item_columns` |
| 22 | `consolidate_locations_to_company_locations` |
| 23 | `test_ping_migration_sql` |
| 24 | `close_20260204_drift` |
| 25 | `recompute_respects_status` |
| 26 | `sync_memberships_with_status` |
| 27 | `grant_authenticated_private_rls_helpers` |
| 28 | `fix_sync_memberships_on_conflict_columns` |
| 29–36 | `p1_ix_*` (8 index-migrasjoner) |
| 37–40 | `b2b1` … `b2c_auto_partition_cron` |
| 41–42 | `provider_match_postal_code`, `patch13_provider_registration_rpc_approve` |
| 43–45 | `tpt_b6_webhook_paid_status_*`, `20260603120000_tpt_b7_foundation` (naming-drift) |

### Staging-only (10)

Baseline + staging-spesifikke provider/TPT-varianter (`tpt_b6_webhook_rpcs_part2`, `k4_idem_complete_fail_ledger`, m.fl.).

### Repo kryssjekk

- **264** SQL-filer i `supabase/migrations/`.
- Ledger i DB dekker kun **61/97** av prod/staging historikk — resten er eldre/ ikke applyet til disse env.
- Objekter fra prod-only migrasjoner (f.eks. `day_choices`, `kitchen_batches`, `company_current_agreement`) **finnes allerede** på staging via baseline.

---

## 1.5 Minimum set — K6-paths

| Migration / tiltak | Berører K6-paths? | Risiko | Anbefalt Del 2? | Begrunnelse |
|--------------------|-------------------|--------|-----------------|-------------|
| **`grant_authenticated_company_current_agreement`** | Ja (avtale-read) | **LAV** | **JA** | Staging mangler `authenticated` SELECT på view; prod har det |
| **`app/api/week/route.ts` → `.eq("id", user.id)`** | Ja (week browse) | **LAV** | **JA (kode)** | Ikke migration; fikser PROFILE_LOOKUP_FAILED |
| **Seed ACTIVE avtale Company A** | Ja (orders/week) | **LAV** | **JA (data)** | 0 ACTIVE avtaler i staging nå |
| **`grant_authenticated_private_rls_helpers`** | Delvis (RLS helpers) | LAV | Verifiser først | Triggers identiske; apply kun hvis helper-grants mangler |
| **`sync_memberships_with_status`** + fix | Delvis (profil sync) | LAV | **NEI** | `trg_profiles_sync_memberships` finnes allerede på staging |
| **`tier_per_day_v2`** | Ja (order tier) | MED | **NEI** | Schema allerede tilstede via baseline |
| **`create_day_choices`** / kitchen RLS | Ja (kitchen path) | MED | **NEI** | Tabeller finnes; kitchen 403 er rolle-gating (employee) |
| **`p1_ix_*` index-migrasjoner** | Indirekte (perf) | LAV | **NEI** for K6 smoke | Perf, ikke funksjonell paritet |
| **`b2b*` / `b2c*` / CMS / AI** | Nei | — | **NEI** | Utenfor K6 smoke/baseline |
| **`profiles.user_id` ADD COLUMN** | — | **HØY** | **NEI** | Bryter canonical schema; prod har heller ikke kolonnen |

### Smoke-user status (staging SQL)

| Check | Resultat |
|-------|----------|
| `profiles` for `smoke-test@lunchportalen.no` | ✓ rad finnes, `company_id=8b0b8fa4-…`, `is_active=true` |
| ACTIVE `agreements` for Company A | **✗ 0 rader** |
| `profiles.user_id` column | **✗ finnes ikke** (forventet canonical) |

---

## Anbefalt Del 2-plan (venter GO)

1. **Apply idempotent grant** fra `20260513090038_grant_authenticated_company_current_agreement.sql`
2. **Fix app-kode** `week/route.ts` (og evt. andre direkte `user_id`-queries uten fallback)
3. **Seed** ACTIVE BASIS-avtale + `agreement_delivery_days` (man–fre) for Company A
4. **Ikke** bulk-apply 47 prod-only migrasjoner (høy duplikat-/konfliktrisiko mot baseline)

---

## STOP-PUNKT 1 — Go/No-go

**Schema-gap for K6-kolonner: NOOP** (paritet OK).  
**Ledger-gap: 36** — forventet, absorbert i baseline.  
**Faktisk gap for K6:** grant + test-data + app-kodefix.

→ Skriv **`GO Del 2`** for å fortsette, eller **`STOPP`** for å avbryte.

---

## Del 4.5 — Security delta (orders/today GET)

**Commit:** `b708e545` · **Route:** `app/api/orders/today/route.ts` (GET/POST)

### Endring

Fjernet `requireCompanyScopeOr403` fra GET/POST. Den blokkerte **employee**-rolle (kun company_admin passerte).

Erstattet med samme mønster som `/api/orders/set`:

| Kontroll | Implementasjon |
|----------|----------------|
| Auth | `scopeOr401` |
| Rolle | `requireRoleOr403(..., ["employee", "company_admin"])` |
| Tenant | Inline `user_id` + `company_id` + `location_id` fra session scope |
| DB-filter | `.eq("user_id")` · `.eq("company_id")` · `.eq("location_id")` — ingen client `company_id` |
| Fail-closed | Mangler scope/location → 409 (`SCOPE_MISSING` / `LOCATION_MISSING`) |
| Cross-tenant | Client kan ikke overstyre company; query alltid session-bundet |

### Test-dekning

`tests/api/orders-get-scope.test.ts` — **5/5 PASS** (2026-05-24):

- employee Company A → 200, query scoped til session tenant
- employee kan ikke lese Company B (server-side filter, ikke client param)
- company_admin Company A → 200 med egen tenant
- ulovlig rolle (driver) → 403, ingen DB-kall
- manglende location_id → 409 fail-closed

### Rationale

K6 smoke/baseline bruker **employee**-brukere. `requireCompanyScopeOr403` ga 403 på GET `/api/orders` og blokkerte realistisk last. Inline scope + DB-filter gir samme tenant-isolasjon som `set`-ruten uten å åpne cross-company lesing.

---
