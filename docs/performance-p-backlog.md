# Performance backlog — etter baseline Rev A

**Dato:** 2026-05-18 · **Status:** planlagt arbeid — ingen migreringer eller indeks-SQL i Rev A-dokumentasjonen.

**`audit_log` (skala-kritisk Rev A):** full strategi — [docs/audit-log-strategy.md](audit-log-strategy.md) · basert på baseline [docs/performance-baseline-rev-a.md](performance-baseline-rev-a.md).

---

## P1 — **før første ~1000 firma** (skala-kritisk: `audit_log`)

| # | Issue | Begrunnelse | Neste handling |
|---|--------|-------------|----------------|
| P1.1 | **`audit_log` B2b-1 — skip `updated_at`-only updates** | Reduserer støy-Volum og WAL uten revisjonstab | Egen migrasjon / commit · mål før/etter (`n_tup_ins`, payload) |
| P1.2 | **`audit_log` B2b-2 — GDPR art. 9 helsedata-eksklusjon** | `order_items.allergens_snapshot`, `dietary_tags_snapshot` (etc.) må ** ikke** kopieres til `audit_log` uten art. 6+9 vedtak | Trigger-narrow · DPO ved behov før avvik fra eksklusjon |
| P1.3 | **`audit_log` B2c — RANGE-partition på `created_at`** (typisk månedlig) | Migrering smertefull ved GB+/TB; gjør mens tabellen er liten (**~38 MB** i baseline) | Egen IMPLEMENT-commit · test på clone/branch · runbook swap |
| P1.4 | **`audit_log` B2d — retensjon (DPO-vedtak) + drop-partition-cron** | Uten TTL er `audit_log` primær lagrings/WAL-/backup-driver ved skala | **DPO/jurist før prod** · `DETACH`/`DROP` partition · ingen masse-`DELETE` i prod som default |

### P1 — øvrige (kritisk før ~1000 firma)

| # | Issue | Begrunnelse | Neste handling (konseptuelt) |
|---|--------|-------------|------------------------------|
| P1.5 | **Unindexed FK på hot-path-tabeller** (`orders_agreement_scope_fk`, `orders_company_location_pair_fk`) | `orders` er sentral i alle operative baner | Dekning mot FK-kolonner — planlegges som **egen migrering** (ingen SQL i baseline) |
| P1.6 | **Unindexed FK `profiles_company_location_pair_fk`** | Profil + scope på hver autentisert forespørsel | Samme som P1.5 — migrering etter plan-analyse |
| P1.7 | **Unindexed FK `day_choices_location_id_fkey`** | Uke/dag-valg og kjøkken/kansellering | Samme |
| P1.8 | **Unindexed FK `agreements_company_location_fk`** | `/api/week`, avtale-tilknytning | Samme |
| P1.9 | **`auth_rls_initplan` (WARN) på `profiles`, `orders`, `day_choices`, `company_memberships`, `kitchen_batches`, `driver_runs`** | Supabase linter: `auth.*()` evalueres per rad — O(n) overhead ved store resultatsett | RLS-policy-form omskriving per [Supabase-initplan-dok](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) — **egen migrering** |

> **NB:** Tidligere rad «P1.1 seq_scan på `audit_log`» er **erstattet** av P1.1–P1.4 over — rotårsaken er trigger-volum og full JSONB, ikke primært rapport-queries.

---

## P2 — **før ~5000 firma** / bred drift

| # | Issue | Begrunnelse |
|---|--------|-------------|
| P2.A1 | **`audit_log` B2a — indekser på partitioned children** | Dekker faktiske lesemønstre etter B2c; unngår dobbelt vedlikehold på gammelt heap |
| P2.A2 | **`audit_log` B2b-3 — per-tabell allowlist** (narrow non-PII) | GDPR-minimering + mindre payload |
| P2.A3 | **`audit_log` B2b-4 — PII-hashing** (hvis kreves) | Sporbarhet uten klartekst — etter DPO/jurist |
| P2.1 | Øvrige **unindexed_foreign_keys** (`employee_invites_location_id_fkey`, `location_memberships_*`, `deliveries_*`, `invoice_*`, produkt-meny, osv.) | Varierende frekvens; vurder etter faktisk API-bruk og join-retning |
| P2.2 | **`duplicate_index` på `order_items`** (`idx_order_items_order_id` vs `order_items_order_idx`) | Vedlikehold + planner-støy |
| P2.3 | **`multiple_permissive_policies` (54 WARN)** | Ekstra policy-evaluering per rad; konsolider der det er trygt |
| P2.4 | **`auth_db_connections_absolute` (INFO)** — Auth max 10 connections | Ved skala: vurder prosentbasert allokering (se remediation-lenke i baseline) |
| P2.5 | **`unused_index` (97 INFO)** | Sub-skala + lav trafikk ⇒ «unused» kan være falske positiver; **ikke** masse-drop før staging-profil |

---

## P3 — hygiene / **ikke primær skala-blokker**

| # | Issue | Begrunnelse |
|---|--------|-------------|
| P3.H1 | **DONE** — B2-prelude (mai 2026): fjernet døde `listCompanyAudit` / `listAuditGlobal` og tilhørende typer i `lib/superadmin/queries.ts`. | Oppfylt · ingen backlog-handling |
| P3.H2 | **DONE** — B2-prelude (mai 2026): fjernet `audit_log`-fallback i `POST /api/superadmin/audit-write`; skriver kun til `audit_events`. | Oppfylt · ingen backlog-handling |
| P3.V1–V6 | **Skala-validering** (se liste under) | Egen økt / prosjekt |

### P3 — skala-validering (separate sesjoner / prosjekt)

1. Etabler **staging-Postgres** (Supabase branch eller dedikert prosjekt) speilet mot prod-skjema.
2. **Volum-seed:** X firma × Y ansatte × Z ordre/dag × locations — versjonert script og dokumentert kjøretid.
3. Installer og velg **k6** (eller tilsvarende) for HTTP-last; utvid evt. `enterprise-proof-load.mjs`-tankegang til **autentiserte** kjerne-endepunkter.
4. Valgfritt **pgbench** mot staging for ren DB-gjennomløp der det gir mening.
5. **Rev B:** `EXPLAIN (ANALYZE, BUFFERS)` på staging for representative queries fra `hot-paths.md`.
6. **Sammenlign Rev A vs Rev B** — arkiver snapshots (`pg_stat_statements`, tabellstørrelser, advisors).

---

## Ikke på backlog ennå

- Produksjon **`EXPLAIN ANALYZE`** (eksplisitt utelatt i Rev A).
- Konkrete **`CREATE INDEX`**-utsagn i dokumentasjon — tilhører P1/P2-implementerings-commits (unntatt der B2a beskriver mål kolonner på høyt nivå i strategidok).
