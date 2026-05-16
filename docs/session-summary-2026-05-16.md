# Lunchportalen — Session Summary 2026-05-16

## Kontekst-anker for ny Claude-økt

- **Produkt:** `app.lunchportalen.no` — Next.js (App Router) + Supabase (Postgres/Auth) + Sanity, drift på Vercel. `lunchportalen.no` — markedsføring på Umbraco (ca. v17) + Azure.
- **Ambisjon:** skala-mål omtrent **50K firma × 500 ansatte** (ordre- og RLS-last må tåles over tid; kveldens arbeid er fundament-fiks, ikke lastvalidering).
- **Arbeidsmønster:** brukeren styrer med **STEG-N → STOP**-prompter og **eksplisitt godkjenning** før sensitive operasjoner (commit/push, prod-apply). **MCP Supabase** brukes til **read** (`execute_sql`) og **DDL apply** (`apply_migration`) der det er avtalt.
- **Verktøy:** `gh` CLI er ofte **ikke** i PATH i lokalt Cursor-miljø — GitHub Actions må ofte inspiseres fra GitHub-UI.

## Hva som ble lukket i denne økten (ti commits, må forventes på `origin/main`)

Korte beskrivelser per kjernerevisjon (kort hash = første tegn i Git-objektet; se `git log` for full historikk).

### `365897d1` — Meny cron / CLI token-paritet

Meny-publiserings-CLI og cron avvek fra prod-Sanity-oppførsel: feil token-inngang (`sanityServer` må bruke skrivetoken der det er påkrevd), og «minimum 50 retter» feildiagnostisert når datasett var tomt pga ACL. Fikset bl.a. paritet med `getSanityWriteToken()`, kosttak (`estimatedCostPerPortion` vs schema max), `dryRun`/`clock` for determinisme, og diagnose-skript i `scripts/`. **Hvor:** `scripts/cron-menu-publish.ts`, `scripts/sanity/heal-menu-horizon.ts`, `lib/menu-publish/*`, `mealIdeaBankQuery.ts`, `runMenuWeekRolloutCore.ts`. *Journal:* FASE 13-IMPL-3S-1-CLOSE.

### `09f945bb` — Generator tag-taxonomy + fallback

Generator valgte ikke meningsfullt nok retter når tag-overlapp var for rigid. Innført tag-taxonomi, bedre overlap og `pickBestWithFallback` med kontrollert telemetri. **Hvor:** `lib/menu-publish/tagTaxonomy.ts`, `pickBest`-kjede, tester og `scripts/diag-mealidea-tags.ts`. Verifisert med tørre kjøringer på utvalgte uker. *Journal:* FASE 13-IMPL-3S-1B-GENERATOR.

### `387dfe34` — RLS locations-helpers repair

`private.can_access_location` og `private.can_manage_location` pekte på feil/utdatert tabell (`locations` vs faktisk bruk av `company_locations`), som ga **42P01** i RLS-kjeder mot bl.a. `menu_service_days` og `orders`. Migrasjon rettet helpers; apply mot prod via MCP; golden snapshot og capture oppdatert med forventede definisjonshasher. **Hvor:** migrasjon under `supabase/migrations/` (repair + capture), `tests/rls/golden-rls-snapshot.json`, `scripts/generate-prod-rls-capture.mjs`. *Journal:* FASE 13.5-FIX-1-REPAIR.

### `e13eb180` — HTTP-idempotency backend (POST `/api/orders`)

Dobbelklikk / retry kunne skape duplikate operasjoner uten HTTP-nivå idempotency. `lp_idem_begin` utvidet med `status_code`; route bruker valgfri `Idempotency-Key`, kanonisk hash- timing, `lp_idem_complete` / `lp_idem_fail`, og **23505 → 409 DUPLICATE_ORDER** med eksplisitt unntak for **23514**. **Hvor:** `app/api/orders/route.ts`, migrasjon `lp_idem_begin`, `tests/api/orders-idempotency.test.ts`. *Journal:* FASE 13.5-FIX-2-IMPL.

