# B3 — Decision Framework for Staging Provisioning

**Opprettet:** 2026-05-19 · **Status:** Beslutninger **LUKKET (2026-05-19)** — B3a–B3f **klar for implementering**

**Relatert:** [docs/staging-strategy.md](../staging-strategy.md) (Rev A, retning avgjort) · [docs/performance-p-backlog.md](../performance-p-backlog.md) · [docs/environments.json](../environments.json) · [docs/environments-runtime.json](../environments-runtime.json)

**Valutakurs (felles referanse):** 1 USD = **9,3266 NOK** (Frankfurter/ECB, observasjon 2026-05-15 — jf. `meta.valutaReferanse` i environment-filene og staging-strategy).

---

## Bakgrunn

[staging-strategy.md](../staging-strategy.md) har allerede låst **arkitekturretning**: GDPR **variant C** (syntetisk staging-data), **én persistert** Supabase staging-branch, Vercel **strategi A** (production + `staging` + PR-preview), Sanity **`staging`**-datasett på prosjekt **`4udoq5d8`**, mål-vert **`staging.app.lunchportalen.no`**, og indikativ kost **ca. kr 470–620/mnd** før hard cap. De fire **forretnings-/driftsvalgene** (DNS-leverandør, Supabase-plan, budsjettcap, skjebne for `staging-abc-signoff`) er **besvart 2026-05-19** — se [Status (per 2026-05-19)](#status-per-2026-05-19).

Etter P3.H3-REVERSE (40a17745, 2026-05-19): Sanity canonical = 4udoq5d8. B3c target-prosjekt oppdatert; implementeringsrekkefølge uendret.

**Allerede besluttet i strategy.md (ikke gjenåpne her):** datavariant C, hostname `staging.app.lunchportalen.no`, Sanity dataset-navn/plan, Vercel deploy-modell, og kurs for NOK-estimater. Beslutningsdetaljer under STEG 1 er **historisk kontekst**; gjeldende valg står i status-tabellen.

---

## Status (per 2026-05-19)

Alle fire beslutninger besvart (~02:30):

| # | Tema | Valg | Kilde |
|---|------|------|-------|
| 1 | DNS-provider | **Domeneshop** (domene.no) | Bruker bekreftet |
| 2 | Supabase plan | **Pro** | Dashboard skjermbilde |
| 3 | Budgetcap | **kr 800/mnd** (hard cap akseptert) | Bruker akseptert |
| 4 | Gammel branch (`iyrytpjacujscveivtfb`) | **Behold PAUSED** som arkiv; opprett **separat ny** `staging`-branch | Dashboard skjermbilde + bruker |

### Viktig distinksjon for #4: PAUSED vs INACTIVE

Tidligere dokumentasjon (Rev A, MCP) antok status **INACTIVE**. Faktisk status i Dashboard (2026-05-19): **PAUSED** (Pro-plan paused branch).

| Aspekt | PAUSED (faktisk) | INACTIVE (tidligere antakelse) |
|--------|------------------|--------------------------------|
| Data | Lagret, men utilgjengelig til resume | Ofte tolket som «parkert» uten tilgang |
| Compute-kost | **0** mens paused | Varierende tolkning i docs |
| Lagring | Marginal; inkludert i Pro baseline | Ikke presisert |
| Resume | Mulig når som helst | Re-aktivering mulig, men uklar kost |

**Strategi (besluttet):** Behold `staging-abc-signoff` (`iyrytpjacujscveivtfb`) paused som **historisk arkiv** (kost nær 0). **Opprett ny separat branch** med rent navn **`staging`** for B3-implementering — **ikke** gjenbruk abc-signoff. **Ingen sletting** av gammel branch nå; vurder sletting senere hvis arkiveringskost blir merkbar.

**Merk:** [staging-strategy.md](../staging-strategy.md) § «Eksisterende staging-abc-signoff» sier fortsatt INACTIVE — oppdateres ved neste Rev A-revisjon av strategy; **denne filen er sannhetskilde for beslutning #4**.

---

## STEG 1 — Kontekst fra eksisterende dokumenter

### Beslutning 1 — Subdomain og DNS

| Kilde | Hva som allerede er sagt |
|-------|---------------------------|
| [staging-strategy.md](../staging-strategy.md) | Hostname **`staging.app.lunchportalen.no`**; **CNAME → Vercel** (mål fra Vercel UI ved oppsett); Umbraco/`lunchportalen.no` **utenfor** scope (Azure egen prosess). |
| [architecture/PUBLIC_SITE_AND_APP_BOUNDARIES.md](../architecture/PUBLIC_SITE_AND_APP_BOUNDARIES.md) | Next-app på **`app.lunchportalen.no`** (Vercel); markedsføring på **`www.lunchportalen.no`** (Azure/Umbraco). |
| [environments-runtime.json](../environments-runtime.json) | `UrlOffentlig`-gruppe inkluderer `NEXT_PUBLIC_APP_URL` / `PUBLIC_APP_URL` — staging må peke konsistent etter DNS. |

**Blokkerer (repo/backlog):** **B3d** (DNS CNAME) · **B3b** (Vercel `staging` med korrekt `PUBLIC_APP_URL`) · **B3f** (smoke mot stabil URL).

**Åpent:** Hvem eier `lunchportalen.no` / `app.lunchportalen.no` nameservers og hvilken DNS-leverandør brukes.

---

### Beslutning 2 — Supabase plan-tier

| Kilde | Hva som allerede er sagt |
|-------|---------------------------|
| [staging-strategy.md](../staging-strategy.md) | **Plan-tier må bekreftes i dashboard**; anbefaling **Pro** ($25/mnd org-base) fremfor Team ($599/mnd) for staging-only; branching **$0,01344/time** per branch-compute; compute credits **gjelder ikke** branching compute. |
| MCP discovery (strategy) | Prod `hkpokyapzarefrgqzkos`, Postgres 17, branching tilgjengelig organisasjonelt — **ikke** maskinverifisert om org allerede er Pro. |

**Blokkerer:** **B3a** (provisjon/aktivering av persistert `staging`-branch) · **B3e** (staging `SUPABASE_*` URL/nøkler) · **B3f** · hele **B4**-kjeden.

**Åpent:** Faktisk plan i [Supabase billing](https://supabase.com/dashboard/project/hkpokyapzarefrgqzkos/settings/billing) — Free/Hobby vs Pro vs Team.

---

### Beslutning 3 — Budsjettcap

| Kilde | Hva som allerede er sagt |
|-------|---------------------------|
| [staging-strategy.md](../staging-strategy.md) | Indikativ **kr 470–620/mnd**; **forslag hard cap kr 800/mnd** — **krever endelig eier-OK**; Organization alerts for branching compute; TTL **72 t** for ad-hoc preview-branches; ukentlig branch-review. |
| [environments.json](../environments.json) / runtime | Ingen pengebeløp — kun valutareferanse for dokumentasjon. |

**Blokkerer:** **B3a** (compute-tier valg + alerts) · **B3b** (Vercel plan/spend notifications) · **B3e** (go-live for secrets uten økonomisk guard).

**Åpent:** Godkjenne cap, overskridelsesatferd, alert-mottakere.

---

### Beslutning 4 — `staging-abc-signoff`

| Kilde | Hva som allerede er sagt |
|-------|---------------------------|
| [staging-strategy.md](../staging-strategy.md) | Branch **`staging-abc-signoff`**, UUID `b426d8b0-6286-4a2b-850a-deb7c2ef6676`, `project_ref` **`iyrytpjacujscveivtfb`**, opprettet **2026-02-18**, `with_data: false`; Rev A sa **INACTIVE** — **korrigert til PAUSED** 2026-05-19 (se [Status](#status-per-2026-05-19)). |
| Backlog P3.V | Én persistert `staging`-branch er mål — ikke automatisk lik gjenbruk av abc-signoff. |

**Blokkerer:** **B3a** (gjenbruk vs ny branch) · **Beslutning 3** (ekstra arkiv-branch kan øke compute/lagring).

**Åpent:** Dashboard-sjekk om noen Vercel preview/env fortsatt peker på `iyrytpjacujscveivtfb`; om data er synthetic vs ekte PII.

---

## Beslutning 1 — Subdomain og DNS

### Spesifikasjon

| Element | Verdi |
|---------|--------|
| Vert | `staging.app.lunchportalen.no` |
| Record | **CNAME** → Vercel-levert target (fra Vercel → Project → Domains; typisk `cname.vercel-dns.com` eller prosjektspesifikt) |
| TTL-anbefaling | **300 s (5 min)** under innføring/rollback; **3600 s (1 t)** når stabil |
| TLS | Håndteres av Vercel etter CNAME er validert |

### Forutsetninger (krever brukerens svar)

1. Hvem eier **`lunchportalen.no`** / **`app.lunchportalen.no`** nameservers (registrar vs IT-leverandør)?
2. Hvor administreres DNS i dag (**Cloudflare**, **Azure DNS**, **Domeneshop**, annet)?
3. Finnes det eksisterende **wildcard** eller **app.***-poster som begrenser subdomene-opprettelse?

### Alternativer

| ID | Alternativ | Pro | Con | Kost (NOK/mnd, indikativ) |
|----|------------|-----|-----|---------------------------|
| **A1** | Behold eksisterende DNS-provider; legg til subdomain | Lav friksjon; ingen migrasjon | Uten API: manuell oppdatering; langsommere iterasjon | **kr 0–50** (avhengig av eksisterende avtale) |
| **A2** | Migrer DNS til **Cloudflare** (gratis DNS-tier) | API, DDoS, analytics; rask iterasjon på records | Engangsmigrasjon; **24–48 t** propagering ved bytte av nameservers | **kr 0** (DNS gratis tier) |
| **A3** | **Azure DNS** (konsolidert med Umbraco/`www`) | Én sky-leverandør for offentlige domener | Per-zone kost; skill tydelig **marketing** vs **app**-subdomener | **ca. kr 5–50/zone** + operasjonell kompleksitet |

### Reversibilitet

| Handling | Reversibilitet |
|----------|----------------|
| Fjerne/endre CNAME for `staging.app` | **Trivielt** (minutter–timer avhengig av TTL) |
| Bytte DNS-provider (nameserver) | **24–48 t** propagering; planlegg vedlikeholdsvindu |

### Anbefaling-skjema (ikke automatisk valg)

- Hvis **ukjent DNS-eier**: **STOPP** — identifiser eier og tilgangsvei **før** A1/A2/A3.
- Hvis provider har **API + team-tilgang**: **A1** er ofte raskest.
- Hvis provider er registrar-låst uten API og hyppige endringer forventes: vurder **A2** (egen vurdering).

---

## Beslutning 2 — Supabase plan-tier

### Spesifikasjon

| Element | Krav |
|---------|------|
| Database branching (persistert preview) | **Pro** eller **Team** — ikke tilgjengelig på Free/Hobby for produksjonslignende branching-flyt |
| Staging-branch compute | Valg av tier (f.eks. **Micro** ~$0,01344/time) påvirker månedlig compute-linje |
| Prod-prosjekt | `hkpokyapzarefrgqzkos` (uendret — staging er **branch**, ikke nytt prod-prosjekt) |

### Forutsetninger

1. Åpne [Supabase billing for prod-prosjektet](https://supabase.com/dashboard/project/hkpokyapzarefrgqzkos/settings/billing).
2. Noter: **nåværende plan**, om **branching** er aktivert på org, og om det finnes **usage alerts**.

### Alternativer (etter dashboard-utfall)

| Utfall | Handling | Pro | Con | Kost (NOK/mnd @ 9,3266) |
|--------|----------|-----|-----|-------------------------|
| **Allerede Pro eller Team** | Ingen plan-endring; gå til branch-provisjon (Beslutning 4 først) | Umiddelbar vei | Team kan være overkill økonomisk | **Pro base: kr 233** · **Team base: kr 5 586** |
| **Free / Hobby** | **Må** oppgradere til **Pro** for målarkitektur | Branching + kostbarhet dokumentert | Betalingskort + org-governance | **+kr 233** (Pro) |
| **Vurdere Team** | Kun hvis dokumentert behov for compliance/support eller **mange** parallelle langvarige branches | SOC2/ISO-spor | **~24×** dyrere enn Pro for staging-only | **kr 5 586+** |

**Compute-linje (én persistert micro-branch, ca. 730 t/mnd):**

- USD: $0,01344 × 730 ≈ **$9,81/mnd**
- NOK: ≈ **kr 91–93/mnd** (ekskl. disk/egress)

### Kost-implikasjon (Pro + 1 staging-branch, indikativ)

| Post | USD | NOK |
|------|-----|-----|
| Pro org-base | $25 | **kr 233** |
| 1× persistert branch (micro, full måned) | ~$10 | **kr 92** |
| **Sum Supabase (min.)** | ~$35 | **~kr 325** |

### Reversibilitet

| Handling | Reversibilitet | Datatap |
|----------|----------------|---------|
| Plan **nedgradering** | Krever sletting/deaktivering av **ekstra branches** først | Lav for staging (variant C synthetic) |
| Slette staging-branch | Reversibelt ved ny provisjon; migrasjonshistorikk gjenopprettes fra `main` | Ingen prod-påvirkning |

---

## Beslutning 3 — Budsjettcap

### Spesifikasjon

| Element | Forslag i strategy.md |
|---------|----------------------|
| Hard cap | **kr 800/mnd** aggregert (Supabase + Vercel + Sanity + DNS/add-ons) |
| Indikativ faktisk (Rev A-tabell) | **kr 470–620/mnd** uten burst |
| Buffer til cap | **kr 224–330/mnd** (avhengig av faktisk Vercel-plan) |

### Månedlig kostsammensetning (NOK @ 9,3266)

| Komponent | Lav | Høy | Merknad |
|-----------|-----|-----|---------|
| Supabase Pro base | 233 | 233 | Fast org-linje |
| Supabase staging-branch compute | 92 | 120 | Avhenger av tier/timer |
| Vercel (`staging` + ev. Pro seat) | 0 | 187 | **0** på Hobby/inkludert; **~kr 187** med Pro $20 |
| Sanity `staging` dataset | 0 | 138 | **0** innen Free; Growth ~$15/sete |
| DNS | 0 | 50 | A1/A3 avhengig |
| **TOTAL** | **~326** | **~576** | Under foreslått **kr 800** cap |

### Beslutninger som inngår (bruker må svare)

1. Aksepterer du **kr 800/mnd** som hard cap?
2. Ved overskridelse: **auto-shutdown** (pause branch), **alert only**, eller **ignore**?
3. Hvem mottar **billing-alerts** (e-post/Slack) for Supabase org og Vercel team?

### Alternativer

| ID | Cap | Pro | Con | Typisk total (NOK/mnd) |
|----|-----|-----|-----|------------------------|
| **C1** | **kr 800** (forslag) | Buffer for Vercel Pro + liten burst | Krever faktisk overvåking | **326–576** normalt |
| **C2** | **kr 500** (streng) | Tvinger minimal compute + Vercel uten Pro seat | Mindre headroom; risiko for å stoppe B5-test | **~326–450** |
| **C3** | **kr 1 500** (løs) | Rom for flere previews / høyere compute | Svakere kostdisiplin | **opptil ~900+** ved misbruk |

### Reversibilitet

| Handling | Reversibilitet |
|----------|----------------|
| Endre cap-grense | Når som helst (dokumentasjon + alerts) |
| Plan-nedgradering etter overskridelse | Leverandørvarsel typisk **1–30 dager** |

**Avhengighet:** Realistisk cap krever **Beslutning 2** (faktisk plan) og **Beslutning 4** (antall branches).

---

## Beslutning 4 — Eksisterende `staging-abc-signoff`

### Spesifikasjon

| Felt | Verdi (fra strategy.md / MCP) |
|------|-------------------------------|
| Navn | `staging-abc-signoff` |
| Branch UUID | `b426d8b0-6286-4a2b-850a-deb7c2ef6676` |
| `project_ref` | `iyrytpjacujscveivtfb` |
| Opprettet | **2026-02-18** |
| `with_data` | **false** (siste kjente) |
| Status | **PAUSED** (korrigert 2026-05-19; Rev A sa INACTIVE) |
| Kost | Avhenger av plan; inaktive branches kan fortsatt ha **lagring/compute**-linjer — verifiser i dashboard |

### Forutsetninger (bruker / dashboard)

1. Er `iyrytpjacujscveivtfb` referert i **noen** Vercel preview/staging env-variabler?
2. Inneholder branchen **ekte PII** eller kun tom/synthetic skjema? (Uten aktiv instans: **ikke maskinverifisert** i Rev A.)
3. Kreves **backup** før sletting (compliance/arkiv)?

### Alternativer

| ID | Alternativ | Pro | Con | Kost-implikasjon |
|----|------------|-----|-----|------------------|
| **D1** | **Gjenbruk** som offisiell `staging` | Beholder ev. migrasjons-historikk på branch | Navn forvirrende; hvis forurenset data → GDPR | **Én** branch-linje (~kr 92/mnd) |
| **D2** | **Dokumenter som arkiv**; opprett **ny** `staging` branch | Ren start; tydelig navn | To branches inntil arkiv slettes | **~kr 92–184/mnd** mens begge eksisterer |
| **D3** | **Slett** etter dokumentert sjekk | Lavest katalog-støy og kost | Ingen rollback til branch-innhold | **kr 0** for den branchen etter sletting |

### Anbefaling-skjema (ikke automatisk valg)

| Betingelse | Foreslått spor å vurdere |
|------------|--------------------------|
| Bekreftet **ekte PII** i branch | **D3** (+ GDPR-sletting dokumentert) |
| **Synthetic/tom** + **ubrukt** + ingen Vercel-peker | **D2** eller **D3** (eier velger risiko vs renhet) |
| **Aktivt i bruk** av preview/CI | **D1** med revisjon av navn og env |

**Hard policy (uendret):** Ingen MCP sletting/rename uten **skriftlig OK** etter valg.

### Reversibilitet

| ID | Reversibilitet |
|----|----------------|
| D1 | Re-aktivering mulig hvis branch ikke slettet |
| D2 | Arkiv kan slettes senere; ny branch kan resettes |
| D3 | **Irreversibelt** for branch-innhold — kun ny provisjon fra `main` |

---

## Beslutningenes avhengigheter

```mermaid
flowchart TD
  D2[Beslutning 2: Plan-tier]
  D4[Beslutning 4: abc-signoff]
  D3[Beslutning 3: Budsjettcap]
  D1[Beslutning 1: DNS]

  D2 --> D3
  D4 --> D3
  D2 --> B3a[B3a Supabase branch]
  D4 --> B3a
  D3 --> B3a
  D3 --> B3b[B3b Vercel staging]
  D1 --> B3d[B3d DNS]
  D1 --> B3b
  B3a --> B3f[B3f seed / smoke]
  B3b --> B3f
  B3d --> B3f
```

**Anbefalt rekkefølge for brukeren:**

1. **Beslutning 2** — verifiser dashboard (ingen forhåndsbeslutning nødvendig).
2. **Beslutning 4** — inspiser gammel branch og Vercel-pekere.
3. **Beslutning 3** — fastsett cap og alerts (med faktisk antall branches).
4. **Beslutning 1** — kan tas **parallelt** når som helst; blokkerer ikke Supabase-provisjon, men blokkerer stabil URL.

---

## Faser etter beslutninger (implementering åpen)

> **Bokstavmerknad:** [staging-strategy.md](../staging-strategy.md) og [performance-p-backlog.md](../performance-p-backlog.md) bruker **B3a = Supabase**, **B3b = Vercel**, **B3c = Sanity**, **B3d = DNS**, **B3e = env-dokumentasjon**, **B3f = seed**.

| B3-fase (repo) | Innhold | Status |
|----------------|---------|--------|
| **B3a** | Supabase staging-branch provisjon, migrasjonssync, budget alerts | **Åpen** — beslutning 2, 3, 4 lukket |
| **B3b** | Vercel `staging` git-branch + env mapping | **Åpen** — krever B3a + B3d |
| **B3c** | Sanity `staging` datasett (`4udoq5d8`) | **Åpen** — kan starte parallelt |
| **B3d** | DNS CNAME `staging.app.lunchportalen.no` | **Åpen** — beslutning 1 lukket (Domeneshop) |
| **B3e** | Env deploy-matrise (262 runtime-nøkler) | **Åpen** — etter B3a–d |
| **B3f** | `scripts/seed-staging.ts` + initial smoke | **Åpen** — sist |

| Nedstrøms | Avhengig av B3 |
|-----------|----------------|
| **B4a–B4d** | Volum-seed, CLI, verifikasjon — **blokkert** til B3f + stabil staging |
| **B5** | k6/HTTP-last — **blokkert** til B4 + staging URL |
| **Rev B** | `EXPLAIN ANALYZE` på staging — **blokkert** til B4 |

**Estimat implementering B3a–B3f:** ca. **4–8 timer** fokusert arbeid — se [Implementeringsplan](#implementeringsplan-etter-beslutninger-lukket).

---

## Implementeringsplan (etter beslutninger lukket)

Hver subfase klassifisert som **HUMAN** (manuell dashboard-handling) eller **AUTOMATABLE** (Cursor/MCP/scripts). **Ingen** av stegene under er utført per 2026-05-19 ~02:30 — utsatt til neste sesjon.

### B3d — DNS-record (Domeneshop)

- **HUMAN:** Legg til CNAME `staging.app.lunchportalen.no` → `cname.vercel-dns.com` i Domeneshop (domene.no).
- **TTL:** 3600 (1 time) når stabil; 300 under innføring om ønskelig.
- **Verifikasjon:** `dig staging.app.lunchportalen.no` eller `nslookup`.
- **Estimat:** 5–10 min + 1–4 timer DNS-propagering.

### B3a — Supabase staging-branch provisjon

- **AUTOMATABLE (delvis):** MCP `create_branch` eller manuell via Dashboard.
- **Branch-navn:** `staging` (**ikke** gjenbruk `staging-abc-signoff` / `iyrytpjacujscveivtfb`).
- **Region:** samme som prod — verifiser før opprettelse.
- **Compute size:** micro (~0,4 GB RAM; ~$0,01344/time).
- **Verifikasjon:** MCP `list_branches`, status **ACTIVE**.
- **Migrasjoner:** `supabase/migrations/` skal applies rent på ny branch.
- **Estimat:** ~5 min provisjon + ~10 min migrasjonssync.
- **Avhengighet:** Beslutning 2 (Pro) og 4 (ny branch) — **lukket**.

### B3b — Vercel staging-env

- **HUMAN:** Vercel Project Settings → Environments → legg til `staging`, eller Vercel CLI med riktige env vars.
- **Trinn:**
  1. Koble `staging` git-branch (eller avtalt PR-target).
  2. Domain-mapping `staging.app.lunchportalen.no` → Vercel deployment (etter B3d propagert).
  3. Bekreft cron/base-URL **ikke** peker på prod.
- **Estimat:** 10–15 min (+ DNS).

### B3c — Sanity staging-dataset

- **AUTOMATABLE:** Sanity CLI med write-token, eller **HUMAN** via Studio/dashboard.
- **Dataset:** `staging` på prosjekt `4udoq5d8`.
- **Kloning fra production:** valgfritt; **ingen ekte PII** (variant C).
- **Estimat:** ~5 min.

### B3e — Environment-variabel deploy

- **AUTOMATABLE:** Generer `.env.staging-template` fra [environments-runtime.json](../environments-runtime.json) (262 nøkler).
- **HUMAN:** Lim inn i Vercel staging environment; review prod vs staging vs n/a per nøkkel.
- **Estimat:** 30–60 min (mest review).

### B3f — Initial smoke + seed-staging

- **AUTOMATABLE:** `scripts/seed-staging.ts` (foundation, **ikke** B4-volum): 5–10 firma, 50–100 ansatte, 30 dagers ordrer, variant C syntetisk, ingen art. 9.
- **Smoke:** deploy til staging-URL; `GET /api/health` → 200.
- **Estimat:** 1–2 timer (script + dry-run + smoke).

### Anbefalt rekkefølge (neste sesjon)

1. **B3c** (Sanity) — parallelt, ingen blocker.
2. **B3d** (DNS) — tidlig; propagering tar tid.
3. **B3a** (Supabase branch) — før env som trenger `SUPABASE_*` for staging.
4. **B3b** (Vercel) — krever DNS + branch.
5. **B3e** (env-vars) — krever alle over.
6. **B3f** (seed + smoke) — validerer hele kjeden.

**Total estimat:** 4–8 timer fokusert arbeid. **Ikke** påbegynt 2026-05-19 etter ~17,5 t sesjon — implementering neste sesjon med fersk kontekst.

---

## Status (avsluttende)

| Felt | Verdi |
|------|--------|
| Framework opprettet | **2026-05-19** |
| Beslutninger | **LUKKET (4/4)** — 2026-05-19 ~02:30 |
| Implementering B3a–B3f | **ÅPEN** — klar for neste sesjon |
| P3.B3 beslutningsfase | **DECIDED** |
| Nedstrøms B4 | Fortsatt **blokkert** til B3f ferdig |

**Neste steg:** Følg [Implementeringsplan](#implementeringsplan-etter-beslutninger-lukket) — start med B3c + B3d parallelt.

---

## Referanser

- [docs/staging-strategy.md](../staging-strategy.md) — Rev A strategi (allerede besluttet retning)
- [docs/volume-seed-strategy.md](../volume-seed-strategy.md) — B4 avhengigheter
- [docs/environments.json](../environments.json) — 335 nøkler (full audit)
- [docs/environments-runtime.json](../environments-runtime.json) — 262 nøkler (deploy-subset)
- [Supabase pricing](https://supabase.com/docs/pricing)
