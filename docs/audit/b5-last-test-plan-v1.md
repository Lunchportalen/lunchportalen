# B5 Last-test plan V1

| Felt | Verdi |
|------|-------|
| **Dato** | 2026-05-20 |
| **Status** | V1 (planning) — implementering i fremtidig sesjon |
| **Sist verifisert** | 2026-05-20 — RECON read-only mot prod `hkpokyapzarefrgqzkos` |
| **Audit-trail** | B5-PLAN-V1 · FASE B5-PLAN · agent-sesjon 2026-05-20 |
| **Avhengigheter** | B3 staging (Variant C) · B4 volum-seed MEDIUM · [docs/hot-paths.md](../hot-paths.md) |

---

## 1. Sammendrag

Lunchportalen skal tåle **50 000 firma × 500 ansatte = 25 M brukere** med to primære last-topper:

1. **Torsdag 14:00 — meny-lansering** (primær risiko): ansatte bestiller neste ukes lunsj i et ~30–60 min vindu → cliff-spike.
2. **Daglig 08:00 — cutoff** (sekundær risiko): siste frist for dagens/endring av ordre → sustained write-burst.

**Beslutninger (bruker-bekreftet):**

| Beslutning | Valg |
|------------|------|
| Test-prioritet | Spike → Stress → Soak → Load |
| Tooling | **k6** (Grafana Cloud-integrasjon, JS/TS-scenarier) |
| Seed-skala | **10 %** = 2,5 M brukere, 5 000 firma (MEDIUM i [volume-seed-strategy.md](../volume-seed-strategy.md)) |
| Latency-mål | p95 **< 500 ms** (app/API) · p95 **< 1 s** (Sanity-innhold) |
| Data | **Variant C** — kun syntetisk data på staging, ingen prod-kopi |

**Fire tester** er definert (se §3). Implementering utsettes til dedikerte sesjoner (estimat §6).

**Staging-stack (mål for alle kjøringer):**

| Komponent | Referanse |
|-----------|-----------|
| Supabase | `uigxsboqeruxflgzqztl` (B3a-REROLL, persistent) |
| Sanity | prosjekt `4udoq5d8`, dataset `staging` |
| Vercel | environment `staging`, URL `https://staging.app.lunchportalen.no` |
| Siste verifisert deploy | `AbQ6MfNrR` (login-page OK) |

---

## 2. Kontekst fra prod (RECON-data)

**Kilde:** read-only `execute_sql` mot prod `hkpokyapzarefrgqzkos`, 2026-05-20. Kun aggregater — ingen PII.

### 2.1 Nåværende volum

| Metrikk | Prod (nå) | Skala-mål (100 %) | Seed 10 % (B5) | Faktor (prod → seed) |
|---------|----------:|------------------:|---------------:|---------------------:|
| Profiler (`profiles`) | 19 | 25 000 000 | 2 500 000 | ×131 579 |
| Firma (`companies`) | 9 | 50 000 | 5 000 | ×556 |
| Ordrer totalt | 5 | — (dominert av steady-state) | 6 mnd backlog (syntetisk) | — |
| Ordrer siste 30 d | 5 | — | — | — |
| Ordrer siste 7 d | 5 | — | — | — |
| DB `public` | 72 MB | TB-skala (hypotese) | GB-skala etter B4 | — |
| DB `private` | 0 (ingen tabeller / tom) | — | — | — |

**Tolkning:** Prod er **RC mikro-drift** (19 brukere, 9 firma, 5 ordrer). Lineær ekstrapolasjon fra prod-ordrer er **meningsløs**; last-profiler og B4-distribusjonsmodell brukes for målsetting.

### 2.2 Brukere per firma (prod)

| Metrikk | Verdi |
|---------|------:|
| Snitt | 2,00 |
| Min | 1 |
| Maks | 3 |
| p95 | 2,65 |

**Merk:** Prod-fordeling reflekterer **pilot**, ikke mål-skala (500 ansatte/firma i MEDIUM-profil). B5-seed bruker [volume-seed-strategy.md](../volume-seed-strategy.md) § Datadistribusjons-modell (vektet SMB: ~80 % <50, ~15 % 50–500, ~5 % 500+), ikke prod p95.

### 2.3 Topp 10 tabeller (prod, `public`)

| Tabell | Størrelse | rader (ca.) |
|--------|-----------|------------:|
| `audit_log_legacy` | 38 MB | 18 823 |
| `audit_log_y2026m05` | 20 MB | 18 874 |
| `company_memberships` | 1512 kB | 16 |
| `company_locations` | 1192 kB | 9 |
| `agreements` | 1168 kB | 5 |
| `companies` | 960 kB | 9 |
| `ai_activity_log` | 944 kB | 1 894 |
| `location_memberships` | 848 kB | 14 |
| `profile_scope_legacy_write_audit` | 784 kB | 3 452 |
| `profiles` | 640 kB | 19 |

