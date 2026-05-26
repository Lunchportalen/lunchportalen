# 🤖 LUNCHPORTALEN – AI RISK ASSESSMENT FRAMEWORK

Dette dokumentet beskriver hvordan AI-relaterte risikoer
identifiseres, vurderes og håndteres i Lunchportalen.

AI i Lunchportalen er:

- Intern
- Kontrollert
- Ikke autonom
- Ikke beslutningstagende
- Ikke rettighetsendende

Dette rammeverket sikrer at AI aldri bryter:

- No-exception rule
- Tenant-isolasjon
- Determinisme
- Avtale- og cut-off-logikk
- Sikkerhetsmodell

---

# 1️⃣ FORMÅL

AI Risk Assessment skal:

- Identifisere risiko før implementering
- Hindre arkitekturbrudd
- Hindre utilsiktet diskriminering
- Hindre datamisbruk
- Hindre beslutningsautomatisering uten kontroll

Ingen AI-funksjon skal implementeres uten vurdering.

---

# 2️⃣ RISIKOKATEGORIER

## 2.1 Arkitekturrisiko

Spørsmål:

- Endrer AI write-path?
- Endrer AI rollemodell?
- Påvirker AI RLS?
- Påvirker AI agreement/cut-off?
- Introducerer AI manuelle unntak?

Hvis ja → STOPP.

---

## 2.2 Datarisiko

Spørsmål:

- Brukes persondata?
- Brukes sensitive data?
- Er data aggregert?
- Er modellen forklarbar?
- Er data korrekt klassifisert?

AI skal kun bruke:

- Aggregert historisk ordredata
- Ikke sensitive persondata

---

## 2.3 Modellrisiko

Spørsmål:

- Er modellen forklarbar?
- Kan vi reprodusere output?
- Finnes det bias?
- Er treningsdata dokumentert?
- Finnes det drift-detection?

Ingen black-box uten dokumentasjon.

---

## 2.4 Operasjonell risiko

Spørsmål:

- Kan AI påvirke produksjon direkte?
- Kan AI forårsake feilvolum?
- Kan AI påvirke kostnader dramatisk?
- Har vi fallback ved feil?

AI skal alltid være:

- Read-only
- Rådgivende
- Fail-closed

---

## 2.5 Juridisk risiko

Spørsmål:

- Påvirker AI brukerrettigheter?
- Påvirker AI lønn/ansettelse?
- Påvirker AI juridiske rettigheter?
- Er dette høy-risiko etter EU AI Act?

Lunchportalen skal operere i lav-risiko kategori.

---

# 3️⃣ RISIKOVURDERINGSMODELL

Hver AI-funksjon skal vurderes etter:

| Faktor | Lav | Moderat | Høy |
|--------|------|---------|------|
| Arkitekturpåvirkning | Ingen | Indirekte | Direkte |
| Datatype | Aggregert | Persondata | Sensitive data |
| Beslutningspåvirkning | Ingen | Rådgivende | Automatisk |
| Forklarbarhet | Full | Delvis | Black box |
| Kontroll | Full | Delvis | Uklart |

AI med Høy på noen faktor → må redesignes.

---

# 4️⃣ AI APPROVAL PROSESS

Før lansering:

1. Dokumenter formål
2. Dokumenter datakilde
3. Dokumenter modelltype
4. Dokumenter risikoanalyse
5. Oppdater:
   - ADR
   - Risk Register
   - Threat Model
6. Godkjenning fra teknisk ansvarlig

Ingen AI lanseres uformelt.

---

# 5️⃣ MONITORERING

AI må overvåkes for:

- Prognosenøyaktighet
- Modell-drift
- Anomalier
- Uventede effekter
- Arkitekturpåvirkning

Hvis AI påvirker systemlogikk → stopp.

---

# 6️⃣ FAIL-SAFE MEKANISME

Hvis AI:

- Feiler
- Overbelaster system
- Produserer ekstreme avvik

Systemet skal:

- Ignorere AI-output
- Fortsette deterministisk drift
- Logge hendelsen
- Varsle ansvarlig

AI skal aldri være single point of failure.

---

# 7️⃣ ÅRLIG AI-GJENNOMGANG

Minimum 1 gang per år:

- Gjennomgå alle AI-moduler
- Evaluer risiko
- Evaluer drift
- Evaluer bias
- Evaluer arkitekturpåvirkning
- Dokumenter konklusjon

---

# 8️⃣ FORBUDTE AI-MØNSTRE

Ikke tillatt:

- Dynamisk endring av avtaler
- Automatisk justering av bestillinger
- Individuell fleksibilitet
- Rettighetsendring
- Usynlige modellendringer
- Modelloppdatering uten dokumentasjon

---

# 9️⃣ EU AI ACT ALIGNMENT

Lunchportalen skal:

- Operere i lav-risiko kategori
- Ikke bruke AI til rettighetsbeslutninger
- Ikke bruke biometrisk identifikasjon
- Ikke bruke høy-risiko profilering

Modellene er:

- Operasjonelle
- Prognosebaserte
- Ikke regulatorisk sensitive

---

# 🔟 KONKLUSJON

AI i Lunchportalen skal:

- Forsterke plattformen
- Ikke endre modellen
- Ikke skape unntak
- Ikke redusere sikkerhet
- Ikke øke risiko

AI er en motor.
Ikke en beslutningstaker.

Kontroll > kompleksitet.
