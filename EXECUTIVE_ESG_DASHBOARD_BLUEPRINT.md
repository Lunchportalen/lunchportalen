# 🌱 LUNCHPORTALEN – EXECUTIVE ESG DASHBOARD BLUEPRINT

Dette dokumentet definerer hvilke ESG-relaterte KPI-er og indikatorer
som skal vises i Executive ESG Dashboard.

Formål:

- Dokumentere målbar bærekraftseffekt
- Gi styret oversikt over miljøpåvirkning
- Støtte konsernrapportering
- Knytte teknisk struktur til ESG-verdi

Dashboardet skal være:

- Enkelt
- Datadrevet
- Reviderbart
- Forankret i faktiske ordredata

---

# 1️⃣ OVERORDNET STRUKTUR

Dashboardet skal ha 5 hovedseksjoner:

1. Matsvinn & Ressurseffektivitet
2. Volumforutsigbarhet
3. Bærekraftsrapportering
4. Systemintegritet
5. Strategiske ESG-indikatorer

---

# 2️⃣ MATSVINN & RESSURSEFFEKTIVITET

## 2.1 Estimert Matsvinnreduksjon (%)

Viser:
- Reduksjon i estimert overproduksjon etter implementering.

Måling:
Baseline vs strukturert bestillingsmodell.

Fargekode:
🟢 > 10%
🟡 5–10%
🔴 < 5%

---

## 2.2 Overproduksjonsvarians

Viser:
- Varians mellom bestilt og produsert volum.

Mål:
Synkende trend over 12 måneder.

---

## 2.3 Avbestillingsrate før cut-off

Viser:
- % avbestillinger før 08:00.

Mål:
> 95%

Dette gir:
- Mindre matsvinn
- Bedre planlegging

---

# 3️⃣ VOLUMFORUTSIGBARHET

## 3.1 Daglig Volumstabilitet

- Standardavvik i ordrevolum
- Ukentlig trend

Mål:
Redusert varians over tid.

---

## 3.2 Prognosenøyaktighet (AI)

- Avvik mellom prognose og faktisk volum

Mål:
< 10% avvik

---

## 3.3 Kapasitetsutnyttelse

- % av planlagt kapasitet brukt

Mål:
80–95%

---

# 4️⃣ BÆREKRAFTSRAPPORTERING

## 4.1 ESG-rapportbruk

- % firma som eksporterer ESG-rapport
- Antall konsern med integrasjon

---

## 4.2 Historisk Effekt

- 12-måneders trend
- 24-måneders trend

Graf:
- Matsvinnreduksjon
- Volumstabilitet

---

## 4.3 ESG-eksport

- CSV/API-eksport antall
- Integrasjon med ESG-system

---

# 5️⃣ SYSTEMINTEGRITET (FOR ESG-DATA)

## 5.1 Dataintegritet

- 100% av ESG-data basert på faktiske orders
- 0 manuelle justeringer

---

## 5.2 Tenant-isolasjon

- 0 cross-tenant anomalies
- test:tenant status

---

## 5.3 Audit-logg

- Antall ESG-relaterte mutations
- Alle logget via ops_events

---

# 6️⃣ STRATEGISKE ESG-INDIKATORER

## 6.1 Bærekraftsengasjement

- % aktive firma
- % firma med > 6 mnd historikk

---

## 6.2 Gårdeierindikator

- Antall bygg som bruker strukturert modell
- Redusert behov for kantineinfrastruktur

---

## 6.3 Switching Cost Indicator

- Historisk data per firma
- Integrasjonsgrad

---

# 7️⃣ VISUALISERINGSPRINSIPP

Dashboardet skal bruke:

- Trafikklys (Grønn / Gul / Rød)
- 12-måneders trendlinjer
- Sammenligning mot baseline
- Ikke overkompliserte grafer

Det skal kunne forstås på 1 minutt.

---

# 8️⃣ STYRE-RAPPORTERING

Kvartalsvis rapport skal inkludere:

- Matsvinnreduksjon %
- Volumforutsigbarhet
- ESG-rapportbruk
- Systemintegritet
- Strategisk utvikling

---

# 9️⃣ IMPLEMENTASJON

Data hentes fra:

- orders
- kitchen_snapshots
- ops_events
- pre-aggregated ESG tables

Dashboard kan bygges i:

- Admin-panel
- Intern BI
- Grafana/monitoring

---

# 🔟 KONKLUSJON

Executive ESG Dashboard skal:

- Dokumentere reell bærekraftseffekt
- Knytte struktur til miljøverdi
- Støtte konsernrapportering
- Gi styret kontroll

Bærekraft er et resultat av struktur.
Dashboardet gjør effekten synlig.