**Implikasjon for B5:** `audit_log` dominerer lagring allerede ved mikro-volum; spike-tester må overvåke audit-WAL og partisjon-barn (jf. [audit-log-strategy.md](../audit-log-strategy.md)).

### 2.4 Peak-mønster (ordre, siste 14 dager)

PostgreSQL `EXTRACT(DOW)`: 0 = søndag … **4 = torsdag**, **5 = fredag**.

**Per ukedag:**

| DOW | Ukedag | Ordrer |
|----:|--------|-------:|
| 5 | Fredag | 5 |

**Per time (aggregert):**

| Time | Ordrer |
|-----:|-------:|
| 21 | 2 |
| 14 | 1 |
| 15 | 1 |
| 16 | 1 |

**Per (DOW, time) — eneste rader:**

| DOW | Time | Ordrer |
|----:|-----:|-------:|
| 5 | 14 | 1 |
| 5 | 15 | 1 |
| 5 | 16 | 1 |
| 5 | 21 | 2 |

#### Peak-bekreftelse: torsdag 14:00

| Påstand | Status |
|---------|--------|
| Torsdag 14:00 er hovedspike i **prod-data** | **AVKREFTET** — ingen ordrer på torsdag (DOW=4); alle 5 ordrer på fredag |
| Torsdag 14:00 er **forretningskritisk spike** (meny-lansering) | **HYPOTESE BEHOLDT** — produktdesign / [menu-publish-pipeline.md](../architecture/menu-publish-pipeline.md) G.2; prod har for lav N til empirisk validering |
| Sekundær peak 08:00 cutoff | **IKKE OBSERVERT** i prod (ingen ordrer kl. 08) — beholdes som design-hypotese |

**Konklusjon:** B5 spike-profil **modellerer torsdag 14:00 syntetisk**; prod RECON kan ikke kalibrere amplitude, kun bekrefte at dagens drift er mikroskala.

---

## 3. Test-portfolio

Felles målinger (alle tester):

- **Latency:** p50 / p95 / p99 per endepunkt (k6 `http_req_duration`, tags per route)
- **Feilrate:** `< 0,1 %` 5xx; `< 1 %` 4xx (ekskl. forventet 409/idempotency)
- **DB (Supabase dashboard / pg_stat):** active connections, pool wait, CPU, disk I/O, replication lag
- **Vercel:** function duration, concurrency, cold starts
- **Sanity:** p95 fetch mot `/api/week` CMS-del; CDN/cache hit-rate

Referanse-endepunkter: [hot-paths.md](../hot-paths.md). Primær write: `POST /api/orders` (RPC `lp_order_set`). Primær read-flyt: `GET /api/week` → `GET /api/order/window` → write.

Eksisterende repo-skeleton: `perf/k6/` (tomme scenarier — utvides i F1).

---

### 3.1 Meny-lansering Spike (PRIO 1)

**Hypotese:** Systemet overlever cliff-spike når stor andel av 2,5 M seed-brukere bestiller neste ukes lunsj innen ~30 min etter «meny publish», uten deadlocks på `lp_order_set`, connection pool exhaustion eller kaskade-5xx.

**Profil (k6):**

| Fase | Varighet | VUs / RPS-mål |
|------|----------|---------------|
| Ramp-up | 5 min | 0 → 50 000 iter/s (staircase) |
| Sustain | 30 min | ~50 000 **POST /api/orders** / min (~833/s) |
| Ramp-down | 10 min | 50 000 → 0 |

**Scenarier per VU (vektet):**

| Steg | % VUs | Handling |
|------|------:|----------|
| 1 | 100 % | Gjenbruk cached JWT (seed-pool) |
| 2 | 100 % | `GET /api/week` (Sanity + DB) |
| 3 | 90 % | `GET /api/order/window` |
| 4 | 70 % | `POST /api/orders` (idempotency-key per attempt) |
| 5 | 15 % | `PATCH /api/orders/choice` (endring) |

**Geografisk konsentrasjon:** VU-tilordning etter B4 cluster (Oslo/Trondheim/Bergen) — ikke uniform random (jf. menu-publish G.2).

**Suksess-kriterier:**

- p95 `POST /api/orders` **< 500 ms**
- p95 `GET /api/week` **< 1 s** (Sanity-innhold)
- Error rate 5xx **< 0,1 %**
- Ingen sustained pool wait > 30 s
- Ingen deadlock-feil i Supabase logs

