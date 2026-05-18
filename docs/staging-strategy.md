# Staging-miljø: Strategi (Rev A)

## TL;DR (anbefaling + estimert kr/mnd)

- **Beslutningsramme:** Ett **persistert Supabase-branch** (`staging`), **én Vercel `staging`**-gren med **staging.app.lunchportalen.no**, **egen Sanity `staging`-datasett** på prosjekt `f3vuhd2f`, og **kun syntetisk testdata** (ingen prod-kopi, ingen art. 9‑snapshot i seed).
- **Målekurs i dette dokumentet:** **9,3266 NOK pr. 1 USD** (ECB‑referanse via Frankfurter, observasjon **2026‑05‑15**; NB‑midtkurs bør bekreftes manuelt jf. [Kursverifikasjon](#kursverifikasjon)).
- **Indikativ månedlig kostnad (Pro + branching + ett permanent branch + ett Vercel Pro‑seat, før valutaslipp og før mva/avgifter):**
  | Komponent | USD (liste, ref.) | → NOK (× 9,3266) |
  |-----------|-------------------:|------------------:|
  | Supabase Pro org‑base ([dok.](https://supabase.com/docs/pricing)) | $25 | **kr 233** |
  | Persistert preview‑branch («Database Branching» micro, `$0.01344`/time × ≈ 730 t → **≈ $9,81**) | ~$10 | **kr 92** |
  | Vercel Pro‑plan (ref. $20/sete) | $20 | **kr 187** |
  | Sanity staging‑datasett | $0 – Growth ved behov | **kr 0 – kr 138/sete** ($15 USD, én redaksjonell bruker = én sete‑enhet hos leverandør) |

  **Grovt målintervall uten burst:** ca. **kr 470–620/mnd**. Med **budget‑cap anbefales hardt tak kr 800/mnd** inntil faktiske dashboards tall foreligger (jf. [Kostnads- og budgetguard](#kostnads--og-budgetguard)).

---

## Bakgrunn

FASE B (B4 volum‑seed, B5 last‑test, B6 materialised views) krever et **stabilt ikke‑prod** miljø som speiler prod **schema/oppførsel**, men **uten** GDPR‑risiko eller «tilfeldig ekte» kundedata.

---

## Discovery-funn (repo · Mai 2026)

| Område | Funn |
|--------|------|
| **Supabase prod** (`hkpokyapzarefrgqzkos`) | Eu‑West‑Ireland, Postgres 17 GA, MCP viser aktiv organisasjon og minst ett prosjekt. **Plan‑tier må bekreftes i Supabase‑dashboard.** |
| **Branching MCP** | Eksisterer **branch-navn `staging-abc-signoff`** (egen `project_ref`), status **inactive** ved siste MCP‑/avlesning; detaljer jf. [Eksisterende staging-abc-signoff](#eksisterende-staging-abc-signoff). |
| **`vercel.json`** | Bare **cron**‑plan; ingen custom domain‑definisjon der. |
| **`supabase/config.toml`** | Aktiver seed mot `./seed.sql` — **`supabase/seed.sql` finnes ikke** i repo (**P3 hygiene** under backlog). |
| **Sanity** | Studio har både **env‑styrt** konfigurasjon og **hardkodet** `production`/`f3vuhd2f` i undermappe; **fallback `4udoq5d8` i eldre scripts** — **P3 hygiene**, ikke løst i denne revisjonen. |
| **Env‑inventar** | **335** `process.env.*`‑nøkler observert i kildekode under `app/`, `lib/`, `middleware.ts`, `next.config.ts`, `scripts/`, `components/`, `hooks/`, `workers/`, `studio/`. Maskinlesbar full liste: [docs/environments.json](environments.json). |
| **Next.js offentlig app‑host** | Dokumentert som `app.lunchportalen.no` i arkitektur‑notater; **presis Vercel‑project binding** krever dashboard‑sjekk. |

---

## Kursverifikasjon

1. **Primærforsøk – Norges Bank**  
   - Landingsside [Valutakurser](https://www.norges-bank.no/tema/Statistikk/Valutakurser/) bekrefter at **midtkurs** publiseres ca. kl. 16:00 og at datasett finnes i åpne data.  
   - Automatiserte kall mot `api.norges-bank.no` og direkte CSV‑endepunkt returnerte **503/500** fra dokumentasjonsmiljøet (Mai 2026). **Ingen NB‑tall er derfor hardkodet uten manuell verifikasjon.**

2. **Fallback – ECB via Frankfurter** (tillatt når NB‑API feiler)  
   - `GET https://api.frankfurter.app/2026-05-16?from=USD&to=NOK` returnerte `date: 2026-05-15`, `rates.NOK: 9.3266`.  
   - **Referanse brukt i alle tabeller nedenfor:** **1 USD = 9,3266 NOK** (ikke bankens kjøps‑/salgskurs).

3. **Konverteringstabell (referanse)**  

| USD | NOK (× 9,3266) |
|----:|---------------:|
| $10 | **kr 93,27** |
| $25 | **kr 233,17** |
| $50 | **kr 466,33** |
| $100 | **kr 932,66** |
| $200 | **kr 1 865,32** |

4. **Faktura‑note:** *Reell faktura fra leverandører (Supabase, Vercel, Sanity) må rekalkuleres ved faktisk betalingsdato og kort/kreditt bankkurs; USD‑beløp i parentes skal alltid følges i regnskap.*

---

## GDPR / DPIA

### Valgt variant: **C – fullstendig syntetisk staging‑data**

**Forklaring:** Production inneholder **GDPR art. 9‑sensitive kategorier** i ordinær drift (jf. dokumentert audit‑grep): `order_items.allergens_snapshot`, `dietary_tags_snapshot` mv. beskrevet i [docs/audit-log-strategy.md](audit-log-strategy.md). Uten eksplisitt **DPO/juridisk vedtak** og **art. 6 + 9** grunnlag kan slike felter **ikke** kopieres, pseudonymiseres eller transporteres ukontrollert til ikke‑prod.

### Eksklusjoner (staging seed & fixtures)

Staging **skal ikke** fylles med:

- Alle felt klassifisert som **Art. 9‑helsedata** i audit‑matrisen (**allergener, kostholdstagger** i snapshots, eller tilsvarende profileringsfelter som dokumentert i [GDPR‑seksjonen i audit‑strategien](audit-log-strategy.md#gdpr-art-9-helsedata-risiko)).

### Ved behov om senere **pseudonymisert kopier**

Kreves **som minimum**:

1. **DPO-/juridisk konsultasjon** med skriftlig behandlingsgrunnlag (**art. 6 + 9** der relevant).  
2. **Formell DPIA** (risikovurdering: gjenkjenning, formålsbegrensning, lagring).  
3. **Retensjons‑ og slettestrategi** for staging‑datasettet (automatisert `TRUNCATE`/rotate).  
4. **Teknisk dataflyt‑review** mot RLS, backup og logg eksport.

### Ufravikelig driftregel

> **Staging skal aldri inneholde ekte personopplysninger uten gjennomført DPIA og dokumentert behandlingsgrunnlag.**

**Konsekvens for B5 last‑testing:** Alle scenarier som krever realistiske volumer må bygge på **deterministisk syntese** eller utløse en **egen DPIA‑prosess**.

---

## Eksisterende staging-abc-signoff

|MCP‑observasjon|Svar|
|---|---|
|**Navn / id**| `staging-abc-signoff`, branch‑UUID `b426d8b0-6286-4a2b-850a-deb7c2ef6676`|
|**Egne project_ref**| `iyrytpjacujscveivtfb` (sekundær preview‑instans)|
|**Opprettet**| `created_at`: **2026‑02‑18T19:46:32Z** (ISO fra `list_branches`)|
|`with_data`|**false** ved siste kjente respons|
|`preview_project_status`|**INACTIVE** (miljøet svarer ikke / er parkert)|
|**Migrasjonsdiff**| `list_migrations(project_id=iyrytpjacujscveivtfb)` avbrutt med **connection timeout** (forventet når preview er inaktiv). **Ingen skjema‑ eller rad‑diff er derfor maskinverifisert i denne revisjonen.**|
|**Formål-konklusjon**| Navnet indikerer **midlertidig sign‑off** / PR‑spor. Uten aktivert instans er det **ikke dokumenterbart** om data finnes.|

### Anbefalt **neste steg (krever eier‑OK før handling)**

| Alternativ | Når | Handling |
|------------|-----|----------|
| **A – Gjenbruk** | Formålet fortsatt relevant | Re‑aktiver branch, verifiser migrasjons‑hash mot `main`, **ingen data‑restore fra prod**. |
| **B – Erstatt** | Navn/ambiguous | Opprett ny **persistert `staging`‑branch**, dokumenter kjølebok og **parkér** `staging-abc-signoff` etter TTL‑policy — **kun etter eksplisitt eier‑godkjenning**. |
| **C – Opprydding** | Kost/risiko ønskes ned | Planlegg kontrollert sletting **etter** dokumentert kostnad/backup — **aldri automatisk eller uten eier‑OK**. |

**Hard policy denne revisjonen:** **Ingen MCP‑sletting**, rename eller pause er utført.

---

## Arkitektur-alternativer

| Alt | Beskrivelse | Typisk bruksøyeblikk |
|-----|--------------|---------------------|
|**1 Persistert staging‑branch**|Ett aktivt ikke‑prod Supabase‑miljø mappet til `staging`|B4–B6, stabile URL‑er til k6/gjestebrukere|
|**2 PR‑spesifikke preview‑branches**|Ephemeral Supabase preview per feature|Isolasjon, men kostburst & drift|
|**3 Separat Supabase‑prosjekt**|Full isolasjon|Compliance / hard multi‑tenant boundary|
|**4 Kun lokal `supabase start`**|Gratis|Utvikler‑maskin — **ikke** delt staging|

---

## Anbefaling (beslutningsbundle — **innebygd** Rev A)

1. **Supabase:** Opprett/obruk **ÉN aktiv `staging`** branch (ny eller re‑aktivisert eksisterende) — **persistert**, TTL unntatt i policy. PR‑isolate branching **utsett** til etter dokumentert ROI.  
2. **Vercel:** Strategi **A**: **Production** + **`staging`** deploy branch auto‑bygg + behold **preview** for PR‑smoke. Frem til DNS: standard `*.vercel.app`‑URL med **staging‑env‑vars**.  
3. **Sanity:** Opprett **`staging`** datasett i **`f3vuhd2f`**, **egen write‑token** + **SANITY_WEBHOOK_SECRET staging**. Aldri staging mot `production`‑dataset uten dokumentert QA‑pause.  
4. **Domene:** `staging.app.lunchportalen.no` (**CNAME** → Vercel anbefalt mål leveres ved DNS‑oppsett).  
5. **Data:** **Variant C** — `scripts/seed-staging.ts` (B3f) med syntetikk; **null** art. 9 felter.

---

## Plan-tier trade-off

| Plan | Listepris (USD) | → NOK @ 9,3266 | Relevant for branching |
|------|----------------:|---------------:|------------------------|
| **Pro** | **$25/mnd** org‑base | **kr 233** | Branching **$0,01344/branche‑time** ([Supabase pricing](https://supabase.com/docs/pricing)); **compute credits gjelder ikke branching compute** |
| **Team** | **$599/mnd** start | **kr 5 587** | Samme branching‑sats; tillegg compliance / support |

**Indikativ «persistent micro‑branch» compute‑linje alene:**  
0,01344 USD/h × 730 h ≈ **9,81 USD** → **kr 91,5** (uten disk/egress‑tillegg).

### Brytepunkt (kun kost – ingen juridisk anbefaling)

La \(C_b\) være antall **fulltids ekvivalente** samtidige micro‑branches i én måned (ca. 730 compute‑timer hver).  
Ekstra branching‑compute ≈ `0,01344 × 730 × C_b` USD.  
Når `25 + 9,81·C_b` **nærmer seg** 599 USD, blir **Team** «rent USD‑regnestykke» aktuelt — grovt når `C_b ≈ 58` **i tillegg** til basis (Pro kost allerede inkludert i org). **Anbefaling likevel:** Bli på **Pro** til faktisk behov for **SOC2/ISO**, dedikert support eller **mange** parallelle langvarige branches er **dokumentert**.

---

## Sub-task implementeringsplan (B3a–B3f)

### B3a — Supabase staging‑branch

| | |
|---|---|
|**Scope**|Etabler **aktiv** `staging` branch; koble mot Vercel `staging` env.|
|**Bestem**|Gjenbruk vs. ny branch **etter** aktivisering/avklaring på `staging-abc-signoff` (se audit‑seksjon).|
|**Migrasjon‑sync**|Målflyt: **push av `supabase/migrations`** → branching merge/rebase‑flyt dokumentert — **implementeres i senere commit**; holder her på plan.|
|**Budget alerts**|Opprett varsel i **Organization → Usage → Branching Compute Hours**, e‑post webhook til økonomi‑kontakt.|
|**Risiko**|Burst hvis TTL‑purge svikter på ad‑hoc previews.|
|**Rollback**|Pause / slett preview‑projekt (kun etter driftssjekkliste).|
|**Avhengighet**|Plan‑tier bekreftet + service‑role‑nøkkel‑rotasjon loggført.|

### B3b — Vercel `staging`

| | |
|---|---|
|**Scope**|`staging`‑gitgren + **Environment = staging** eller **Production‑slot for branch** mapping (følg Vercel UI som sannhetskilde ved implementering).|
|**Risiko**|Feil **`PUBLIC_APP_URL` / cron base** → cron treffer prod; **Cron secrets** må disables eller peke staged endpoints.|
|**Rollback**|Fjern preview/staging‑env; revert branch.|
|**Avhengighet**|Supabase URL + anon key for staging klar (B3a).|

### B3c — Sanity `staging` datasett

| | |
|---|---|
|**Scope**|Datasett `staging` i `f3vuhd2f`, CORS & tokens.|
|**Risiko**|Feil token → skriv til **prod** dataset.|
|**Rollback**|Slett datasett (etter backup av innhold) + rotér tokens.|
|**Avhengighet**|Sanity plan‑kvote.|

### B3d — Domene + DNS

| | |
|---|---|
|**Scope**|CNAME `staging.app.lunchportalen.no` → Vercel target (leveres i Vercel UI).|
|**Risiko**|Feil record → kutt / MITM‑risiko ved parallell feilkonfigurasjon.|
|**Rollback**|TTL‑revert av CNAME.|
|**Avhengighet**|B3b live.|

### B3e — Env‑var dokumentasjon

| | |
|---|---|
|**Scope**|Full **335‑post** JSON + menneskelig oppsummering (dette dokumentet).|
|**Risiko**|Glemte variabler → «works on my preview».|
|**Rollback**|Git revert (kun docs).|
|**Avhengighet**|Ingen.|

### B3f — `scripts/seed-staging.ts` (foundation for B4)

| | |
|---|---|
|**Scope**|Syntetisk: 5–10 firma, 50–100 ansatte (`@example.com`), 30 dagers ordrer, **ingen art. 9** data.|
|**Idempotent / reset**|Må støtte **re‑run** + `TRUNCATE` fallback script.|
|**Risiko**|Feil `DATABASE_URL` → skriver til feil miljø — **alltid pre‑flight `select current_database()` guard**.|
|**Rollback**|Supabase reset / trunc script.|
|**Avhengighet**|B3a.|

---

## Env var inventar

**Sannhetskilde:** [docs/environments.json](environments.json) (**335 variabler**) med kolonner: `key`, `gruppe`, `bruksomrade`, `stagingStrategi`, `prodKopi`, `rotasjonVedStagingOppsett`.

**Fordeling (heuristiske grupper)**

| Gruppe | Antall |
|--------|-------:|
| Diverse\* | 59 |
| EpostSMTP | 39 |
| BizFlagsMotorer | 38 |
| SkalaInfraGrowth | 38 |
| AiMedia | 33 |
| DevscriptsVerktoy | 18 |
| OkonomiTripletex | 18 |
| MLPOS | 18 |
| Sanity | 18 |
| WebhookIntegrasjon | 16 |
| UrlOffentlig | 9 |
| TestRCBygg | 9 |
| Supabase | 8 |
| Vercelinternt | 6 |
| SalgOgBooking | 3 |
| CronOgSystemMotor | 3 |
| Observabilitet | 2 |

\* **Merknad:** gruppen «Diverse» inkluderer **toolchain‑eksponerte nøkler** (f. eks. `PATH`, npm‑prefiks, interne tester, `DATABASE_URL` i script‑kontekst). **Operational mapping i Vercel skal ikke blindt kopiere alle 335**, men dokumentet bevisstgjør rekkevidden.

### Nøkkelklasser — **ALDRI** prod‑kopi til staging

| Variabel‑familie | Begrunnelse |
|------------------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY`, `SANITY_WRITE_TOKEN*` mot prod‑datasett | Bypass av RLS / direkte skriv |
| `CRON_SECRET`, `SYSTEM_MOTOR_SECRET`, `TRIPLETEX_*TOKEN*`, prod webhooks | Uautorisert side‑effects |
| `RESEND_*` / SMTP som sender til ekte kunder | Datalekkasje & misbruk |

### Standard rotasjon ved go‑live

Alle **HEMMELIGHETER** i tabellen over + **alle tokens merket `rotasjon: Ja`** i JSON skal **genereres på nytt** ved første **offisielle** staging‑cutover (ikke gjenbruk prod‑verdier).

---

## Kostnads- og budgetguard

| Guard | Detalj |
|-------|--------|
| **Hard cap (forslag)** | **kr 800/mnd** aggregert (Supabase + Vercel + Sanity + ev. Add‑ons) — **krever endelig eier‑OK** før budsjett låses. |
| **Supabase Organization alerts** | Slack/e‑post når *Branching Compute Hours* > definert terskel (settes i **Org → Usage**). |
| **Burst‑risiko** | Dokumentasjon: *«Compute Credits do not apply to Branching Compute»* — **glemte branches** fortsetter å koste. |
| **TTL policy** | **Maks 72 t** for **ad‑hoc** preview‑branches som ikke er `staging`. |
| **Ukentlig review** | On‑call sjekker aktive Supabase branches + Vercel preview count. |
| **Vercel spend** | Aktiver **usage notifications** + overvåk **function duration** & **bandwidth** i Pro‑team. |

---

## Risikomatrise

| Risiko | Sannsynlighet | Impact | Mitigering |
|--------|---------------|--------|------------|
| Konfig‑drift prod vs staging | Middels | Høy (feil data/tenant) | Månedlig diff av **kritiske secrets** / IaC backlog (B3‑future item) |
| Hemmeligheter lekket i preview logs | Lav | Kritisk | Separate tokens, **aldring**, log‑redaksjon |
| Staging divergerer skjemamessig | Middels | Middels | **Migrate rehearsal** hver sprint / CI gate |
| USD/NOK + branching burst | Middels | Økonomisk | Hard cap + purge policy + invoice review |
| DPIA‑brudd via feil dataflyt | Lav hvis C | Kritisk | **Hard rule:** ingen ekte PII uten DPIA |
| Sanity `projectId`‑drift i repo | Lav (bygget) | Middels | **Egen P3 hygiene commit** (ikke B3) |

---

## Rollback-strategi per fase

| Fase | Rollback |
|------|----------|
| **B3a** | Deaktiver/pause Supabase branch; fjern pekere i Vercel |
| **B3b** | Fjern `staging` env blocks; disable auto‑deploy |
| **B3c** | Slett `staging` dataset (etter eksport) + rotér tokens |
| **B3d** | Fjern CNAME / pek mot gammel URL |
| **B3e** | Git revert av docs |
| **B3f** | Kjør `TRUNCATE` / reset script |

---

## What this DOES NOT do

- Implementerer **ingen** infrastruktur eller kode.
- **Endrer ikke** `staging-abc-signoff` eller andre Supabase‑branches.
- **Rydder ikke** Sanity `projectId`‑drift (egen **P3**).
- **Kjøper ikke** domener.
- **Setter ikke** DNS eller Vercel custom domain.
- **Vedtar ikke** endelig budsjett (cap er **forslag**).
- **Inkluderer ikke** prod‑data i staging — **DPIA‑blokkert**.
- **Kjører ikke** migrasjoner eller `apply_migration`.

---

## Beslutninger brukeren må ta (eksplisitt)

1. **Godkjenne** hard **budget‑cap** (forslag **kr 800/mnd**).  
2. **Bekrefte** faktisk **Supabase plan‑tier** (Pro vs Team) i dashboard.  
3. **Velge** skjebne for **`staging-abc-signoff`** (gjenbruk / erstatte / slette) — **skriftlig OK** før MCP‑handling.  
4. **Eierskap** til DNS‑endring for `staging.app.lunchportalen.no`.  
5. **Umbraco / lunchportalen.no** forblir **utenfor** denne strategien (Azure slot egen prosess).

---

**Referanser:** [docs/performance-p-backlog.md](performance-p-backlog.md) · [docs/audit-log-strategy.md](audit-log-strategy.md) · [docs/environments.json](environments.json)