### `a287a156` — HTTP-idempotency klient

UI sendte ikke idempotency-header på `POST` til `/api/orders`. Fikset med delt helper og integrasjon i uke- og ordrehandlinger pluss tester. **Hvor:** `lib/orders/idempotencyKey.ts`, `EmployeeWeekClient.tsx`, `OrderActions.tsx`, tester under `tests/orders/`. *Journal:* FASE 13.5-FIX-2B.

### `cfd5ac72` — RLS drift CI-guard

Ingen automatisk alarm når prod-RLS divergerte fra «golden» kjerne. Nytt skript sammenligner policies, private-signaturer og valgte definisjonshasher; workflow for daglig / manuell kjøring med `DATABASE_URL`. **Hvor:** `scripts/check-rls-drift.mjs`, `.github/workflows/rls-drift-check.yml`, `tests/rls/golden-rls-snapshot.json`, `tests/rls/README.md`, `package.json`. *Journal:* FASE 13.5-FIX-4.

### `30a50af3` — Deprecate `/api/orders/upsert`

Rute var ødelagt i prod (manglende RPC) og konkurrerte med kanonisk POST `/api/orders` + idempotency. Fjernet rute og død klient, oppdatert route registry, SLO/runbook og API-guard-tester. **Hvor:** slettet `app/api/orders/upsert`, `lib/system/routeRegistry.ts`, m.m. *Journal:* FASE 13.5-FIX-3-FOLLOWUP.

### `96f87b31` — Lokal staging-apply guide

Manglende lokal verifisering tvang tidligere prod-touch via MCP. Dokumentert hvordan kjøre Supabase lokalt, `.env.local`-krav, `vitest.rls.config.ts` for RLS-tester, og skille Docker-feil vs parse-feil. **Hvor:** `docs/local-staging-apply.md`.

### `79213be1` — 20260204-kollisjon + lukking av prod-drift

Fem migrasjoner delte samme versjonsprefiks `20260204_*`, så lokal `schema_migrations` fikk duplikatnøkkel. Renamet til unike tidsstempler **plus** idempotent «close drift»-DDL for `company_deletions`, `claim_repair_jobs` og `repair_jobs_state_next_run_idx`; prod oppdatert via MCP; filnavn i repo matchet registrert migrasjonsversjon i prod. **Hvor:** `supabase/migrations/20260204000001_*` … `20260516191414_close_20260204_drift.sql`. *Journal:* FASE 13.5-FIX-5.

### `b3f5984f` — SSL / pooler for RLS drift workflow

GitHub Actions (IPv4) mot Session Pooler feilet på TLS («self signed certificate in certificate chain»). `pg.Pool` fikk `ssl: { rejectUnauthorized: false }` (kryptert, men uten streng CA-validering mot kjent pooler-mønster); dokumentert pooler vs direkte DB. **Hvor:** `scripts/check-rls-drift.mjs`, `tests/rls/README.md`. *Journal:* FASE 13.5-FIX-4-FOLLOWUP.

## Manuelle GitHub / Supabase-handlinger (sammenfatning, uten hemmeligheter)

- **GitHub:** repo-secret **`DATABASE_URL`** satt for RLS drift-check — peker til **Supabase Session Pooler** (IPv4-vennlig for Actions), med **`sslmode`** i tråd med Node/pg og README (typisk `no-verify` / ekvivalent i hemmeligheten; **ikke** lim inn full URL her).
- **workflow_dispatch** på **RLS drift check:** første kjøring rapportert som **grønn** med `ok: true` og kjernesett (16 policies / 19 funksjoner / 2 def-hashes) uten drift i den kjøringen.
- **Supabase Dashboard (SQL editor):** `ALTER TYPE membership_role ADD VALUE IF NOT EXISTS 'company_finance'` — kjørt i prod; **kan** mangle tilsvarende rad i `schema_migrations` inntil samme SQL kommer inn via `db push`. Repo inneholder bl.a. `20260516230000_membership_role_add_company_finance.sql`.
- **Hvorfor Session Pooler:** GitHub-hosted runners er **IPv4-first**; direkte Supabase database-vert kan være **IPv6-only** — pooler fungerer som praktisk bro.

