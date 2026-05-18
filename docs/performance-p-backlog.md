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
| P3.V1–V6 | **Skala-validering** | Erstattet av detaljplan under **Infrastruktur / Skala-validering** + [docs/staging-strategy.md](staging-strategy.md) |

### Infrastruktur / Skala-validering (FASE B – grunnmur)

**Strategidokumenter (Rev A):** [docs/staging-strategy.md](staging-strategy.md) (staging/GDPR/budget), [docs/volume-seed-strategy.md](volume-seed-strategy.md) (B4 volum-seed, audit-spike/teardown-gates, bulk-modell). Under: GDPR variant C (syntetisk data), én persistert Supabase `staging`‑branch, Vercel strategi A, Sanity `staging`‑datasett på `4udoq5d8`, domene `staging.app.lunchportalen.no`, budget‑cap forslag **kr 800/mnd**, fullt env‑inventar i [docs/environments.json](environments.json).

| **B3 (staging provisioning)** | **DECIDED** — klar for B3a–B3f implementering. Beslutninger 2026-05-19: DNS **Domeneshop** · Supabase **Pro** · cap **kr 800/mnd** · `staging-abc-signoff` **PAUSED** (behold arkiv), ny branch **`staging`**. **B3c COMPLETED 2026-05-19** (UI-opprettet `staging` på `4udoq5d8`; `SANITY_WRITE_TOKEN` editor mangler `datasets/create` — dokumentert for B3e) | [docs/audit/b3-decision-framework.md](audit/b3-decision-framework.md) — status + implementeringsplan (HUMAN/AUTOMATABLE, ~4–8 t) |

| Oppgave | Innhold |
|---------|---------|
| **B3a** | Supabase staging‑branch: aktiver/obruk `staging`, migrasjonssync‑flyt, budget alerts |
| **B3b** | Vercel `staging` git‑branch + env mapping; forhindre cron mot prod‑URL ved feilkonfig |
| **B3c** | ~~Sanity `staging` datasett~~ **COMPLETED 2026-05-19** — dataset `staging` (private) på `4udoq5d8`; egne write‑token og webhook‑secret → **B3e** |
| **B3d** | DNS CNAME til Vercel for `staging.app.lunchportalen.no` |
| **B3e** | Full env-dokumentasjon (JSON Rev A i repo — utvid ved behov per tjeneste) |
| **B3f** | `scripts/seed-staging.ts` — syntetisk volum (uten art. 9), idempotent — foundation til B4 skala‑seed |
| **B4a** | Faker-/data‑modeller og generatorer deterministiske etter `--seed`; art. 9‑null i snapshots; **`employee_order_items` dokumentert som VIEW på prod** (speiler `order_items`); seed skriver til **`order_items`**. Verifiser `relkind`/def på mål-branch; jf. [docs/volume-seed-strategy.md](volume-seed-strategy.md). |
| **B4b** | Bulk‑insert/COPY‑pipeline med batch‑ og parallelismekontroll, målinger mot staging |
| **B4c** | Verifiserings‑scripts: radteller, FK‑integritet, distribusjon, audit‑ før/etter der strategi bruker post‑seed truncate |
| **B4d** | CLI: `npm run seed:volume -- --size … --target-db … --dry-run --confirm=staging+<project_ref>` og hard gate mot feil prosjekt |

**Skala‑validering etter staging står:**

1. **Volum-seed:** B4 oppgraderer B3f til dokumentert firmavolum og kjøretid (strategi: [volume-seed-strategy.md](volume-seed-strategy.md)).
2. **k6 / HTTP-last (B5):** representative autentiserte kjernebane-endepunkter.
3. Valgfritt **pgbench** mot staging der isolert DB‑gjennomløp trengs.
4. **Rev B:** `EXPLAIN (ANALYZE, BUFFERS)` på staging for representative queries fra `hot-paths.md`.
5. **Sammenlign Rev A vs Rev B** — arkiver snapshots (`pg_stat_statements`, tabellstørrelser, advisors).

### P3 — hygiene avdekket av B3-audit (ikke løst i Rev A docs)

