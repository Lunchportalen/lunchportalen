# Lunchportalen — Supabase branch state

**Sist verifisert:** 2026-05-20 (B3a-PERSISTENT-FIX + B3a-REROLL; Supabase MCP + CLI + `psql`)  
**Prod-prosjekt:** `hkpokyapzarefrgqzkos` (Lunchportalen, Pro, `eu-west-1`, Postgres 17)  
**Org:** `wbnttmwfysreonhxgans`

---

## Branch-state

| Branch | Branch ID | `project_ref` | `preview_project_status` | Branch `status` | `persistent` | `with_data` | Merknad |
|--------|-----------|---------------|--------------------------|-----------------|--------------|-------------|---------|
| **main** (prod) | `b548ca65-55ff-489f-8cc5-ef520d205912` | `hkpokyapzarefrgqzkos` | `ACTIVE_HEALTHY` | `FUNCTIONS_DEPLOYED` | `false` | `false` | **42** ledger-rader (orphan `20260222233084` fjernet P3.M4.O) |
| **staging** | `cf127506-e3d5-4ac5-9903-a7b57563bfaf` | **`uigxsboqeruxflgzqztl`** | `ACTIVE_HEALTHY` | `MIGRATIONS_FAILED` *(platform ledger; ignorert)* | **`true`** | `false` | **B3a-REROLL** + **B3a-PERSISTENT-FIX** (2026-05-20) |
| **staging-abc-signoff** (arkiv) | `b426d8b0-6286-4a2b-850a-deb7c2ef6676` | `iyrytpjacujscveivtfb` | `INACTIVE` | `FUNCTIONS_DEPLOYED` | `false` | `false` | **Uberørt** |

---

## P3.M4.S — Schema-dump bypass (2026-05-20)

| Steg | Resultat |
|------|----------|
| Orphan-fix (P3.M4.O) | Prod ledger **43 → 42**; orphan `20260222233084` slettet |
| Ledger-replay på branch | Fortsatt **FAIL** på `add_rls_missing_tables` (forventet) |
| Schema-sync | **`pg_dump --schema-only`** (`public` + `private`) → `psql` på staging (URL via `supabase branches get`, ikke committet) |
| Baseline ledger (staging) | **`20260520000001`** — `baseline_schema_dump_from_prod_2026_05_20_v1_REROLLED` (etter B3a-REROLL; forrige branch `20260520000000` på slettet ref) |
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

## B3a-REROLL — Credential rotation (2026-05-20)

| Steg | Resultat |
|------|----------|
| Incident | `SUPABASE_SERVICE_ROLE_KEY` (+ sannsynlig anon) for `pbwivijolkoemcvgecoj` logget i chat under B3e |
| Slett kompromittert branch | `986ce7e0-e0b9-47e8-8292-df6feb4ef0f7` — **slettet**; credentials ugyldige |
| Ny branch | `cf127506-e3d5-4ac5-9903-a7b57563bfaf` → `uigxsboqeruxflgzqztl` |
| Schema re-apply | Samme `staging-schema-dump-2026-05-20.sql` via `p3m4s-apply-staging-dump.mjs` — **PASS** |
| Extract | `scripts/audit/staging-env-actual-2026-05-20.env` oppdatert (gitignored; `b3a-reroll-write-extract-creds.mjs`) |
| Smoke | 119 tabeller, 190 policies, 20 private funcs, Variant C **0** rader |

---

## B3a-PERSISTENT-FIX (2026-05-20)

| Felt | Verdi |
|------|-------|
| Før | `persistent: false` |
| Etter | `persistent: true` |
| Metode | `npx supabase branches update cf127506-e3d5-4ac5-9903-a7b57563bfaf --project-ref hkpokyapzarefrgqzkos --persistent --yes` |
| MCP | Ingen `update_branch`; `list_branches` brukt til verifisering |

---

## Åpne oppgaver

| ID | Beskrivelse |
|----|-------------|
| **P3.M5** | Ledger reconcile (~182 repo-filer uten prod-ledger-rad) — hygiene, blokkerer ikke staging |
| **B3b–B3f** | Vercel env, seed, B4 — se [b3-decision-framework.md](b3-decision-framework.md) |