## Status i prod etter denne økten (én linje per tema)

| Komponent | Status |
|-----------|--------|
| Meny-generator sommer 2026 | **FUNGERER MED BEGRENSNING** — generator og cron er forbedret; faktisk utfylling avhenger fortsatt av Sanity-bank, avtaler/tier og definerte uker. |
| RLS-evaluering på `orders` / `menu_service_days` (via kjernefunksjoner) | **FUNGERER MED BEGRENSNING** — locations-helper repair og golden dekker avtalt kjerne; full policyflate i prod er større enn golden. |
| HTTP-idempotency på `POST /api/orders` | **FUNGERER** — etter implementerte tester og journalført kontrakt (inkl. 23505-håndtering). |
| `POST /api/orders/upsert` | **FUNGERER** — forventet **deprecated / borte**; kanon er POST `/api/orders`. |
| `company_deletions` tabell | **FUNGERER** — etter drift-lukking; superadmin archive-summary avhenger av tabellen. |
| `claim_repair_jobs()` RPC | **FUNGERER** — etter drift-lukking; repairs-run bruker RPC. |
| `repair_jobs_state_next_run_idx` | **FUNGERER** — indeks opprettet idempotent i drift-lukking. |
| Daglig RLS drift CI | **FUNGERER MED BEGRENSNING** — avhengig av riktig `DATABASE_URL`, pooler/SSL-forståelse, og den **delvise** policy/RPC-dekningen som golden fanger. |

## Sikkerhetsbemerkninger fra økten

- Under **ENV-FIX** ble **`supabase status --debug`** brukt; det kan dumpe **store deler av `.env.local`** (inkl. databasepassord og API-nøkler) til **stderr**. Bruker ble advart; **rotasjon er ikke bekreftet** her.
- **`findstr` / rå utskrift** av `.env.local`-linjer kan ha lagt **hemmelige verdier** i terminalbuffer — unngå deling av logger.

## Kjente begrensninger / latent risiko

1. **`20260216_kitchen_driver_scope_rls.sql`** — lokal `db reset` kan feile på **`profiles.user_id`** som ikke finnes i bootstrap; indikerer skjema/RLS-drift på tvers av migrasjonsrekkefølge.
2. **`20260513a` / `20260513b`** — filnavn matcher ikke Supabase CLI; filene **skippes** ved `db push` uten nødvendigvis å feile hele workflow — innholdets kritikalitet er **ukjent** uten egen gjennomgang.
3. **Stray migrasjon** `test_ping_migration_sql` — fortsatt registrert i `schema_migrations` (støy / teknisk gjeld).
4. **`membership_role` + `company_finance`** — enum-verdi kan være **brukt i prod** før migrasjonsrad finnes; neste vellykkede `db push` bør idempotently registrere fila.
5. **SSL i `check-rls-drift.mjs`** — tilkobling avhenger av konsistent **`sslmode`** i URL **og** Node/pg-oppførsel; endring av secret uten koordinasjon kan knekke CI.

## Backlog kategorisert

### P1

- *(Ingen åpne P1 fra denne kvelden som ikke er lukket i målsetningen for FASE 13.5-kjeden.)*

### P2 — operasjonell / staging

- `20260216` / `profiles.user_id` vs migrasjonsrekkefølge.
- `20260513a` / `20260513b` filnavn vs CLI + migration-gate.
- Rydde / forklare stray `test_ping` i migrasjonshistorikk.
- SSL / konfigurasjons **robusthet** for RLS drift (README + kode i takt).

### P2 — UI / produkt (ikke sikkerhetskritisk)

- Header-logo, footer FrameCore-logo, mobil header-overlap, tekst «Kommende menyer» → «Kommende dager», ESC-collapse for kategori-panel — *liste fra bruker; ikke verifisert i denne økten.*

