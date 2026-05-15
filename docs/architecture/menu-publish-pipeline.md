# FASE 13 — Permanent publish-pipeline: `menuDay` (Sanity) → `menu_service_days` (Supabase)

Status: **Design (ingen kode)** — arkitekturvalg og estimater for en rullende, idempotent meny-horisont skalert mot 50 000 firma / 500 000 ansatte / 20 års levetid.

---

## Kontekst (dagens spor i repo-et)

| Observasjon | Kilde |
|-------------|-------|
| `menuDay`-dokumenter er modellert med unikhetsregel på **(dato, planTier, kategori)** | `studio/schemaTypes/menuDay.ts` |
| Kjernedata for avtaler/bestilling bruker **`public.company_locations`** som operativ lokasjon | Migrasjoner (`agreements`, `orders`, m.fl.) |
| Cron `week-visibility` **flipper Sanity-felt** (`customerVisible` mv.) innen datointervall — **ingen ingest til `menu_service_days`** er synlig samme sted | `app/api/cron/week-visibility/route.ts` |
| Bestilling har **CMS-gate** før skriv («meny ikke publisert») ved `getPublishedMenuForDate` | `app/api/orders/set/route.ts`, `lib/cms/menuDay.ts` |
| Postgres-trigger på `orders` forventer **én rad** `menu_service_days` per `(location_id, service_date)` med `cutoff_at` og `state` i `published` eller `locked` | `supabase/migrations/20260515120000_fix_tg_order_defaults_service_date.sql` |
| Driftsjournal peker på **tom `menu_service_days`**, evt. FK-drift mellom `locations` og `company_locations` | `docs/journal.txt` |

Dette dokumentet løfter disse punktene til en varig arkitektur: **generator → publisering → speiling til Postgres → orden → observability**.

---

## A. Schema-avklaring: `locations` vs `company_locations`

### Hva er sannhetskilden?

**Anbefalt posisjon (hard anbefaling):**

- **`public.company_locations`** er og skal forbli **operative sannhetskilde for tenant-lokasjon** i produktet (avtaler, profiler, ordre‑`location_id`, RLS, rapportering).
- Eventuell **`public.locations`** (hvis tabellen eksisterer i et gitt miljø) skal ikke brukes til nye kjedeflyter dersom den ikke har **én-til‑én deterministic relasjon** til `company_locations` med **livssykluskontroll**.

**Konsekvens for `menu_service_days`:**

- **`menu_service_days.location_id` må peke på samme verditype som `orders.location_id`**, ellers blir trigger-resolusjon («finn meny-dag fra ordre‑lokasjon») feil eller meningsløs.

### Forslag til migrasjon / cleanup

1. **Kartlegg** prod/stage: eksister kolonne `menu_service_days.location_id` → oppslag FK-katalog (`information_schema`).
2. **Dersom FK peker til `locations` uten garanti:**
   - **Alternativ A (foretrukket):** migrer FK til `company_locations(id)` + backfill-mapping (kun der **deterministisk** match finnes; remainder → manuelt triage eller «block until mapped» — fail‑closed).
   - **Alternativ B:** behold `locations` kun som **geografisk/normaliseringstabell**, men innfør **eksplisitt koblingstabell** `company_location_physical_map(company_location_id uuid PK/FK → company_locations.id, canonical_location_id uuid, …)`. `menu_service_days` peker fortsatt `company_location_id` for ordre-paritet — ikke «løfte» menytabellen ut av tenant‑modellen.
3. **Enveis sanering:** dokumenter ikke-synkroniserte legacy-rader og rydd/avvikshåndter etter aktivt operativt vindu (med audit).

---

## B. Sanity-side

### B.1 Skal `menuDay` være per (date, planTier, category) eller annet?

**Konklusjon:** Behold **`menuDay`-granularitet `(date, planTier, category)`** som canonical modell — det matcher eksisterende valideringsregel og leser-API-et.

**MIX (per dag variert tier i avtale / «Melhus MIX»)**:

- **MIX er ikke obligatorisk å kode inn som ett ekstra Sanity-planTier.** I praksis er MIX i dag **en administrativ etikett på en uke**, materialisert som **ulike `planTier`-verdier per kalenderdato** (basis vs luxus) i `menuDay`-settet — se mønster i `scripts/sanity/seed-menu-week-mix-2122.ts` (dato → daglig tier).
- For auto-rull må generatoren vite **tier per dato**. To trygge måter:
  1. **Uten først å lese firmaenes avtale:** kjøkkens «mal-uke» inneholder allerede ferdig MIX → generatoren kopierer bare forward (global meny).
  2. **Deriver fra avtale senere:** en server-side/registrert **week-key → tier-pattern** eller integrasjon til `dayTiers`-regler — men da må man unngå at et enkelt selskap overstyrer **global kjøkkens meny** uten eksplisitt produktgrep.

Dette dokumentet prioriterer (1): **kitchen template er master for tier-miks per uke**.

### B.2 Webhook eller cron-pull for sync til Supabase?

**Anbefaling: hybrid.**

| Mekanisme | Ansvar |
|-----------|--------|
| **Webhook (Sanity)** | Rekvisisjon ved `publish`/relevant patch — lav latens og «event‑driven» sporbarhet. |
| **Reconciliation cron** (f.eks. hver time + nattlig full diff) | **Idempotency + self-healing** ved tapte webhook, partial deploy eller manuelt dataset-fiks. Cron er også naturlig for **horizon extension** («rull fram N dager»). |

Begge skriver til samme worker: **«project Sanity menu days for date range» → normalize → UPSERT Postgres»** med deterministic idempotency-nøkkel (se D).

Anti-pattern her: **kun Postgres-trigger som skal «forstå Sanity JSON» direkte** — hold **domene-/serialiseringslaget i applikasjonen** eller en liten definert Edge Function der du kan gjøre hashing, revisjonspekere og struktur-validering.

### B.3 Redaktør-UI — overstyring av mal per uke

Minimum i Sanity Studio:

- **`menuWeekTemplate` (eller `menuWeekBlueprint`) dokument:** referanseuke (mandag‑ISO), MIX‑diagram (liste `dateISO → planTier`), valgfritt «note / godkjennelse».
- **«Generate horizon»-knapp (Studio action)** eller egen kontrollflate (kun `kitchen`-rolle) som:
  - instansierer konkrete `menuDay`-dokumenter for valgt horizon (deterministisk ID-strategi, se F),
  - respekterer `approvedForPublish` / `customerVisible` som **separate** fra «finnes i kjøkkensutkast».

Overstyring: **enkelt dokument `menuDay` kan divergere fra mal** («override») — reconcile-cron må aldri slette kjøkkens eksplisitt låste dager uten eksplitt policy-flagg («locked-by-kitchen»).

---

## C. Supabase-side

### C.1 `menu_service_days` FK-mål

**Konklusjon:** `location_id uuid NOT NULL REFERENCES public.company_locations(id)` (alignment med ordre-triggerens join).

Tillat evt. **`company_id` redundant denormalization** kun hvis RLS/policy og rapporter krever det — må holdes konsistent ved upsert-transaksjon (én kilde‑sannhet: lokasjonens `company_id`).

### C.2 Trigger som auto‑oppretter rader ved Sanity-publish?

**Anbefaling: nei som primærløsning.** Postgres ser ikke Sanity-publish direkte; **trusted worker UPSERT-er** ved webhook/cron.

**Valgfritt database-lag:**
- Minimal **AFTER INSERT** normalisering (dagens spor antyder eksistens av `tg_menu_service_day_defaults` i drift — dokumentert i journal) kun for **feltutfylling** (f.eks. `company_id` fra `company_locations`) — ikke for ingest-kilde.

### C.3 Partisjonering: declarative partition by `service_date`

For 20‑års drift er **rangepartition på `service_date`** anbefalt.

| Strategi | Viktige egenskaper |
|----------|--------------------|
| **Månedlige underpartisjon** | Lett rolling drop/archive etter SLA; enkel «attach/detach». |
| Kvartal / år | Færre partisjonsobjekter men grovere lifecycle. |

Operational policy‑eksempel: hold **online** siste 36 måneder, eldre i **cold tablespace / parquet export**, men behold **hash av meny-revisjon** for historisk ordre‑bevis om nødvendig.

