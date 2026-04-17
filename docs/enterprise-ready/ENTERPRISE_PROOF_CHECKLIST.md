# Enterprise Proof Checklist — E0 / ubetinget enterprise-live

Dette dokumentet er **bevisfasen** for åpne punkter i `ENTERPRISE_LIVE_LIMITATIONS.md` (samme ni rader som `ENTERPRISE_LIVE_E0_CLOSEOUT_12.md`). **Produktkjernen** kan være **DONE på RC-nivå** uten at disse er lukket; **ubetinget enterprise-live** krever **bevis per punkt**.

**Regel:** Ingenting markeres **LUKKET** uten artefakt (logg, rapport, sign-off, commit-referanse, eller dokumentert beslutning) som oppfyller akseptkriteriene under.

---

## Statusregel (kort)

| Merke | Betydning |
|-------|-----------|
| **LUKKET** | Akseptkriterier oppfylt, bevis lagret, referanse i tabellen nedenfor |
| **DELVIS** | Tiltak gjort, men minst ett akseptkriterium mangler |
| **ÅPEN** | Ikke bevist |

---

## Hva som **ikke** teller som bevis

- «Det ser riktig ut» / «koden finnes» / «ingen har rapportert feil» / «det burde virke»
- Ren dokumentasjon uten kjørt test, logg eller uavhengig verifikasjon der punktet krever det
- At CI er grønn alene (når punktet krever drift, last, økonomi eller org)

Kun **faktisk verifikasjon** mot kriteriene i hver seksjon.

---

## Ikke-kode punkter (egen kategori)

Følgende løses **ikke** kun med merge til `main`: navngitt **on-call**, **kontrakt/runbook**, **backup-restore i prod**, **økonomi-QA**, **signert risikoaksept** (B1). Bevis må inkludere **navn, dato, artefakt utenfor eller ved siden av repo** (f.eks. PDF, ticket, driftssystem).

---

## 1. Worker stubs (e-post, AI, eksperiment)

**E0-kilde:** `ENTERPRISE_LIVE_LIMITATIONS.md` rad 1 · `workers/worker.ts` (stub for `send_email`, `ai_generate`, `experiment_run`).

### A. Status nå

**ÅPEN** — jobber kjører ikke ekte leveranser; se `ENTERPRISE_LIVE_E0_CLOSEOUT_12.md`.

### B. Hva som teller som bevis

Én av disse (E0 «Implementer eller fjern fra scope»):

- **Alternativ 1:** Implementasjon som viser faktisk side-effekt (sendt e-post, AI-kall, eksperiment) i kontrollert miljø, med logg/sporbarhet **eller**
- **Alternativ 2:** Fjerning/disable av jobbtyper og all bruker-/API-synlighet som antyder produksjonsleveranse, pluss dokumentert beslutning.

### C. Hvordan verifiseres

- Kodegjennomgang: `workers/worker.ts` + kø/innkøingssteder
- Kjør worker: `npm run worker:queue` (eller prosjektets dokumenterte kommando) mot testmiljø med bevis i logg
- Eller: grep/PR som viser fjernet eller feature-flagget «stub»-atferde

### D. Bevis som lagres

- Kort rapport: valgt alternativ, dato, commit-hash(er), loggutdrag eller skjermbilder av forventet effekt / avvikling
- Oppdatering av `CONTROL_PLANE_RUNTIME_MODULES` (worker-badge) hvis relevant

### E. Lukket når

**LUKKET** når valgt alternativ er dokumentert og verifisert av reviewer, og E0-raden er ikke lenger «stub uten ekte leveranse».

---

## 2. Social publish DRY_RUN

**E0-kilde:** rad 2 · `lib/cms/controlPlaneRuntimeStatusData.ts` (social **DRY_RUN**).

### A. Status nå

**ÅPEN** — ekstern publisering ikke full produksjonskoblet (E0: «Ekte integrasjon eller disable/hide»).

### B. Hva som teller som bevis

