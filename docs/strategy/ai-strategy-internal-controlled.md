# 🤖 LUNCHPORTALEN – AI STRATEGY (INTERNAL & CONTROLLED)

Dette dokumentet beskriver hvordan AI brukes i Lunchportalen.

AI skal:

- Optimalisere
- Forutsi
- Forenkle
- Rapportere

AI skal aldri:

- Overstyre avtaler
- Bryte cut-off
- Endre brukerrettigheter
- Ta beslutninger utenfor definerte rammer
- Være markedsbudskap i MVP

AI er en stille motor.

---

# 1️⃣ GRUNNPRINSIPP

Lunchportalen bruker AI som:

- Intern optimaliseringsmotor
- Prognoseverktøy
- Analyseverktøy

AI påvirker aldri:

- Rettigheter
- Avtaler
- Tenant-isolasjon
- Cut-off
- Write-paths

AI kan kun foreslå – aldri overstyre.

---

# 2️⃣ AI-OMRÅDER (INTERN BRUK)

## 2.1 Etterspørselsprognose

Formål:
- Forutsi antall bestillinger per dag
- Redusere matsvinn
- Hjelpe kjøkken med planlegging

Input:
- Historiske orders
- Ukedag
- Sesong
- Firmaaktivitet

Output:
- Anbefalt volum
- Prognose med konfidens

AI kan ikke:
- Endre bestillinger
- Justere avtaler

---

## 2.2 Matsvinnanalyse

Formål:
- Identifisere overproduksjon
- Identifisere underbestilling
- Gi innsikt til firma

Output:
- Bærekraftsrapport
- ESG-eksport

AI kan ikke:
- Justere levering
- Justere individuelle bestillinger

---

## 2.3 Kapasitetsvarsling

Formål:
- Varsle ved høy belastning
- Varsle ved lav kapasitetsutnyttelse

AI kan kun:
- Generere varsler
- Ikke gjøre endringer

---

## 2.4 Kostnadsanalyse

Formål:
- Identifisere mønstre i kost per firma
- Identifisere ineffektiv struktur

AI brukes til analyse – ikke beslutning.

---

# 3️⃣ AI-BRUK SOM IKKE ER TILLATT

AI skal ikke:

- Lage dynamiske unntak
- Endre cut-off
- Endre avtalevilkår
- Gi individuell fleksibilitet
- Justere rollemodell
- Gjøre “smarte” beslutninger på vegne av admin
- Overstyre brukerens valg

Dette bryter arkitekturen.

---

# 4️⃣ DATASTRATEGI FOR AI

AI får kun tilgang til:

- Aggregert historisk ordredata
- Anonymisert mønsterdata
- Ikke rå persondata utenfor behov

AI-modeller skal:

- Være sporbare
- Kunne forklares
- Ikke være “black box” i kritiske prosesser

---

# 5️⃣ AI-ARKITEKTURMODELL

AI implementeres som:

- Read-only analyse-lag
- Separate beregningsfunksjoner
- Ikke inline i kritiske write-paths
- Ikke i RLS

All AI-output må:

- Lagres eksplisitt
- Logges
- Kunne spores

---

# 6️⃣ STYRING OG KONTROLL

Alle AI-funksjoner må:

- Dokumenteres i ADR
- Gjennomgå risikovurdering
- Ikke bryte CodeX
- Ikke påvirke sikkerhetsmodell
- Ikke introdusere unntak

Før lansering:

- Evaluér mot Threat Model
- Evaluér mot Risk Register
- Oppdater dokumentasjon

---

# 7️⃣ AI ROADMAP (5 ÅR)

## År 1
- Enkel prognosemodell
- Matsvinnanalyse

## År 2
- Kapasitetsmodell
- Kostnadsoptimalisering

## År 3
- Konsernrapportering
- ESG-eksport med prediksjon

## År 4–5
- Avansert prediksjon (fortsatt internt)
- Integrasjon med ERP-data
- Ingen automatiske beslutninger

---

# 8️⃣ RISIKOER

| Risiko | Tiltak |
|--------|--------|
| AI tar beslutning | Forbudt |
| Black box | Krev forklarbarhet |
| Bias i data | Aggregert analyse |
| Over-automatisering | Manuell kontroll |
| Scope creep | Avensia-test |

---

# 9️⃣ STRATEGISK POSISJONERING

AI skal:

- Øke effektivitet
- Øke bærekraft
- Redusere matsvinn
- Øke dataverdi

AI skal ikke:

- Erstatte kontroll
- Skape fleksibilitet
- Forvirre modellen

AI er en forsterker, ikke en beslutningstaker.

---

# 🔟 KONKLUSJON

Lunchportalen sin AI-strategi er:

- Intern
- Kontrollert
- Sporbar
- Forklarbar
- Begrenset
- Ikke disruptiv for arkitekturen

Vi bygger ikke en “AI-lunsjapp”.

Vi bygger en strukturert operasjonsplattform
med en intelligent, men kontrollert motor.
