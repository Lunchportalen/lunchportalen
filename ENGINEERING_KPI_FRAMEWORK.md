# 📊 LUNCHPORTALEN – ENGINEERING KPI FRAMEWORK

Dette dokumentet definerer tekniske KPI-er for Lunchportalen.

Formål:

- Måle teknisk helse
- Måle sikkerhetsdisiplin
- Måle operasjonell robusthet
- Beskytte arkitekturen
- Rapportere strukturert til styret

Dette er ikke vanity metrics.
Dette er kontrollindikatorer.

---

# 1️⃣ ARKITEKTUR-INTEGRITET KPI

## 1.1 CI Guard Integrity

Mål:
- 0 brudd på service-role policy
- 0 direkte writes til `orders`

Måling:
- Antall CI guard-feil per måned
- Antall blokkerte PR-er

Målverdi:
- 0 produksjonsmerge med brudd

---

## 1.2 RLS Integrity

Mål:
- 100% RLS-aktivert på kritiske tabeller

Måling:
- Periodisk RLS audit
- test:tenant passerer

Målverdi:
- 0 RLS-feil i produksjon

---

## 1.3 Deterministisk Write Path

Mål:
- 100% av order writes via RPC

Måling:
- Repo-scan for `.from("orders")`
- CI guard

Målverdi:
- 100%

---

# 2️⃣ OPERASJONELL STABILITET KPI

## 2.1 Mean Time To Detect (MTTD)

Mål:
- < 15 minutter for kritisk feil

Måling:
- Tid fra hendelse til loggdeteksjon

---

## 2.2 Mean Time To Resolve (MTTR)

Mål:
- < 60 minutter for P1

Måling:
- Incident logg

---

## 2.3 Uptime

Mål:
- > 99.9%

Måling:
- Health endpoint monitoring

---

## 2.4 Cut-off Peak Stability

Mål:
- < 200ms gjennomsnittlig order write
- 0 feil under peak

Måling:
- RPC latency logging

---

# 3️⃣ DATABASE HELSE KPI

## 3.1 Orders Table Size

Mål:
- Proaktiv partisjonering før 5M rader

Måling:
- Antall rader
- Index bloat

---

## 3.2 Query Performance

Mål:
- < 300ms kjøkken-query
- < 150ms ansatt-ordre-query

Måling:
- Query timing metrics

---

## 3.3 Dead Tuples / Vacuum

Mål:
- Under terskel for bloat

Måling:
- pg_stat_all_tables

---

# 4️⃣ SIKKERHETS KPI

## 4.1 Incident Count

Mål:
- 0 kritiske sikkerhetshendelser

Måling:
- Incident logg

---

## 4.2 Unauthorized Access Attempts

Mål:
- Identifisert og blokkert

Måling:
- Failed RLS events
- Suspicious logs

---

## 4.3 Penetration Test Findings

Mål:
- 0 Critical
- 0 High relatert til:
  - tenant leak
  - service-role misuse
  - agreement bypass

---

# 5️⃣ KODEKVALITET KPI

## 5.1 Test Coverage

Mål:
- Tenant isolation test alltid grønn
- Kritiske paths testet

---

## 5.2 Preflight Pass Rate

Mål:
- 100% av merges passerer preflight

---

## 5.3 ADR Compliance

Mål:
- Alle større arkitekturendringer dokumentert

---

# 6️⃣ SKALERING KPI

## 6.1 Orders per Company Growth

Mål:
- Overvåke volum uten ytelsesfall

---

## 6.2 Cost per Tenant

Mål:
- Stabil eller fallende marginalkost

---

## 6.3 Snapshot Generation Time

Mål:
- < 500ms

---

# 7️⃣ STRATEGISKE KPI

## 7.1 Switching Cost Indicator

Mål:
- % kunder med integrasjoner
- % kunder med > 6 mnd historikk

---

## 7.2 Security Maturity Score

Mål:
- Årlig revisjonsscore
- Compliance status

---

# 8️⃣ STYRE-RAPPORTERING (KVARTALSVIS)

Styret skal få:

- Uptime %
- Incident count
- RLS status
- Service-role breaches (0 forventet)
- Orders peak performance
- Compliance status
- Security roadmap progress

---

# 9️⃣ RØDE FLAGG

Umiddelbar handling hvis:

- RLS bypass oppdages
- Service-role misuse
- Cut-off bypass
- Agreement bypass
- DB bloat > definert terskel
- CI guard feiler i main

---

# 🔟 KONKLUSJON

Engineering KPI-er i Lunchportalen måler:

- Arkitekturdisiplin
- Sikkerhetsdisiplin
- Driftstabilitet
- Skaleringsberedskap
- Langsiktig robusthet

Dette er KPI-er som beskytter verdien av selskapet.
