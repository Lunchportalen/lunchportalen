# 🤖 LUNCHPORTALEN – RESPONSIBLE AI POLICY

Dette dokumentet beskriver prinsippene for ansvarlig bruk av AI i Lunchportalen.

Formålet er å sikre at AI:

- Er kontrollert
- Er forklarbar
- Ikke bryter arkitekturen
- Ikke introduserer unntak
- Ikke skaper juridisk risiko
- Ikke påvirker brukerrettigheter

AI i Lunchportalen skal alltid være et støtteverktøy – aldri en autonom beslutningstaker.

---

# 1️⃣ GRUNNPRINSIPPER

## 1.1 AI skal være intern og kontrollert

AI skal:

- Støtte planlegging
- Støtte analyse
- Forutsi volum
- Redusere matsvinn

AI skal ikke:

- Endre avtaler
- Endre cut-off
- Endre rollemodell
- Endre bestillinger
- Overstyre brukere

---

## 1.2 Forklarbarhet

Alle AI-funksjoner skal:

- Ha dokumentert datagrunnlag
- Ha dokumentert modelltype
- Ha dokumentert beslutningslogikk
- Kunne reproduseres

Black-box-modeller uten forklaring er ikke tillatt.

---

## 1.3 Ingen rettighetsendringer

AI skal aldri:

- Påvirke ansattes rettigheter
- Påvirke kontraktsvilkår
- Påvirke juridiske forpliktelser
- Gjøre automatiserte beslutninger som påvirker individets stilling

---

## 1.4 Arkitekturintegritet

AI skal ikke:

- Skape ny write-path
- Bypass RLS
- Introdusere fleksibilitet
- Omgå determinisme
- Bryte no-exception rule

Alle AI-komponenter må fungere innenfor eksisterende gates.

---

# 2️⃣ DATAPRINSIPPER

## 2.1 Dataminimering

AI skal kun bruke:

- Aggregert historisk ordredata
- Ikke-sensitive metadata
- Ingen biometriske data
- Ingen helsedata
- Ingen fødselsnummer

---

## 2.2 Personvern

AI skal:

- Ikke profilere individer
- Ikke rangere ansatte
- Ikke generere individuelle anbefalinger som påvirker rettigheter
- Ikke bruke sensitive personopplysninger

---

# 3️⃣ RISIKOVURDERING

Før implementering av AI-funksjon skal:

- AI Risk Assessment gjennomføres
- ADR oppdateres
- Risk Register oppdateres
- Threat Model vurderes

Ingen AI implementeres uten dokumentert risikovurdering.

---

# 4️⃣ TRANSPARENS

AI-bruk skal:

- Dokumenteres
- Kunne forklares til kunder
- Ikke skjules bak “automatisk system”
- Ikke presenteres som autonom beslutning

Hvis AI brukes i rapporter:

- Forklar datagrunnlag
- Forklar usikkerhet
- Ikke overdriv presisjon

---

# 5️⃣ MONITORERING

Alle AI-modeller skal overvåkes for:

- Prognosenøyaktighet
- Modell-drift
- Anomalier
- Uventede utslag
- Arkitekturpåvirkning

Ved feil:

- AI deaktiveres
- Systemet fortsetter deterministisk
- Hendelsen logges

---

# 6️⃣ EU AI ACT ALIGNMENT

Lunchportalen opererer i:

- Lav-risiko kategori

AI brukes ikke til:

- Kredittvurdering
- HR-beslutninger
- Biometrisk identifikasjon
- Rettighetsavgjørelser

AI påvirker kun:

- Operasjonell optimalisering
- Aggregert analyse

---

# 7️⃣ ANSVAR

AI-ansvarlig (teknisk):

- Dokumenterer modeller
- Gjennomfører risikovurdering
- Overvåker drift

Ledelse:

- Godkjenner AI-initiativ
- Overvåker risiko

Styret:

- Får årlig AI-rapport

---

# 8️⃣ FORBUDTE PRAKSISER

Ikke tillatt:

- Dynamiske avtaleendringer
- Automatisk bestillingsjustering
- Rolleendring via AI
- Skjult modelloppdatering
- Individuell differensiering
- Bias uten dokumentasjon

---

# 9️⃣ ÅRLIG GJENNOMGANG

Minimum én gang per år:

- Gjennomgå alle AI-funksjoner
- Evaluere risiko
- Evaluere ytelse
- Evaluere arkitekturpåvirkning
- Dokumentere konklusjon

---

# 🔟 KONKLUSJON

Lunchportalen sin AI-policy er:

- Konservativ
- Kontrollert
- Forklarbar
- Lav-risiko
- Arkitekturbevarende

AI skal aldri endre plattformens prinsipper.

Kontroll > kompleksitet.
Struktur > fleksibilitet.
Ansvar > hype.
