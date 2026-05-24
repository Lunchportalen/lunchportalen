# ESG Engine Design — Lunchportalen

**Date:** 2026-05-26  
**Mode:** READ-ONLY strategic design (no schema implementation)  
**Status:** Phase 1 complete · Phases 2–4 pending **GO**  
**Cross-ref:** [AI Feature Inventory Phase 1](./ai-feature-inventory-2026-05-26.md) · [ESG KPI Framework](../../ESG_KPI_FRAMEWORK.md) · Audit v2 Fase C (ESG schema drift)

---

## §1 Executive summary

Lunchportalen har en **strukturell matsvinn-reduserende mekanisme** som er vanskelig for tradisjonelle catering-leverandører å etterligne: ansatte avbestiller i tide → leverandør produserer mindre → mindre svinn og lavere Scope 3 for kunden. Dette er **systematisk og målbar**, ikke markedsføring.

**Gap i markedet:** Store kantineaktører (ISS, Compass/Eurest, Sodexo) har sterke **leverandør-side** ESG-narrativer (EcoVadis, Winnow, gram/gjest), men **ingen** tilbyr kunden **per-tenant, ordre-basert, CSRD-klar dokumentasjon** av avbestillingsdrevet reduksjon. Lokale aktører selger «ingen binding / betal kun det dere spiser» uten **verifiserbare KPI-er**.

**Lp unike vinkel:** Måle og rapportere **unngått produksjon** (avbestillinger før cut-off) som **kg mat spart**, **kg CO₂e spart** og **kr spart** — per kunde, aggregert og eksporterbar til CSRD/ESRS E5/E1.

**Eksisterende grunnmur i repo (pre-design):**

| Asset | Status | Note |
|-------|--------|------|
| `lib/ai/wasteTracker.ts` | Prod-ready (Type C) | Fail-closed uten produksjonsdata |
| `lib/ai/demandEngine.ts` | Prod-ready (Type C) | Moving-avg forecast; ML Layer 3 kandidat |
| `ESG_KPI_FRAMEWORK.md` | Konseptuell | KPI-definisjoner, ikke DB |
| `esg_monthly` / `esg_daily` | **Dropped** | `20260522160000_k4_kill_esg_tables.sql` — må re-etableres med nytt skjema |
| Backoffice ESG UI spec | Dokumentert | `/backoffice/esg` — superadmin read-only |
| AI-012 / AI-013 | Inventory | Direkte cross-ref til Phase 4 ML |

**Tidslinje til synlig kunde-impact (estimat etter GO):**

| Milepæl | Uke | Leveranse |
|---------|-----|-----------|
| Data foundation (DC-100–107) | 0–4 | Emission factors + order lifecycle + KPI rollups |
| Customer dashboard live | 5–8 | `/admin` eller `/dashboard/baerekraft` |
| Public impact-side | 8–10 | Umbraco + `lp_aggregate_kpis_monthly` |
| Auto-CSR PDF + CSRD mapping | 10–12 | Enterprise sales enabler |
| ML Layer 3 (no-show forecast) | 12+ | Ytterligere reduksjon, ikke blocker for v1 |

**Anbefaling:** Phase 2 (data foundation) er kritisk path. Uten `order_lifecycle` + `emission_factors` er all ESG-rapportering narrative-only.

---

## §2 Market + regulatory landscape (Phase 1)

### 2.1 Konkurrentmatrise — norsk B2B catering

**Metodikk:** Skår 1–5 per dimensjon; **ESG-kapabilitet-skår** = vektet snitt (matsvinn-KPI 30 %, CO₂e 25 %, tredjepartsverifisering 20 %, per-kunde-rapportering 15 %, salgsargument 10 %).

