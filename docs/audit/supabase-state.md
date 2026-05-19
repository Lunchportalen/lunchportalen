# Lunchportalen — Supabase branch state

**Sist verifisert:** 2026-05-20 (P3.M4.S schema-dump bypass, Supabase MCP + `psql`)  
**Prod-prosjekt:** `hkpokyapzarefrgqzkos` (Lunchportalen, Pro, `eu-west-1`, Postgres 17)  
**Org:** `wbnttmwfysreonhxgans`

---

## Branch-state

| Branch | Branch ID | `project_ref` | `preview_project_status` | Branch `status` | `persistent` | `with_data` | Merknad |
|--------|-----------|---------------|--------------------------|-----------------|--------------|-------------|---------|
| **main** (prod) | `b548ca65-55ff-489f-8cc5-ef520d205912` | `hkpokyapzarefrgqzkos` | `ACTIVE_HEALTHY` | `FUNCTIONS_DEPLOYED` | `false` | `false` | **42** ledger-rader (orphan `20260222233084` fjernet P3.M4.O) |
| **staging** | `986ce7e0-e0b9-47e8-8292-df6feb4ef0f7` | **`pbwivijolkoemcvgecoj`** | `ACTIVE_HEALTHY` | `MIGRATIONS_FAILED` *(platform ledger; ignorert)* | `false` | `false` | **Schema synket via P3.M4.S dump** — ikke ledger-replay |
| **staging-abc-signoff** (arkiv) | `b426d8b0-6286-4a2b-850a-deb7c2ef6676` | `iyrytpjacujscveivtfb` | `INACTIVE` | `FUNCTIONS_DEPLOYED` | `false` | `false` | **Uberørt** |

---

## P3.M4.S — Schema-dump bypass (2026-05-20)

| Steg | Resultat |
|------|----------|
| Orphan-fix (P3.M4.O) | Prod ledger **43 → 42**; orphan `20260222233084` slettet |
| Ledger-replay på branch | Fortsatt **FAIL** på `add_rls_missing_tables` (forventet) |
| Schema-sync | **`pg_dump --schema-only`** (`public` + `private`) → `psql` på staging (URL via `supabase branches get`, ikke committet) |
| Baseline ledger (staging) | **`20260520000000`** — `baseline_schema_dump_from_prod_2026_05_20_v0` |
| Variant C | **0 rader** i `orders`, `profiles`, `companies`, `menu_service_days` |

**Artefakter:** [prod-ledger-backup-2026-05-20.json](prod-ledger-backup-2026-05-20.json) · [staging-schema-dump-2026-05-20.sql](staging-schema-dump-2026-05-20.sql) · apply-script: `scripts/audit/p3m4s-apply-staging-dump.mjs`

---

## Schema-paritet (prod vs staging, 2026-05-20)

| Måling | Prod | Staging |
|--------|------|---------|
| `public` tabeller | **119** | **119** |
| RLS policies (`public`) | **190** | **190** |
| `private` funksjoner | **20** | **20** |
| `public` `pg_proc` (prokind `f`) | 338 | 150 *(pg_catalog-telling; kjerne-RPC-er verifisert)* |
| `agreement_cleanup_audit` | finnes | finnes |
| `orders` kolonner | 34 | 34 |

**Merk:** Branch UI viser fortsatt `MIGRATIONS_FAILED` — det er **platform ledger-replay**, ikke faktisk schema-tilstand etter dump.

---

## Smoke-referanse (P3.M4.S)

| Test | Resultat |
|------|----------|
| Prod `ACTIVE_HEALTHY` under operasjon | **PASS** |
| Staging `preview_project_status` | **ACTIVE_HEALTHY** |
| Tabeller/policies match | **PASS** |
| Variant C (ingen prod-data) | **PASS** |
| `list_migrations` staging | **1** (baseline only) |

---

## Åpne oppgaver

| ID | Beskrivelse |
|----|-------------|
| **B3a-PERSISTENT-FIX** | Sett `persistent: true` på `staging` via Dashboard (MCP har ikke `update_branch`) |
| **P3.M5** | Ledger reconcile (~182 repo-filer uten prod-ledger-rad) — hygiene, blokkerer ikke staging |
| **B3b–B3f** | Vercel env, seed, B4 — se [b3-decision-framework.md](b3-decision-framework.md) |