Primærnøkkel i partisjonert verden: **`(service_date, id)` logisk** eller `id` UUID global med **`UNIQUE (location_id, service_date)`** enforced — velg én konsistent modell **før** volum.

### C.4 `cutoff_at`‑beregning: hvor regnes 08:00-regelen?

I applikasjonen er **dato-låsing for flere endpoints** forklart som **«etter 08:00 Oslo for dagens servicedato»** — `cutoffStatusForDate` dokumentert slik (`lib/date/oslo.ts`). En **annen variant 08:05** brukes for enkel **kjøkken-/batch‑flyt**.

**Klargjøring for pipeline:**

- **`cutoff_at` i `menu_service_days` må være lagret som `timestamptz`**, beregnet i **tenant-regelmotor** ved materialisering, f.eks.  
  **`service_date`** (dato) **`+`** **cutoff-clock** i **Europe/Oslo** som absolutt tidspunkt.
- Produkt‑krav må **explicit** si om **08:00** vs **08:05** gjelder for **sluttbrukers bestilling**. Hvis kodens `cutoffStatusForDate` = 08:00 er canonical for employee flows, må `menu_service_days.cutoff_at` **matche RPC/toggle-lås**, ellers oppstår sprik mellom Postgres (`cutoff_at` på rad) og app-guard.
- Fremtidssikring: cutoff kan bli **per selskap** (`agreements` eller policytabell); materialiser da `cutoff_at` **per lokasjon+service_date rad** ved upsert (ikke hardkodet i trigger alene).

---

## D. Pipeline-flyt (permanent drift)

```
Steg 1 — Kjøkken-mal (manuell)
  Redaktør publiserer/vedlikeholder meny-mal (uke / MIX-pattern) og godkjenning i Sanity.

Steg 2 — Horisont-job (cron, idempotent)
  Generer eller synk kommende `menuDay` innen mål-vindu (f.eks. 45–90 dager).
  Alle doc-ID-er og revisjoner skal kunne gjenskapes deterministisk.

Steg 3 — Postgres-speil (event + reconcile)
  Webhook eller cron henter projiserte `menuDay` for datointervaller som berører vinduet,
  UPSERT-er `menu_service_days` (+ ev. barnetabeller for items ved behov).

Steg 4 — Bestilling
  `tg_order_defaults` kobler `(location_id, service_date)` → rad;
  sanity-gate/`state` må være konsistent før brukerforsøk (fail-closed).
```

Idempotency-nøkkel (prinsipp): **`(sanity_projection_hash, menu_revision_id)`** eller **UPSERT på `(location_id, service_date)`** med `WRITE_VERSION` bumped på hver succesful sync fra CMS.

Roll-out flagg: **`state`/`locked`** må ha semantikk for «prepublisering» («draft mirror» ikke synlig til employee) kontra «published».

---

## E. Skalering: 50K × 500K × 20 år

Parametriske antakelser for **ordrekraft** — juster ved faktisk BI:

| Parameter | Forslag |
|-----------|---------|
| Aktive lokasjoner | `L` ≈ **50 000 × 2,5 snitt** ≈ **125 000** (vekting: måler du én lokasjon per bygg, øker L). |
| Servicedøgn/år lokasjon | ~**250–260** åpne kjøkkendager |
| Årlig volum nye meny-rader (`menu_service_days`) | **~L × 260** ⇒ **≈ 32 M rader / år** i worst-case «én rad alle dager».

### Lagringskost — grovt estimat

Grovt **250–450 byte/rad kompakt kjernedata** (+ TOAST ved JSON-dump av meny eller bare referanser). Ved **35M rader/år** og **350 B** ⇒ **≈ 12 GB/r** rådata før indekser (~+40–70 % overhead). **Tiår** ⇒ **tiering/obligatorisk archival**, ikke ett flatt btree.

### Spørringer / dag

**Hot path:** lokasjon + dato‑lookup ved ordre-insert (indeksert). Legg kapasitet for **burst mellom kl. 07 og 09** (typisk aktiv bestilling hos én lav enkeltprosent av ansatte på en servicedag, men med stor samtidighet i toppperioder) gjennom **PgBouncer/transaction pooling** og tilstrekkelig databasemat — unngå uhemmed «én tilkobling per request» til Postgres ved stormløp.

Indekser (konseptuelt):

