# Performance backlog — etter baseline Rev A

**Dato:** 2026-05-18 · **Status:** planlagt arbeid — ingen migreringer eller indeks-SQL i Rev A-dokumentasjonen.

---

## P1 — kritisk før første ~1000 firma

| # | Issue | Begrunnelse | Neste handling (konseptuelt) |
|---|--------|-------------|------------------------------|
| P1.1 | **`audit_log` seq_scan-dominerende mønster** (ca. 2472 seq_scan vs 4 idx_scan ved snapshot; ~38 MB / ~19k rader sub-skala) | Ved lineær vekst i audit-rader blir rapport-/admin-/superadmin-lesinger dyre uten strategi | Kartlegg **lesemønstre** (hvilke queries/filtre); beslutning: **indeks-retning vs retention/partitionering** vs begge — egen RFC + migrering |
| P1.2 | **Unindexed FK på hot-path-tabeller** (`orders_agreement_scope_fk`, `orders_company_location_pair_fk`) | `orders` er sentral i alle operative baner | Dekning mot FK-kolonner — planlegges som **egen migrering** (ingen SQL i baseline) |
| P1.3 | **Unindexed FK `profiles_company_location_pair_fk`** | Profil + scope på hver autentisert forespørsel | Samme som P1.2 — migrering etter plan-analyse |
| P1.4 | **Unindexed FK `day_choices_location_id_fkey`** | Uke/dag-valg og kjøkken/kansellering | Samme |
| P1.5 | **Unindexed FK `agreements_company_location_fk`** | `/api/week`, avtale-tilknytning | Samme |
| P1.6 | **`auth_rls_initplan` (WARN) på `profiles`, `orders`, `day_choices`, `company_memberships`, `kitchen_batches`, `driver_runs`** | Supabase linter: `auth.*()` evalueres per rad — O(n) overhead ved store resultatsett | RLS-policy-form omskriving per [Supabase-initplan-dok](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) — **egen migrering** |

---

## P2 — før ~5000 firma / bred drift

| # | Issue | Begrunnelse |
|---|--------|-------------|
| P2.1 | Øvrige **unindexed_foreign_keys** (`employee_invites_location_id_fkey`, `location_memberships_*`, `deliveries_*`, `invoice_*`, produkt-meny, osv.) | Varierende frekvens; vurder etter faktisk API-bruk og join-retning |
| P2.2 | **`duplicate_index` på `order_items`** (`idx_order_items_order_id` vs `order_items_order_idx`) | Vedlikehold + planner-støy |
| P2.3 | **`multiple_permissive_policies` (54 WARN)** | Ekstra policy-evaluering per rad; konsolider der det er trygt |
| P2.4 | **`auth_db_connections_absolute` (INFO)** — Auth max 10 connections | Ved skala: vurder prosentbasert allokering (se remediation-lenke i baseline) |
| P2.5 | **`unused_index` (97 INFO)** | Sub-skala + lav trafikk ⇒ «unused» kan være falske positiver; **ikke** masse-drop før staging-profil |

---

## P3 — skala-validering (separate sesjoner / prosjekt)

1. Etabler **staging-Postgres** (Supabase branch eller dedikert prosjekt) speilet mot prod-skjema.
2. **Volum-seed:** X firma × Y ansatte × Z ordre/dag × locations — versjonert script og dokumentert kjøretid.
3. Installer og velg **k6** (eller tilsvarende) for HTTP-last; utvid evt. `enterprise-proof-load.mjs`-tankegang til **autentiserte** kjerne-endepunkter.
4. Valgfritt **pgbench** mot staging for ren DB-gjennomløp der det gir mening.
5. **Rev B:** `EXPLAIN (ANALYZE, BUFFERS)` på staging for representative queries fra `hot-paths.md`.
6. **Sammenlign Rev A vs Rev B** — arkiver snapshots (`pg_stat_statements`, tabellstørrelser, advisors).

---

## Ikke på backlog ennå

- Produksjon **`EXPLAIN ANALYZE`** (eksplisitt utelatt i Rev A).
- Konkrete **`CREATE INDEX`**-utsagn i dokumentasjon — tilhører P1/P2-implementerings-commits.
