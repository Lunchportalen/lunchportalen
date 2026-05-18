# Lunchportalen — Supabase branch state

**Sist verifisert:** 2026-05-19 (B3a, Supabase MCP read/write)  
**Prod-prosjekt:** `hkpokyapzarefrgqzkos` (Lunchportalen, Pro, `eu-west-1`, Postgres 17)  
**Org:** `wbnttmwfysreonhxgans`

---

## Branch-state

| Branch | Branch ID | `project_ref` | `preview_project_status` | Branch `status` | `persistent` | `with_data` | Merknad |
|--------|-----------|---------------|--------------------------|-----------------|--------------|-------------|---------|
| **main** (prod) | `b548ca65-55ff-489f-8cc5-ef520d205912` | `hkpokyapzarefrgqzkos` | `ACTIVE_HEALTHY` | `FUNCTIONS_DEPLOYED` | `false` | `false` | Uendret; baseline prod |
| **staging** (ny, B3a) | `26377989-406a-4e90-bcce-91fcf5f2b35d` | **`crsvtxhfhjicyoycgvcd`** | `ACTIVE_HEALTHY` | `FUNCTIONS_DEPLOYED` *(etter `reset_branch`; var `MIGRATIONS_FAILED` ved create)* | **`false`** | `false` | Opprettet MCP `create_branch` 2026-05-19. **Schema sync BLOCKED** — se [B3a migrasjons-blokker](#b3a-migrasjons-blokker-2026-05-19). **B3a-PERSISTENT-FIX:** ingen MCP `update_branch`; vurder Dashboard «persistent branch». |
| **staging-abc-signoff** (arkiv) | `b426d8b0-6286-4a2b-850a-deb7c2ef6676` | `iyrytpjacujscveivtfb` | `INACTIVE` | `FUNCTIONS_DEPLOYED` | `false` | `false` | **Uberørt** i B3a (id/ref/status uendret vs pre-create audit) |

---

## B3a opprettelse (2026-05-19)

| Steg | Resultat |
|------|----------|
| `get_cost` (branch) | `$0.01344`/time (~kr 90/mnd) |
| `create_branch` (`name: staging`) | `project_ref` **`crsvtxhfhjicyoycgvcd`**, initial `status: CREATING_PROJECT` → **`MIGRATIONS_FAILED`** |
| `reset_branch` | `success`; kortvarig `FUNCTIONS_DEPLOYED`, men schema fortsatt tom |
| `rebase_branch` | `success`; tilbake til **`MIGRATIONS_FAILED`** |
| `reset_branch` (`migration_version: 20260518152838`) | `success`; `FUNCTIONS_DEPLOYED`, men fortsatt kun én migrasjon på branch |

**Kost:** ~$0.01344/time per aktiv branch-compute (innenfor cap kr 800).

---

## B3a migrasjons-blokker (2026-05-19)

| Sjekk | Prod (`hkpokyapzarefrgqzkos`) | Staging (`crsvtxhfhjicyoycgvcd`) |
|-------|-------------------------------|----------------------------------|
| `list_migrations` (MCP) | **44** registrerte versjoner (siste: `20260518152838`) | **1** versjon: `20260222233084` (tomt `name`, **finnes ikke** i `supabase/migrations/`) |
| `list_tables` `public` | Full schema (f.eks. `orders`, `profiles`, `companies` med prod-rader) | **`[]`** — ingen tabeller |
| `execute_sql` `count(*)` orders/profiles/companies | N/A (prod har data) | **`42P01`** — relasjoner finnes ikke |

**Tolkning:** Branch-provisjon lyktes; **migrasjonskjede fra platform er fastlåst på orphan `20260222233084`**. Repo har **220** `.sql`-filer under `supabase/migrations/` (ekskl. `rollbacks/`); remote historikk ≠ filteller.

**Variant C data:** Ingen prod-rader på staging (tom DB) — **ingen GDPR-lekkasje observert**, men **schema mangler** → B3f/B4 **blokkert** til **B3a-MIGRATIONS-FIX**.

**Anbefalt oppfølging (HUMAN):** Supabase Dashboard → Branching / Migrations for `staging` — reparer eller fjern orphan `20260222233084`, deretter `reset_branch` eller re-run migrations; evt. support hvis platform-drift.

---

## Smoke-referanse (B3a)

| Test | Resultat |
|------|----------|
| 3 branches i `list_branches` | **PASS** |
| `staging-abc-signoff` uendret | **PASS** (`b426d8b0-…`, `INACTIVE`) |
| Prod `ACTIVE_HEALTHY` | **PASS** |
| Staging schema synced | **FAIL** |
| Staging data tom (variant C) | **PASS** (ingen tabeller / ingen rader) |
| `get_project` på staging ref | MCP `Project not found` (preview-grense; bruk `list_branches` + `execute_sql`/`list_tables`) |

---

## Åpne oppgaver (fra B3a)

| ID | Beskrivelse |
|----|-------------|
| **B3a-MIGRATIONS-FIX** | Få full migrasjonssync på `crsvtxhfhjicyoycgvcd` (fjern/reparer orphan `20260222233084`) |
| **B3a-PERSISTENT-FIX** | Verifiser/sett `persistent: true` på `staging` via Dashboard (MCP har ikke `update_branch`) |