| # | Konkurrent | Sustainability-side / rapport | Rapporterte KPIs | Tredjepart | Per-kunde ESG | Salgsargument | **ESG-skår** |
|---|------------|------------------------------|------------------|------------|---------------|---------------|--------------|
| 1 | **ISS Catering Norge** | [issworld.com/nb-no sustainability](https://www.issworld.com/nb-no/innsikt/innsikt/sustainability) | Matsvinn g/gjest (26 g vs 59 g baseline 2019, −56 % NO); global −30 %; CO₂e/kcal mat (−19 % NO); 50 % waste target 2027 | **EcoVadis Gold** (2024); KuttMatsvinn-pris | Aggregert kantine; Winnow AI per site — **ikke kunde-dashboard** | Sterkt i anbud; «halverte matsvinn» | **4.2** |
| 2 | **Compass Group / Eurest Norge** | [compass-group.no/baerekraft](https://www.compass-group.no/no/baerekraft) | Scope 3 mat 96 % av utslipp; matsvinnmåling siden 2011; klimamerking av menyer; net-zero 2050 | **Svanemerket** (kantine); KuttMatsvinn2020 | Intern måling; kunde får narrativ, **ikke ordre-granular data** | «Første svanemerkede kantine»; CSRD Scope 3 narrative | **3.8** |
| 3 | **Sodexo Norge** | Global Sodexo sustainability reports | −50 % food waste 2014–2019 globalt; WasteWatch | EcoVadis (konsern) | Site-level, ikke employee booking-data | Bærekraft i anbud | **3.5** |
| 4 | **Lunch.no** | Ingen dedikert ESG-side funnet | Miljøfyrtårn-sertifisering (bransjestandard); LUMA-bærekraftsverktøy | **Miljøfyrtårn** | Nei | Pris/fleksibilitet, ikke ESG-dashboard | **2.0** |
| 5 | **Foodora for Business** | [foodora.no/corporate](https://www.foodora.no/corporate) | «Betal kun det som bestilles»; WFP-donasjon (ShareTheMeal) | Delivery Hero ESG (konsern) | Bedriftsportal budsjett — **ingen CO₂e/matsvinn-KPI** | Kostnadskontroll, fleksibilitet | **1.8** |
| 6 | **Oslo Lunsj** (lokal) | [oslolunsj.no](https://oslolunsj.no/) — bærekraft copy | «Ingen matsvinn» via pay-per-day; kortreist/øko | Ingen | Nei — **claim uten måling** | «Betal kun det dere spiser» | **2.2** |
| 7 | **Lille Persille** (Oslo/STVG/TRD) | [lillepersille.no](https://lillepersille.no/) | Fleksibel kansellering; vegetar/vegan; bærekraft copy | Ingen | Nei | Sen frist, redusert svinn (prosess) | **2.0** |
| 8 | **Matspecialen** (Oslo) | [matspecialen.no/miljo-og-klima](https://www.matspecialen.no/miljo-og-klima) | Energi −10 %, emballasje −20 %, 0 % palmeolje; el-bil | **Miljøfyrtårn**; Grønt Punkt | Nei | HMS/miljø i anbud | **2.5** |
| 9 | **Trondheim Catering** | [trondheimcatering.no/samfunnsansvar](https://trondheimcatering.no/samfunnsansvar-baerekraft/) | Sesong/lokal; SDG-integrasjon (Spektrum); Miljøfyrtårn | **Miljøfyrtårn** | Nei | Arrangement/catering, ikke employee booking | **2.3** |
| 10 | **Cateran / Spis Bra / Eat / Yum Yum** | Begrenset/offentlig info | Generisk «bærekraftig catering» der funnet | Ukjent / ingen | Nei | Lokal tilstedeværelse | **1.5** |

#### Konklusjon — hvor er gapet?

| Dimensjon | Konkurrenter | Lunchportalen (design) |
|-----------|--------------|------------------------|
| **Datagrunnlag** | Kjøkken-produksjon vs tallerken (leverandør POV) | **Ordre-lifecycle** (kunde POV): booked → cancelled_in_time → consumed/wasted |
| **Granularitet** | g/gjest per kantine | **Per ansatt-bestilling**, per tenant, per dag |
| **CO₂e** | Menyklimamerking (Compass), Cool Food Pledge (ISS) | **Emission factor per menu_item** × unngått produksjon |
| **Rapportering** | Årsrapport / EcoVadis / Svanemerket | **Månedlig auto-CSR PDF** + API + CSRD ESRS mapping |
| **Verifisering** | Tredjepart på *leverandør* | Metodologi-audit + EcoVadis/B-Corp på *Lp* (Phase 4) |

**Lp unike vinkel (salgsbar):**

> «Vi dokumenterer ikke bare at *vi* kaster mindre — vi dokumenterer at *dere* unngår mat dere ikke spiser, med kg, CO₂e og kroner, klart for bærekraftsrapporten.»

Dette adresserer **kundens Scope 3 Category 1 (Purchased goods)** uten at kunden må gjette catering-svinn.

---

### 2.2 Regulatorisk landskap

#### A) CSRD — Corporate Sustainability Reporting Directive (Norge/EØS)

**Gjennomføring:** Prop. 57 L (2023–2024) → endringer i regnskapsloven. Norge implementerte trinnvis innføring fra regnskapsåret 2024.

| Bølge | Opprinnelig plan | Status mai 2026 (Omnibus / Stopp-klokken) |
|-------|------------------|---------------------------------------------|
| **2024 → rapport 2025** | Store børsnoterte + 500+ ansatte (PAI) | **Uendret** — rapporterer fortsatt |
| **2025 → rapport 2026** | Alle store foretak (>250 ans / €40M omsetning / €20M balanse) | **Utsettelse +2 år** for mange — første rapport 2028 for regnskapsår 2027 |
| **2026 → rapport 2027** | Noterte SMB | **Unntatt** fra plikt |
| **Fra 2027** | Nye terskler (Omnibus): ~1000 ans + €450M omsetning | Kun **~120–160 norske foretak** estimert vs ~1200 tidligere |

**Kilder:** [regjeringen.no bærekraftsrapportering](https://www.regjeringen.no/no/tema/okonomi-og-budsjett/finansmarkedene/barekraftsrapportering/id3059140/), [KPMG CSRD Norge](https://kpmg.com/no/nb/innsikt/barekraft-esg/csrd-betydning-norske-virksomheter.html), [Sticos Omnibus feb 2026](https://www.sticos.no/fagstoff/forslag-om-store-lettelser-i-baerekraftsrapportering).

**Matsvinn under CSRD:** Ikke eget avsnitt — faller under **ESRS E5** (resource use, waste streams inkl. food waste der material) og indirekte **E1** (GHG). Kunder rapporterer **egne** waste streams og Scope 3; Lp-data er **input til Category 1 purchased food & beverages**.

**Per ansatt vs aggregert:** ESRS krever **aggregert** på foretaksnivå med valgfri nedbrytning. Lp bør levere **begge**: tenant-total + valgfri normalisering (per FTE, per måltid).

#### B) Norsk åpenhetsloven (2021-06-18-99)

**Omfattelse:** Norske «større» virksomheter (typisk 2 av 3: 50 årsverk, 35M balanse, 70M omsetning).

**Krav:** Aktsomhetsvurderinger (OECD), årlig redegjørelse (innen 30. juni), informasjonsplikt (svar innen 3 uker).

**Relevans for Lp:** Primært **S1 / arbeidsforhold i verdikjede** — ikke matsvinn direkte. Lp kan likevel støtte kundens leverandørkjede-dokumentasjon:

| Åpenhetslov-krav | Lp-støtte |
|------------------|-----------|
| Kartlegge leverandører | Lp som **mat-leverandør** — kunde kan referere til Lp metodologi-side |
| Negative konsekvenser (HMS) | Lp egne ansatte (S1) — **begrenset** for ESG-engine |
| Informasjonskrav §6 | Lp kan publisere **metodologi + aggregate KPIs** offentlig |

**Strategisk:** Åpenhetsloven er **sekundær** vs CSRD for ESG-engine; CSRD/ESRS er primary enterprise hook.

#### C) GHG Protocol — Scope-kobling

```
Kundens Scope 3 Cat.1 (Purchased food)
        ↑
        │  Lp-leveranse = faktisk produsert & levert mat
        │
Lp Scope 1/3 (leverandør-side produksjon) — IKKE Lp KPI
        ↑
Lp Scope 3 (Lp som plattform: cloud, transport til kunde)
```

**Lp ESG-engine fokus:** Måle **unngått Scope 3 hos kunden** via timely cancellation — dette er **negative emissions / avoided impact**, ikke Lps egne utslipp.

**Rapporteringsposisjon:** Kommuniser som **«avoided emissions from prevented overproduction»** med transparent metodologi (ikke net-off mot kundens faktiske utslipp uten auditor-avklaring).

#### D) ESRS mapping — hva Lp kan levere

| ESRS | Disclosure | Lp KPI / data | Dekning | Mangler |
|------|------------|---------------|---------|---------|
| **E1-6** | Gross Scope 1, 2, 3 GHG | kg CO₂e spart (cancelled-in-time × emission factor) | **Delvis** — støtter kundens Scope 3 Cat.1 dokumentasjon | Kundens *faktiske* innkjøpte utslipp (leverte måltider); Lp leverer *avoided* supplement |
| **E1-4** | Climate targets | Trend MoM/YoY waste & CO₂e reduction | **Delvis** — KPI-13 trends | Kundens egne science-based targets |
| **E5-3** | IRO resource use / circular economy | kg mat spart; cancellation rate; waste % | **Sterk** — kjernevalue prop | Full waste composition (E5-5) for kundens *egne* kantine-rest |
| **E5-5** | Waste from own operations | meals_wasted (noshow, leftover) hvis registrert | **Delvis** | Krever kjøkken production data (AI-013 path) |
| **E5-4** | Resource inflows | Meny-sammensetning → emission categories | **Fremtidig** — ingredient_categorization | Full mass-balance per ingredient |
| **S1** | Own workforce | — | **Ikke relevant** for ESG-engine v1 | Lp HR-system |

#### E) EU Taxonomomi (2020/852)

**Relevante aktiviteter for catering/lunsj:**

| Aktivitet | Relevans | Lp-data |
|-----------|----------|---------|
| **6.x Manufacturing / services** (low-carbon services) | Indirekte | Dokumentert reduksjon i ressursbruk |
| **Climate mitigation** (substantial contribution) | Via matsvinn-reduksjon (SDG 12.3) | kg mat/CO₂e spart |
| **DNSH** (Do No Significant Harm) | Kunde må vurdere selv | Lp metodologi + auditor note |

**Praktisk:** Taxonomi-rapportering krever **omsætnings/KPI-andel** knyttet til taxonomy-aligned activities. Lp kan levere **underlagsdata** («X % av catering-innkjøp hadde dokumentert waste avoidance via bestillingsplatform») — ikke full taxonomy classification uten kundens CFO.

---

### 2.3 Datafundament — autoritative kilder

#### Norsk matsvinn (baseline for sammenligning)

| Kilde | Nøkkeltall | Bruk i Lp |
|-------|------------|-----------|
| **Matvett / NORSUS 2024** | Servering ~**26 kg/innbygger/år**; total matsvinn ~451 000 tonn (2023) | Industri-baseline for KPI-11/KPI-12 (typisk 10–15 % catering-svinn) |
| **Bransjeavtale Klima- og miljødep. 2017/2022** | 50 % reduksjon innen 2030 (SDG 12.3) | Narrativ + offentlig impact-side |
| **Matsentralen** | Distribusjon per sektor | Benchmark context |
| **SSB matforbruk** | Makrotall | Normalisering per capita |
| **NIBIO** | Policy/rapporter | Metodologi-referanse, ikke driftsdata |

**Lp baseline-antagelse (design):** Tradisjonell fast catering = **10–15 % overproduksjon/svinn** uten ordre-styring. Lp måler **avvik fra dette** via cancellation-in-time rate × porsjonsvekt.

#### Emission factors — kildevurdering

| Kilde | Dekning | Eksempeltall (verifisert mot publiserte utdrag) | Sikkerhet | Lisens / kommersiell bruk | **Best fit Lp** |
|-------|---------|--------------------------------------------------|-----------|---------------------------|-----------------|
| **Norwegian LCA Food DB v01** (NORSUS/RISE) | 750+ produkter, norske LCA | Lam **22,9 kg CO₂e/kg**; svin **4,5 kg/kg**; (100g-basis i [NorEden extract](https://www.med.uio.no/imb/forskning/prosjekter/nor-eden/dokumenter/extract-of-norwegian-lca-food-database.pdf)) | **Høy** (ISO LCA) | Akademisk utdrag OK; full DB via **RISE lease** | **Primær** — norske forhold |
| **RISE Food Climate Database (NO)** | 720+ produkter, 1300 chains | Totalt kg CO₂e/kg; oppdateres årlig | **Høy** | **Ikke open** — individuelle faktorer kan ikke redistribueres; *beregnet måltid OK* | **Primær** (licensed) |
| **Klimakost / Meny/KIWI** | Forbruker-app, norske varer | Per produkt i app | Medium–Høy | Kommersiell via NorgesGruppen/RISE | Indirekte — samme DB |
| **EAT-Lancet / Planetary Health Diet** | Globale benchmarks | Storfekjøtt ~**27 kg CO₂e/kg**; kylling ~**6 kg/kg**; vegetarmåltid ~**1,5 kg/porsjon** | Medium (global) | Open research | **Fallback** + sanity-check |
| **DEFRA UK 2024** | UK food factors | Beef ~27 kg/kg; chicken ~5,8 kg/kg | Medium (UK context) | Open Government Licence | Sammenligning / backup |
| **ASSET / JRC EU** | EU food database | Harmonized LCA | Medium–Høy | EU open data | EU-kunder |
| **Carbon Cloud** | Kommersiell SaaS | Product-specific | Høy (produkt) | **Betalt** API | Premium tier senere |

#### Anbefalte standard-porsjoner (design defaults — må seedes med kilde)

| Kategori | kg CO₂e/kg | kg CO₂e/porsjon (400g lunch est.) | Kilde |
|----------|------------|-----------------------------------|-------|
| Storfekjøtt | ~27 | ~10,8 | EAT-Lancet / DEFRA (verify RISE for NO: ~36,6 per 100g = ~36 kg/kg i enkelte NO cuts) |
| Kylling | ~6 | ~2,4 | EAT-Lancet |
| Svin | ~4,5 | ~1,8 | Norwegian LCA v01 |
| Fisk (torskefilet) | ~3–5 | ~1,2–2,0 | RISE NO |
| Vegetar (blanding) | ~1–2 | ~0,8–1,5 | EAT-Lancet / RISE |
| Vegan | ~0,5–1,5 | ~0,5–1,0 | RISE / DEFRA |

**Viktig metodologi-valg:**

1. **Fase 1 seed:** Kategori-nivå (`beef`, `chicken`, `vegetarian` …) fra Norwegian LCA + EAT-Lancet fallback.
2. **Fase 2:** Sanity → RISE lease for produktnivå.
3. **Kommunikasjon:** Alltid «estimat basert på [kilde], versjon [X], revidert [dato]» — aldri presisjon uten confidence flag.

#### Lisensieringsanbefaling

| Tier | Kilde | Kostnad | When |
|------|-------|---------|------|
| **MVP** | EAT-Lancet + Norwegian LCA v01 public extract + DEFRA | Gratis | DC-100 seed |
| **Production** | RISE Food Climate Database lease | Årlig fee + helpdesk | Før enterprise CSR PDF |
| **Premium** | Carbon Cloud API per SKU | Per call | Når Sanity menu har ingredient-level weights |

---

### 2.4 Cross-ref — eksisterende Lp-kode og AI-inventar

| Inventory ID | Modul | ESG-engine rolle |
|--------------|-------|------------------|
| **AI-012** | `demandEngine.ts` | Modell B (menu popularity); kitchen planning |
| **AI-013** | `wasteTracker.ts` | KPI-04/05; `meals_wasted` når production registered |
| **AI-001/005** | CMS menu AI | Modell D (ingredient categorization) — **Phase 4** |
| **K4 kill** | `esg_monthly` dropped | **Nytt skjema required** — ikke gjenbruk gammel migrasjon |

**Schema drift warning (audit Fase C):** Tidligere `esg_monthly` hadde konkurrerende shapes (`month` date vs text `YYYY-MM`). Ny design **må** bruke `period_date date` + `period_month text generated` for unambiguous rollups.

---

## §3 Data foundation architecture

> **Status:** Pending **GO Phase 2**  
> Planned: SQL CREATE TABLE (6 entities), RLS, compute functions, triggers, Sanity workflow, ER diagram.

---

## §4 Customer surface + KPI definitions

> **Status:** Pending **GO Phase 3**  
> Planned: 13 KPIs, dashboard wireframe, public impact-side, auto-CSR PDF spec, ESRS mapping table.

---

## §5 AI/ML optimization

> **Status:** Pending **GO Phase 4**  
> Planned: 4 ML models, decision matrix, cross-ref AI-012/013/D.

---

## §6 90-dagers DC-ticket roster

> **Status:** Pending **GO Phase 4**  
> Planned: DC-100–132 (~600t).

---

## §7 Tredjepart-verifiseringsstrategi

> **Status:** Pending **GO Phase 4**  
> Planned: EcoVadis → B-Corp path.

---

## §8 Cross-link til AI-inventar

> **Status:** Pending **GO Phase 4**  
> See [ai-feature-inventory-2026-05-26.md §2](./ai-feature-inventory-2026-05-26.md) for full AI-012/013/D detail.

---

## Phase 1 verification checklist

- [x] 10 konkurrenter med ESG-kapabilitet-skår
- [x] Gap-analyse og Lp unike vinkel
- [x] CSRD tidslinje (inkl. Omnibus/Stopp-klokken mai 2026)
- [x] Åpenhetsloven mapping
- [x] GHG Scope 1/2/3 kobling
- [x] ESRS E1/E5/S1 mapping
- [x] EU Taxonomi note
- [x] Matsvinn autoritative kilder (Matvett/NORSUS)
- [x] Emission factor kilder med lisens og eksempeltall
- [x] Cross-ref AI-inventar + eksisterende Lp ESG code
- [x] READ-ONLY — ingen schema/kode endret

---

**STOP — Phase 1 complete.**  
Vent **`GO Phase 2`** for data foundation architecture (§3).
