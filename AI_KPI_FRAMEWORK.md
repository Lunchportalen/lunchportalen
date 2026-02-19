# 🤖 LUNCHPORTALEN – AI KPI FRAMEWORK

Dette dokumentet definerer KPI-er for AI-funksjoner i Lunchportalen.

AI i Lunchportalen er:

- Intern
- Kontrollert
- Ikke beslutningstagende
- Ikke synlig som selvstendig produkt
- En optimaliseringsmotor

AI skal måles på:

- Presisjon
- Verdi
- Sikkerhet
- Stabilitet
- Arkitekturintegritet

---

# 1️⃣ AI MÅLSETTING

AI skal:

- Redusere matsvinn
- Øke forutsigbarhet
- Forbedre kapasitetsplanlegging
- Gi bedre rapportering
- Øke operasjonell effektivitet

AI skal ikke:

- Endre brukerbeslutninger
- Overstyre avtaler
- Skape unntak
- Introdusere fleksibilitet

---

# 2️⃣ PRIMÆRE AI-KPIER

## 2.1 Prognosenøyaktighet

Måler:
- Avvik mellom prognose og faktisk ordrevolum

Formel:
|prognose - faktisk| / faktisk

Mål:
- < 10% avvik etter modellmodning

---

## 2.2 Matsvinnreduksjon

Måler:
- Endring i estimert overproduksjon før/etter AI

Mål:
- 5–15% reduksjon innen 12 måneder

---

## 2.3 Kapasitetsoptimalisering

Måler:
- Antall dager med over-/underkapasitet

Mål:
- Redusere ekstreme topper og bunner

---

## 2.4 ESG-rapportkvalitet

Måler:
- Andel firma som bruker ESG-rapport
- Datakonsistens
- Forklarbarhet

Mål:
- 100% sporbar modellgrunnlag

---

# 3️⃣ SIKKERHETS- & ARKITEKTUR-KPIER

AI må aldri kompromittere arkitektur.

## 3.1 Write-path Integrity

Mål:
- 0 AI-funksjoner som skriver direkte til kritiske tabeller

Måling:
- CI guard
- Repo scan

---

## 3.2 Determinisme

Mål:
- 100% av AI-output er read-only eller eksplisitt lagret

AI skal aldri:
- Endre avtale
- Endre cut-off
- Endre rolle

---

## 3.3 Auditability

Mål:
- 100% av AI-genererte anbefalinger kan spores til inputdata

AI skal være:
- Forklarbar
- Reproduserbar
- Ikke “black box”

---

# 4️⃣ DRIFT-KPIER

## 4.1 AI Runtime Latency

Mål:
- < 300ms per prediksjonskall (aggregert)
- Ikke påvirke order-write latency

---

## 4.2 System Load Impact

Mål:
- AI-prosessering < 10% av total DB-load

---

## 4.3 AI Failure Rate

Mål:
- < 0.5% feil i AI-prosessering
- Fail-closed ved feil

---

# 5️⃣ ADOPSJONSKPIER

AI skal skape verdi – ikke bare eksistere.

## 5.1 Bruk av ESG-rapporter

- % firma som åpner rapport
- % firma som eksporterer

---

## 5.2 Prognosebruk

- % kjøkken som bruker volumprognose
- Avvik mellom prognose og manuell plan

---

# 6️⃣ RISIKO-KPIER

## 6.1 AI Risk Score

Vurderes kvartalsvis basert på:

- Datagrunnlag
- Bias
- Modellendringer
- Arkitekturpåvirkning

---

## 6.2 AI Drift Detection

Måler:
- Endring i prognosenøyaktighet over tid

Hvis > X% avvik:
- Modell må evalueres

---

# 7️⃣ STRATEGISKE KPIER (STYRENIVÅ)

Kvartalsvis rapportering:

- Prognosenøyaktighet %
- Matsvinnreduksjon %
- ESG-bruk %
- AI-incidenter
- Arkitekturpåvirkning (0 forventet)

---

# 8️⃣ RØDE FLAGG

Umiddelbar handling hvis:

- AI påvirker write-path
- AI endrer forretningsregler
- AI introduserer unntak
- AI genererer ikke-forklarbare beslutninger
- AI-latency påvirker cut-off

---

# 9️⃣ AI MATURITY STAGES

Stage 1 – Analyse  
Stage 2 – Prognose  
Stage 3 – Optimalisering  
Stage 4 – Integrert operasjonsstøtte  
Stage 5 – Strategisk innsikt

Lunchportalen skal ikke gå direkte til Stage 5.

Modenhet bygges gradvis.

---

# 🔟 KONKLUSJON

AI i Lunchportalen måles på:

- Verdi
- Presisjon
- Stabilitet
- Arkitekturintegritet
- Sikkerhet

AI skal aldri bli viktigere enn modellen.

Den skal forsterke plattformen,
ikke forandre den.
