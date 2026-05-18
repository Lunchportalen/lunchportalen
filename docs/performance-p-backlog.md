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

**Strategidokument (Rev A):** [docs/staging-strategy.md](staging-strategy.md) — GDPR variant C (syntetisk data), én persistert Supabase `staging`‑branch, Vercel strategi A, Sanity `staging`‑datasett på `f3vuhd2f`, domene `staging.app.lunchportalen.no`, budget‑cap forslag **kr 800/mnd**, fullt env‑inventar i [docs/environments.json](environments.json).

| Oppgave | Innhold |
|---------|---------|
| **B3a** | Supabase staging‑branch: aktiver/obruk `staging`, migrasjonssync‑flyt, budget alerts |
| **B3b** | Vercel `staging` git‑branch + env mapping; forhindre cron mot prod‑URL ved feilkonfig |
| **B3c** | Sanity `staging` datasett; egne write‑token og webhook‑secret |
| **B3d** | DNS CNAME til Vercel for `staging.app.lunchportalen.no` |
| **B3e** | Full env-dokumentasjon (JSON Rev A i repo — utvid ved behov per tjeneste) |
| **B3f** | `scripts/seed-staging.ts` — syntetisk volum (uten art. 9), idempotent — foundation til B4 skala‑seed |

**Skala‑validering etter staging står:**

1. **Volum-seed:** B4 oppgraderer B3f til dokumentert firmavolum og kjøretid.
2. **k6 / HTTP-last (B5):** representative autentiserte kjernebane-endepunkter.
3. Valgfritt **pgbench** mot staging der isolert DB‑gjennomløp trengs.
4. **Rev B:** `EXPLAIN (ANALYZE, BUFFERS)` på staging for representative queries fra `hot-paths.md`.
5. **Sammenlign Rev A vs Rev B** — arkiver snapshots (`pg_stat_statements`, tabellstørrelser, advisors).

### P3 — hygiene avdekket av B3-audit (ikke løst i Rev A docs)

| # | Issue | Neste handling |
|---|--------|----------------|
| P3.H3 | **Sanity `projectId`‑drift** (`f3vuhd2f` vs historisk `4udoq5d8` i eldre scripts) | Egen P3 commit: én sann kilde + CI grep‑guard eller eslint |
| P3.H4 | **`supabase/seed.sql` mangler** mens `supabase/config.toml` peker på fil | Opprett eller fjern seed‑kobling ved B3f/B4 avklaring |
| P3.H5 | **Env‑inventar inneholder toolchain‑støy** (`PATH`, `npm_*`, test‑internals) — se `docs/environments.json` gruppe «Diverse» | B3e: konsumer‑kun liste for Vercel vs full repo‑audit liste |

---

## Ikke på backlog ennå

- Produksjon **`EXPLAIN ANALYZE`** (eksplisitt utelatt i Rev A).
- Konkrete **`CREATE INDEX`**-utsagn i dokumentasjon — tilhører P1/P2-implementerings-commits (unntatt der B2a beskriver mål kolonner på høyt nivå i strategidok).