### P3 — større, ikke blokkering for nåværende skala

- 3S-2 daglig heal-cron (horizon ~14).
- 3S-3 partisjonering / materialiserte views / indekser på ordrer.
- Studio WeekPlanner engelsk sesong.
- Utvide RLS golden mot full prod-paritet (mange policies/RPC).
- OS/API-kart for native apper.

## Skala-roadmap mot 50K firma × 500 ansatte

Kveldens arbeid er **fundament-fiks** (kontrakter, RLS-kjerne, idempotency, drift-innsyn), **ikke** bevis på at plattformen tåler **25M brukere** eller tilsvarende ordrevolum.

### FASE A — Stabilisering (omtrent 1–2 uker)

1. Rydd `20260216` + `20260513a/b` slik at **lokal `db reset`** og gate blir forutsigbare.
2. Utvid golden / drift-guard mot **full** policy- og DEFINER-dekning etter avtalt omfang.
3. **EXPLAIN ANALYZE** på topp-spørringer → indekser.
4. **Multi-tenant penetrasjonstest** (ingen kryss-firma-lekasje).

### FASE B — Skala-grunnmur (omtrent 2–4 uker)

5. Ordre-partisjonering på tidsakse (månedlig eller etter avtalt nøkkel).
6. Materialiserte visninger for tunge dashboard.
7. Daglig heal for meny-horisont.
8. Last på **staging** (samtidige tilkoblinger, p99).

### FASE C — Operasjonell beredskap (omtrent 2 uker)

9. SLO-alarmer med eskalering.
10. Runbook for vanlige hendelser.
11. **Gjennomført** backup/restore-øvelse.
12. Failover der region-strategi finnes.

### FASE D — Skala-validering (omtrent 1 uke)

13. Simulert volum (representativ bredde).
14. Mål p99 på ordre-POST (sett tall etter behov).
15. Iterer flaskehalser.

**Realistisk:** **6–9 uker** fokus før **trygg** første stor bølge; vekst 1K → 50K bør være **gradvis** med målinger.

## Cursor-arbeidsmønster (gjentak for ny økt)

- Fase-prompter med **STEG → STOP**; bruker godkjenner **commit/push** og **prod-touch**.
- MCP Supabase: **`execute_sql`** (lesing) og **`apply_migration`** (DDL) når avtalt.
- **`gh`** ofte fraværende — sjekk Actions i nettleser.
- **UTF-8 uten BOM** for migrasjoner og docs; Cursor **Write** kan reintrodusere BOM — ved tvil: PowerShell `WriteAllText` med `UTF8Encoding(false)`.
- **Preflight** før push (ci:guard → … → tester → lint → audit) tar typisk **2–8 minutter**.
- **Supabase Migrate workflow** og **migration-gate** kan feile på **ugyldige filnavn** i `supabase/migrations/` — ikke anta grønn flyt uten å lese siste logg.

## Hva som er trygt dokumentert vs antakelser

**Trygt (etter kveldens spor og journal):**

- Golden-kjerne (16 policies / 19 `private.*` / 2 def-hashes) har vært **grønn** i rapportert drift-kjøring etter helper-repair.
- `can_access_location` / `can_manage_location` **md5** matcher capture etter repair.
- `company_deletions`, `claim_repair_jobs`, `repair_jobs_state_next_run_idx` **finnes** i prod etter avtalt MCP-apply og SQL-verifikasjon.
- HTTP-idempotency: **23505 → 409 DUPLICATE_ORDER** med **23514** unntatt i meldingssti; klient sender **Idempotency-Key**.

**Antakelser (ikke bevist under last / volum):**

- Rate limiting under ekstrem topp.
- Eksakte pooler- og forbindelsesgrenser.
- Alle øvrige RLS-policies utenfor golden.
- `audit_events` ytelse ved meget høy skrive-/leserate.

---

*Dette dokumentet oppsummerer kveldens arbeid for kontinyitet. Oppdater ved større avvik — ikke behandl som erstatning for `journal.txt` eller commit-logg.*