- **Alternativ 1:** Ekte integrasjon (f.eks. API-nøkler, vellykket publish til målplattform) med sporbar logg **eller**
- **Alternativ 2:** Hard disable/skjuling av bruker-synlig «publish» inntil klart (E0 + `UNCONDITIONAL_ENTERPRISE_LIVE_DECISION.md` §7).

### C. Hvordan verifiseres

- Kjør flyt som utløser social publish i staging; dokumenter HTTP-respons / logg
- Eller: verifiser at UI ikke lover ekstern publisering (kode + manuell sjekk)

### D. Bevis som lagres

- Rapport, env-/config-referanse (uten hemmeligheter i klartekst), skjermbilde eller logg

### E. Lukket når

**LUKKET** når valgt alternativ er dokumentert og badge/posture i kontrollflate er **ærlig** (ikke DRY_RUN hvis produksjon er målet).

---

## 3. Ingen lasttest

**E0-kilde:** rad 3 · «Mål-lasttest eller eksplisitt pilot-cap».

### A. Status nå

**DELVIS** — dokumentert kjøring i repo: `docs/enterprise-ready/ENTERPRISE_PROOF_LOAD_TEST.md` (lokal, `GET /api/sre/uptime` + `GET /api/health`. Produktkjerne med auth er ikke lasttestet).

### B. Hva som teller som bevis

- **Alternativ 1:** Rapport fra kjørt lasttest (verktøy, scenario, mål, resultat, tidsstempel) **eller**
- **Alternativ 2:** Skriftlig **pilot-cap** / skala-grense signert av drift/produkt (E0: fortsatt vilkår — ikke nødvendigvis «ubetinget» uten videre).

### C. Hvordan verifiseres

- Definer scope (endepunkter, RPS, varighet), miljø, og verktøy (k6, Artillery, osv.)
- Kjør test; lagre output (HTML/JSON) og kort tolkning

### D. Bevis som lagres

- Fil i repo (f.eks. `docs/enterprise-ready/evidence/`) eller ekteført arkiv — **ikke** hemmeligheter
- Dato, versjon/commit av deploy som testet

### E. Lukket når

**LUKKET** når valgt alternativ er dokumentert og akseptert som tilstrekkelig for **E0-raden** (eller eksplisitt merket som pilot-vilkår).

---

## 4. Middleware uten rolle

**E0-kilde:** rad 4 · «Full audit eller rolle-middleware». Jf. `AGENTS.md` E5: middleware skal ikke bestemme rolle-landing.

### A. Status nå

**ÅPEN** — `middleware.ts` er session-gate, ikke full rolle-encode.

### B. Hva som teller som bevis

- **Alternativ 1:** Dokumentert **audit** av muterende API-er med server-side guards + spor (jfr. `ENTERPRISE_READY_AUTH_CLOSURE.md`) **eller**
- **Alternativ 2:** Arkitekturvalg med **signert aksept** at E5 beholdes og risiko er akseptert (organisatorisk)

### C. Hvordan verifiseres

- Liste over muterende ruter, sjekkliste mot `lib/auth`/`getAuthContext`, stikkprøver i tester
- Eventuelt: revisjon av logg/audit_events for kritiske handlinger

### D. Bevis som lagres

- Rapport (tabell route → guard → test), dato, reviewer

### E. Lukket når

**LUKKET** når valgt alternativ er fullført og dokumentert i tråd med E0 **uten** å bryte låst E5 uten eksplisitt beslutning.

---

## 5. `strict: false`

**E0-kilde:** rad 5 · `tsconfig.json`.

### A. Status nå

**ÅPEN** — `"strict": false`.

### B. Hva som teller som bevis

- `strict: true` (eller tilsvarende) på applikasjonskode med **grønn** `npm run typecheck` og avklarte unntak per fil (minimal, dokumentert)

### C. Hvordan verifiseres

- `npm run typecheck` lokalt og i CI
- Liste over gjenværende `// @ts-expect-error` hvis nødvendig (med begrunnelse)

### D. Bevis som lagres

- PR/commit, CI-logg, kort notat om omfang

### E. Lukket når

**LUKKET** når strict er aktivert og typecheck er grønn (eller dokumentert unntaksmekanisme er akseptert for E0).

---