**Estimat:**

| | Verdi |
|---|-------|
| Kjøretid | ~45 min aktiv last + 30 min oppvarming/kjøling |
| Supabase | Burst compute/disk — monitor mot kr 800/mnd cap ([staging-strategy.md](../staging-strategy.md)) |
| Vercel | Function invocations spike; Pro concurrency-grenser |
| Grafana Cloud k6 | VU-minutter avhengig av plan (åpent spørsmål §9) |

---

### 3.2 Daily 08:00 Cutoff Stress (PRIO 2)

**Hypotese:** Sustained write-burst ved cutoff (siste endring før kjøkkenlås) holder p95 under 500 ms uten audit-trigger-kø og RLS-initplan-degradering.

**Profil:**

| Fase | Varighet | Last |
|------|----------|------|
| Ramp-up | 3 min | 0 → 20 000 VUs |
| Sustain | 15 min | Blandet `POST /api/orders`, `POST /api/order/bulk-set`, `POST /api/order/cancel` (60/30/10) |
| Ramp-down | 5 min | → 0 |

**Scenarier:** Cutoff-vindu simulert med `service_date = today` og tidsstempel nær cutoff (staging seed må ha `menu_service_days` + `location_policies` konsistent).

**Suksess-kriterier:**

- p95 write-endepunkter **< 500 ms** under sustain
- Ingen økning i `auth_rls_initplan`-drevet latency vs. baseline (Rev B EXPLAIN på staging)

**Estimat:** ~25 min kjøring · moderat lavere peak enn 3.1, lengre sustain.

---

### 3.3 Cron-job Storm (PRIO 3)

**Hypotese:** Planlagte cron-jobber (meny-ingest, cutoff-batch, reconcile) kan kjøre parallelt med interaktiv last uten error spike eller dobbelt-prosessering.

**Profil:**

| Fase | Varighet | Last |
|------|----------|------|
| Bakgrunn | 20 min | Trigger cron-endepunkter med gyldig `CRON_SECRET` (staging env) |
| Overlapp | 20 min | 5 000 interaktive VUs samtidig (read-heavy: week + kitchen) |

**Scenarier:**

- Cron: `vercel.json`-cron routes mot staging (meny webhook-simulering / system motor der relevant)
- VU: `GET /api/week`, `GET /api/kitchen/companies` (kjøkken read under produksjonspress)

**Suksess-kriterier:**

- Ingen error spike (>2× baseline) i cron eller interactive under overlapp
- Idempotente cron-kjøringer (ingen duplikat `menu_service_days`)

**Estimat:** ~40 min · lav VU, høy operativ kompleksitet (cron-timing).

---

### 3.4 Soak Test 24h (PRIO 4)

**Hypotese:** Ingen memory leak, connection pool exhaustion eller gradvis latency-drift over 24 t ved moderat steady load.

**Profil:**

| Fase | Varighet | Last |
|------|----------|------|
| Sustain | 24 t | 200–500 VUs konstant, blandet read/write (70/30) |

**Scenarier:** Roterende «normal dag»-flyt: login refresh hver 55 min, week view, sporadisk order toggle.

**Suksess-kriterier:**

- Memory **< 90 %** (Vercel/Supabase) etter 24 t
- p95 drift **< 20 %** vs. første time
- Active DB connections stabil (ingen monoton økning)
- Ingen nye 5xx etter time 12

**Estimat:** 24 t wall-clock · Grafana Cloud k6 cloud-run eller lokal agent med stabil nett · høyeste **kost** pga varighet — planlegg natt/helg.

---

## 4. Tooling-arkitektur

### 4.1 k6-oppsett

| Modus | Bruk |
|-------|------|
| **Lokal k6** | Utvikling, smoke, auth-feilsøking |
| **Grafana Cloud k6** | Spike/stress (distribuert last, dashboards, historikk) |

**Struktur (målbilde, implementeres F1–F3):**

```
perf/k6/
├── env.example          # BASE_URL, JWT_POOL_PATH, STAGE secrets (gitignored values)
├── scenarios/
│   ├── menu_launch_spike.ts
│   ├── cutoff_stress.ts
│   ├── cron_storm.ts
│   └── soak_24h.ts
├── lib/
│   ├── auth.ts          # JWT pool loader
│   ├── endpoints.ts     # URL + payload builders
│   └── thresholds.ts    # p95 gates
└── run-local.ps1 / .sh
```

TypeScript via `k6/experimental/tsconfig` eller bundler (esbuild) — følg Grafana k6 TS-guide ved F1.