| # | Issue | Neste handling |
|---|--------|----------------|
| P3.H3 | **REVERTED (P3.H3-REVERSE 2026-05-19)** — e3745326 antok feilaktig at `4udoq5d8` var legacy; P3.H3-RESOLVE bekreftet live CMS + Vercel env på **`4udoq5d8`**. Repo/Studio/CI tilbake til **`4udoq5d8`**; CI-guard blokkerer regressjon til tomme **`f3vuhd2f`**. Skrive-/leseskript: env-only via `scripts/sanity/sanityProjectEnv.ts`. *(Historikk: P3.H3 hadde merket RESOLVED med feil canonical `f3vuhd2f`.)* | REVERTED — se P3.H3-REVERSE commit · [scripts/ci-guard.mjs](../scripts/ci-guard.mjs) `SANITY_PROJECT_ID_REGRESSION` · `studio/sanity.cli.ts` |
| P3.H4 | **RESOLVED (DOCUMENTED)** — **`supabase/seed.sql`**: placeholder på plass (kun SQL‑kommentarer, ingen DML) slik at **`[db.seed]`** i `supabase/config.toml` matcher repo; faktisk seed‑logikk leveres i **B3f** / **B4**. | RESOLVED — [supabase/seed.sql](../supabase/seed.sql) (placeholder per denne commit; implementering i B3f/B4) |
| P3.H5 | **RESOLVED** — Full repo‑audit forblir i [`docs/environments.json`](environments.json) (**335** nøkler); **deploy-/runtime‑matrise** (konsumentliste uten toolchain‑støy) i [`docs/environments-runtime.json`](environments-runtime.json) (**262** nøkler per Rev A‑filtre). Bruk **`environments-runtime.json`** som utgangspunkt for Vercel/staging‑mapping; ved tvil kryssjekk full audit. | RESOLVED — [`docs/environments-runtime.json`](environments-runtime.json) |

### P3 — discovery fra volum‑seed/forarbeid (mai 2026)

Disse punktene kommer fra read‑only kartlegging foran B4‑implementering og skal lukkes før volum‑seed kjører «blind». Detaljer finnes også i [docs/volume-seed-strategy.md](volume-seed-strategy.md).

| # | Issue | Neste handling |
|---|--------|----------------|
| P3.D1 | **RESOLVED (DOCUMENTED)** — **`profiles` vs `tg_audit_row`-volum:** `trg_profiles_audit_legacy_scope_write` + `audit_direct_profile_scope_write()` på scope-kolonner; **ikke** samme spor som **`tg_audit_row`** på de 14 tabellene; **profil-INSERT** inngår ikke i samme `audit_log`-bane som disse. | RESOLVED (DOCUMENTED) — [docs/audit-log-strategy.md](audit-log-strategy.md) § «Profiles audit-anomalitet» |
| P3.D2 | **RESOLVED (DOCUMENTED)** — **`employee_order_items`:** prod verifisert som **VIEW** (`pg_class.relkind = 'v'`), projeksjon av **`order_items`**; snapshot-felter forklares via underlaget, ikke egen heap. | RESOLVED (DOCUMENTED) — [docs/volume-seed-strategy.md](volume-seed-strategy.md) B4a-rad |
| P3.D3 | **RESOLVED (DOCUMENTED)** — **`audit_log`-størrelse ved partitionering:** `pg_total_relation_size(parent)` kan være 0/misvisende; mål **barn**/SUM; hensyn til `audit_log_legacy`. | RESOLVED (DOCUMENTED) — [docs/audit-log-strategy.md](audit-log-strategy.md) § «pg_total_relation_size på partition-parent: verifiseringsmønster» |
| P3.D4 | **PARTIAL RESOLVED** — **`multiple_permissive_policies` på `public.orders`:** 3 av 4 advisor-warnings lukket (DELETE/INSERT/UPDATE `_none`-par). Migrasjon: [`20260518200000_drop_orders_permissive_none_policies.sql`](../supabase/migrations/20260518200000_drop_orders_permissive_none_policies.sql) (commit `546eccec`, prod 2026-05-18). Gjenstående 1/4: SELECT `{orders_select, orders_select_bridge_scoped}` — **planlagt**, ikke impl. | SELECT-side: [docs/audit/orders-select-rls-consolidation-plan.md](audit/orders-select-rls-consolidation-plan.md). Impl-fase: **P3.D6**. |
| P3.D6 | **ÅPEN** — **Orders SELECT RLS-konsolidering:** union av `orders_select` (`private.can_view_order`) og `orders_select_bridge_scoped` (public bridge) til én policy via utvidet `can_view_order`. To parallelle auth-modeller; ikke «velg én». | Følg [orders-select-rls-consolidation-plan.md](audit/orders-select-rls-consolidation-plan.md). Krever 10-bruker testmatrise + `tenantIsolation.final.test.ts` grønn. Estimat 2–4 t. **Eksplisitt godkjenning før apply.** |
| P3.D5 | **ÅPEN** — **Duplikat `tg_set_updated_at`-trigger på `public.profiles`:** **`set_updated_at`** og **`profiles_set_updated_at`**, begge **`BEFORE UPDATE`**, samme målfunksjon. Trolig **migrasjonsdrift**. | **Migrasjon (Commit B / egen implementering):** `DROP TRIGGER` på **én** av de to + verifiser at ingen migrasjon/versjonering avhenger av begge. Oppdaget ved read-only audit i FASE B P3 hygiene Commit A. |

---

## Ikke på backlog ennå

- Produksjon **`EXPLAIN ANALYZE`** (eksplisitt utelatt i Rev A).
- Konkrete **`CREATE INDEX`**-utsagn i dokumentasjon — tilhører P1/P2-implementerings-commits (unntatt der B2a beskriver mål kolonner på høyt nivå i strategidok).