## 6. B1 — to spor uke

**E0-kilde:** rad 6 · «Konsolidering / signert aksept».

### A. Status nå

**ÅPEN** — operativ uke vs redaksjonell weekPlan (se `docs/enterprise-ready/ENTERPRISE_LIVE_E0_CLOSEOUT_12.md`).

### B. Hva som teller som bevis

- **Alternativ 1:** Produkt/arkitektur som konsoliderer eller tydeliggjør én sannhetskjede **eller**
- **Alternativ 2:** **Signert** risikoaksept (ledelse/produkt) som dokumenterer kjent desynk og ansvar

### C. Hvordan verifiseres

- Dokument + eventuell referanse til kodeendring eller runbook

### D. Bevis som lagres

- Signert notat (PDF/e-post) eller ticket med godkjenning og dato

### E. Lukket når

**LUKKET** når valgt alternativ er dokumentert og sporbar.

---

## 7. Billing hybrid uten full QA

**E0-kilde:** rad 7 · «Manuell reconciler-QA».

### A. Status nå

**ÅPEN** — økonomi-QA er prosess, ikke automatisk bevist i repo.

### B. Hva som teller som bevis

- Gjennomført reconciler-QA (definerte case, forventet beløp, faktisk resultat) signert av CFO/ops eller dokumentert i kontrollsystem

### C. Hvordan verifiseres

- Manuell gjennomgang + ev. eksport fra system og avstemming

### D. Bevis som lagres

- Sjekkliste med dato, ansvarlig, resultat (OK/avvik)

### E. Lukket når

**LUKKET** når QA er dokumentert uten åpne avvik mot definerte kriterier.

---

## 8. Backup uverifisert

**E0-kilde:** rad 8 · «Verifisert restore».

### A. Status nå

**ÅPEN** — restore ikke dokumentert som lukket i repo.

### B. Hva som teller som bevis

- Gjennomført **restore-test** (fra definert backup) til isolert miljø, med verifisert konsistens (røyktest + dato)

### C. Hvordan verifiseres

- Drift: følg leverandør/runbook (Supabase/hosting), ikke i denne filen preskribert

### D. Bevis som lagres

- Driftsrapport, ikke hemmelige tokens; tidspunkt, miljø, ansvarlig

### E. Lukket når

**LUKKET** når restore er dokumentert som vellykket.

---

## 9. Support uten navngitt on-call

**E0-kilde:** rad 9 · «Kontrakt + runbook».

### A. Status nå

**ÅPEN** — organisatorisk.

### B. Hva som teller som bevis

- Navngitt kontakt/telefon/vakt for produksjon, referert i kontrakt eller intern runbook  
- Incident-rutine (hvordan eskalere, SLA-mål hvis avtalt)

### C. Hvordan verifiseres

- Sjekk at dokument finnes og er tilgjengelig for kunde/drift

### D. Bevis som lagres

- Runbook-lenke eller PDF, versjon, dato (ikke personlige numre i offentlig repo uten vurdering)

### E. Lukket når

**LUKKET** når navngitt on-call og rutine er dokumentert og avtalt.

---

## Oppsummeringstabell (fyll ut ved fremdrift)

| # | Område | Status | Bevis-referanse (fil/ticket/dato) |
|---|--------|--------|-----------------------------------|
| 1 | Worker stubs | ÅPEN | |
| 2 | Social DRY_RUN | ÅPEN | |
| 3 | Lasttest | DELVIS | `ENTERPRISE_PROOF_LOAD_TEST.md` (lokal; ikke auth-kjerne) |
| 4 | Middleware/audit | ÅPEN | |
| 5 | strict | ÅPEN | |
| 6 | B1 uke | ÅPEN | |
| 7 | Billing QA | ÅPEN | |
| 8 | Backup restore | ÅPEN | |
| 9 | On-call | ÅPEN | |

**Kryssreferanse:** `ENTERPRISE_LIVE_LIMITATIONS.md` · `ENTERPRISE_LIVE_E0_CLOSEOUT_12.md` · `UNCONDITIONAL_ENTERPRISE_LIVE_DECISION.md`.