### 4.2 Auth-flyt uten 2,5 M ekte login per test

k6 VUs trenger **nok unike identiteter** til å unngå idempotency-kollisjon og RLS-feil, ikke 2,5 M samtidige auth-kall.

| Pool-størrelse (hypotese) | Formål |
|---------------------------|--------|
| 50 000–100 000 auth-brukere | JWT-pool rotert over 50 K VUs |
| 2,5 M profiler i DB | Realistisk scan/join-press i Postgres |

**Flyt:**

1. B4 seed oppretter profiler + `auth.users` (Admin API, batch).
2. Pre-test script: logg inn pool → lagre JWT + refresh token til kryptert fil (staging-only, gitignored).
3. k6: `SharedArray` laster JWT-pool; VU = `pool[vu.idInTest % pool.length]`.
4. Refresh: bakgrunnsjobb fornyer tokens hver 50 min under soak.

### 4.3 Data-generering

- **Faker.js** (deterministisk `--seed`) — allerede planlagt i B4a.
- Ordrer: idempotency-key = `hash(vu, iteration, service_date)`.
- Meny: Sanity `staging` dataset — synkroniser med B4 `menu_service_days` seed.

### 4.4 Resultat-aggregering

| Kilde | Metrikk |
|-------|---------|
| Grafana Cloud k6 | p50/p95/p99, RPS, checks, VU-status |
| Supabase Dashboard | CPU, connections, disk, slow queries |
| Vercel Analytics / Observability | Function duration, error rate |
| Egen `b5-report.json` | Arkiveres i `docs/audit/` etter hver kjøring (aggregater only) |

---

## 5. Seed-strategi (10 % = 2,5 M brukere)

**Forutsetning:** B4 MEDIUM (`5 000 × 500 = 2 500 000` N) fullført på `uigxsboqeruxflgzqztl` før B5 Test 1.

### 5.1 Auth-tilnærminger

| ID | Tilnærming | Fordeler | Ulemper |
|----|------------|----------|---------|
| **A** | Pre-genererte JWT-er | Rask teststart; ingen Auth API-last | Krever gyldige brukere under; expiry-håndtering; tester ikke login-path |
| **B** | Service-role bypass i staging | Enklest setup | **Ugyldig for B5** — hopper over RLS, cookies, middleware; gir falsk grønt |
| **C** | Ekte `auth.users` + deterministiske passord | Full auth-path; RLS-sann | 2,5 M brukere = dager + Auth rate limits |

### 5.2 Anbefaling: **C (subset) + A (JWT-cache)**

1. **B4 oppretter alle 2,5 M `auth.users` + `profiles`** via Admin API (batch 1k–5k, parallell ≤4) — nødvendig for realistisk DB.
2. **B5 pre-auth pool:** 50k–100k representativt utvalg logges inn én gang; JWT lagres for k6 (**A**).
3. **Login-path smoke:** egen liten k6-scenario (100 VU) kjører faktisk `/login` + post-login for regresjon — dekker det **A** alene ikke tester.

**Begrunnelse:** Ren **B** bryter RC fail-closed-prinsipp. Ren **C** for hver VU hvert sekund er umulig ved spike. Hybrid matcher skala (DB) med gjennomførbarhet (HTTP).

### 5.3 Firma-struktur

- **5 000 firma**, ansattfordeling per [volume-seed-strategy.md](../volume-seed-strategy.md) (ikke prod p95=2,65).
- Geo-cluster: Oslo ~45 %, Trondheim ~25 %, Bergen ~20 %, øvrig ~10 %.

### 5.4 Meny-data

- Sanity `staging`: `menuDay`-dokumenter for 4 uker frem + 1 uke historikk.
- Postgres: `menu_service_days` + items aligned med CMS (B4 steg 9).
- Realistisk **8–15 items per kategori**, power-law popularitet på `order_items`.

### 5.5 Order-historikk

- **6 måneder** syntetisk backlog per aktiv bruker (gjennomsnitt ~4 ordre/uke → ~100 ordre/bruker → ~250 M ordre-rader ved full N).
- **Praktisk B5-første kjøring:** vurder redusert historikk (4 uker) for Test 1 hvis seed-tid overskrider budget; dokumenter avvik i rapport.
- Post-seed `audit_log` truncate på staging (gate i volume-seed-strategy) før last-test.

---

## 6. Implementeringsfaser