- **`(location_id, service_date)`** — uniq.
- Sekundær **`(company_id, service_date)`** hvis kjøkkens dashboards filtrerer slik mer effektivt.

### Rate-limiting / pool

**Sanity API:** backoff + batch **projections**. Webhook må ikke rekursivt fetche hele dataset — bruk dokument-ID-liste eller GROQ med smalt felt-sett.

---

## F. Migrasjon fra dagens state

### Sanity-dokumenter eksisterende (15.05 + uke 21–22 m.m.)

Plan:

1. **Frys ID-konvensjon**: bruk deterministic `_id`-mønstre hvor mulig (`menuDay-{date}-{tier}-{category}` som i eksisterende seed — se script) eller hash-baserte ID-er med dokumentert regel — **kun én**.
2. **Importert historikk beholdes.** Horisont-jobben må **ALDRI** truncate CMS.
3. **Backfill Postgres** i **read-only vindu eller online** ved:
   - **Phase 1:** upsert kommende **14–30** dager (lav risiko).
   - **Phase 2:** utvid vindu incremental.
4. **Unngår nedetid:**
   - **Dual-path read** i kort vindu ikke nødvendig hvis `menu_service_days` bare brukes Postgres-side for ordre; men **employees** må fortsatt se Sanity-projeksjon eller speilet JSON — før release: bekreft at trigger finner rad **før** bred ordre-akseptanse.
   - Aktiver **alarm** før cutover («horizon depth < SLA»).

### `menu-publish` kontrollpunkt

Når eksisterende `POST /api/superadmin/menu-publish` er audit-stub, skal reel implementasjon først bekrefte at den **kun** kjører med **least privilege** tokens og ikke bryter **frozen superadmin-health** rutiner om de er knyttet samme gren — planlegges som separat hardened route med rid + audit (**utenfor selve dokumentet å endre akkurat her**).

---

## G. Tester

### G.1 E2E («Sanity publish → Postgres → ordre lykkes»)

1. Opprett/oppdater **`menuDay`** med godkjennings-flagg konsistent gate.
2. Simuler webhook/cron ingest → bekreft **UPSERT**.
3. Kall **order-write** gjennom faktiske API-er med autentisk profil/rolle fixture.
4. Verifiser at `orders.menu_service_day_id` og **`cutoff_at`** fylles av trigger-logikk.

Automatisering staging: må bruke isolert Sanity dataset eller «document namespace» + cleanup job.

### G.2 Skalerings-test (k6) — peak traffic

Profiler:

- Burst **samtidige /orders/set eller tilsvarende** mot representativ geografisk konsentrasjon.
- Mål: **latency p95/p99**, **Pg connection queue**, og **ingen deadlocks på upsert-hotspots** (splitt rekkefølge og bruk deterministic upsert rekkefølge etter lokasjon-shard).

Lag syntetiske **selskaps-/lokasjons-klynger**, ikke naive random — prod-lignende hotspots.

---

## Oppsummering av anbefalte arkitekturvalg

1. **`company_locations` FK** på `menu_service_days`; rydd evt. journalførte (`docs/journal.txt`) avvik mot `locations`.
2. **`menuDay` beholdes** som `(date, planTier, category)`; MIX = **pattern per dato på mal‑nivå**, ikke blandet ordre-semantikk i Postgres-raden.
3. **Hybrid Sanity → worker → UPSERT Postgres** (+ reconcile cron); ingen «magisk Postgres-only Sanity».
4. **Partisjonér på `service_date`** + arkiveringspolicy tidlig — før kombinasjon av **år × millioner av rader** gjør naive fullscan og indeks‑vedlikehold kritisk dyrt.
5. **Horizon-monitor:** alarm om antall kommende servicedager under terskel per lokasjon *eller* aggregert KPI (vekting etter onboarding-states).
6. **Cutoff konsistens**: én dokumentert canonical rule for employee flows; **`cutoff_at` materialisert matcher den**, og ev. kjøkkens egne vinduer dokumenteres separat («08:05 batch» mv.).

—

*Dokumentert som del av FASE 13-DESIGN. Neste konkrete sprint bør konsolidere måltall (faktiske L og servicedager) før migrasjonsskript dimensjoneres.*