| Fase | Innhold | Sesjoner (estimat) |
|------|---------|-------------------:|
| **F1** | k6 lokalt + Grafana Cloud account; hello-world mot staging; auth-pool POC | 1 |
| **F2** | Seed-script integrasjon / JWT pre-auth generator; pool-fil pipeline | 1–2 |
| **F3** | Scenarier 3.1–3.4 (TS-moduler, thresholds, tags) | 2–3 per test |
| **F4** | Test-kjøring + iterasjon (fail → fix → re-run) | 1–2 per test |
| **F5** | Analyse, Rev B EXPLAIN, `b5-report-*.md`, backlog-oppdatering | 1 |

**Total:** **8–15 sesjoner** avhengig av B4-modenhet og Grafana-oppsett.

**Blokkerende rekkefølge:** B4 MEDIUM seed → F1 → F2 → F3.1 (spike) → øvrige tester.

---

## 7. Risiko og motvirkninger

| Risiko | Sannsynlighet | Impact | Motvirkning |
|--------|---------------|--------|-------------|
| Supabase rate limits under spike | Medium | Høy | Staging branch only; gradvis ramp; monitor Auth API separat |
| Seed 2,5 M tar dager | Medium | Høy | Batch + parallell ≤4; start MEDIUM uten full 6m historikk |
| Sanity kvote / latency | Medium | Medium | Valider cache/CDN før Test 1; p95 <1s egen gate |
| Variant C-brudd (prod-data i seed) | Lav | Kritisk | Faker-only; CI-guard; `--confirm=staging+uigxsboqeruxflgzqztl` |
| Test-kost > kr 800/mnd | Medium | Medium | Pre-test kalkulator; caps på VU-minutter; soak kun etter PASS spike |
| `audit_log` WAL-spike | Høy | Medium | Post-seed truncate; overvåk partisjon barn |
| Prod RECON feilaktig kalibrering | Høy | Lav | Dokumentert — bruk syntetisk profil, ikke prod peak |
| Tomme `perf/k6`-scenarier | — | — | Forventet; F1 fyller inn |

---

## 8. Akseptanse-kriterier (release gate for B5)

| Test | Gate |
|------|------|
| **1 Spike** | p95 < 500 ms for `POST /api/orders` under **50 000 req/min**; 5xx < 0,1 % |
| **2 Cutoff** | p95 < 500 ms sustained write-burst (15 min) |
| **3 Cron** | Ingen error spike >2× baseline når cron + interactive parallel |
| **4 Soak** | Memory < 90 % etter 24 t; ingen connection pool exhaustion; p95 drift < 20 % |

**Generelt:** Alle tester kjøres mot **staging URL** med **Variant C** data. Ingen test kjøres mot prod `hkpokyapzarefrgqzkos`.

---

## 9. Åpne spørsmål (implementering)

1. **Grafana Cloud-plan?** Free tier VU-minutter vs. Pro — kost for Test 1 + 4.
2. **CI-integrasjon?** Nightly smoke (100 VU) vs. manuell pre-release only.
3. **Seed-scripts plassering?** Anbefaling: `scripts/seed/` (B4) + `perf/k6/lib/auth-pool.ts` (B5) — ikke bland.
4. **Varsling ved failure?** Slack webhook / e-post fra Grafana Cloud.
5. **Regelmessig kjøring?** Forslag: Test 1+2 pre-release; Test 4 kvartalsvis; Test 3 ved cron-endringer.
6. **JWT pool størrelse endelig?** 50k vs 100k — avhenger av idempotency-design i `lp_order_set`.
7. **6 mnd ordre-historikk vs. seed-tid?** Avklar i F2 etter første B4b måling.

---

## 10. Neste steg (F1 — ny sesjon)

- [ ] Installer k6 lokalt (`choco install k6` / `winget install k6`)
- [ ] Opprett Grafana Cloud k6-prosjekt
- [ ] Hello-world: `GET https://staging.app.lunchportalen.no/login` (200, p95 baseline)
- [ ] Hello-world autentisert: én seed-bruker → `GET /api/week`
- [ ] Dokumenter JWT-pool POC (10 brukere)
- [ ] Verifiser staging env: `CRON_SECRET`, `SYSTEM_MOTOR_SECRET` present (fail-closed health)

---

## Referanser

- [docs/staging-strategy.md](../staging-strategy.md)
- [docs/volume-seed-strategy.md](../volume-seed-strategy.md)
- [docs/hot-paths.md](../hot-paths.md)
- [docs/performance-p-backlog.md](../performance-p-backlog.md)
- [docs/audit/staging-env-mapping-2026-05-20.md](staging-env-mapping-2026-05-20.md)
- [docs/architecture/menu-publish-pipeline.md](../architecture/menu-publish-pipeline.md) § G.2
- Repo: `perf/k6/` (skeleton)

---

*End of B5 Last-test plan V1.*
