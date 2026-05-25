# 🎨 LUNCHPORTALEN – UI & UX GOVERNANCE

Dette dokumentet definerer prinsippene for design og brukeropplevelse i Lunchportalen.

Lunchportalen er:

- Et driftssystem
- Et kontrollpanel
- En operasjonsplattform

Den er ikke:

- En inspirasjonsapp
- En fleksibel markedsplass
- En “gøy” brukeropplevelse

UI skal støtte kontroll, ikke underholdning.

---

# 1️⃣ DESIGNFILOSOFI

## 1.1 Kontroll fremfor kreativitet

Designet skal uttrykke:

- Stabilitet
- Struktur
- Autoritet
- Forutsigbarhet
- Lav risiko

Hvis UI føles:

- Lekent
- Kaotisk
- Fleksibelt
- Overdreven animert

→ Det er feil retning.

---

# 2️⃣ INFORMASJONSHIERARKI

Bruker skal alltid forstå:

1. Status
2. Neste levering
3. Avtalte rammer
4. Egen bestilling
5. Historikk

Ikke:

- Inspirasjon
- Kampanjer
- “Anbefalinger”
- Personlig frihet

---

# 3️⃣ FAIL-CLOSED UX

Hvis noe er uklart:

- Vis blokkert tilstand
- Ikke vis halvfunksjon
- Ikke la bruker “teste seg frem”

Eksempel:

- Etter cut-off → tydelig låst
- Ingen ACTIVE agreement → tydelig blokkert

---

# 4️⃣ KOMPONENTPRINSIPPER

## 4.1 Knapper

- Tydelige
- Ikke lekne
- Ikke fargerik eksperimentering
- Primær handling er klar

---

## 4.2 Kort og paneler

- Avrundet, rolig design
- Luftig spacing
- Strukturert grid
- Ingen visuell støy

---

## 4.3 Ikoner

- Diskrete
- Funksjonelle
- Ikke illustrerende
- Ikke emoji-preget

---

# 5️⃣ TYPOGRAFI

- Lesbar
- Rolig
- Kontraststerk
- Ikke eksperimentell

Hierarki:

- H1 = Klar hovedverdi
- H2 = Struktur
- H3 = Underinndeling
- Body = Funksjonell tekst

---

# 6️⃣ INTERAKSJONSPRINSIPPER

Bruker skal:

- Ikke måtte gjette
- Ikke kunne gjøre feil
- Ikke kunne bryte modell
- Ikke få for mange valg

Handling → bekreftelse → status.

Ingen skjulte tilstander.

---

# 7️⃣ ADMIN UI

Admin-siden skal føles som:

- Command center
- Enterprise-panel
- Kontrollsystem

Ikke:

- Marketplace
- Inspirasjonsunivers
- Salgsside

---

# 8️⃣ EMPLOYEE UI

Ansatt skal:

- Se dagens status
- Se neste levering
- Se sin bestilling
- Kunne bestille før 08:00
- Se tydelig lås etter 08:00

Ingen fleksibilitet utover rammene.

---

# 9️⃣ VISUELL RETNING

Farger:

- Rolig krem/hvit bakgrunn
- Diskret gull eller kontrastfarge
- Mørk tekst
- Ingen neon
- Ingen gradienter uten funksjon

Uttrykk:

- Eksklusivt
- Strukturert
- Enterprise

---

# 🔟 RESPONSIV DESIGN

Mobil:

- Enkel
- Tydelig
- Ikke overfylt

Desktop:

- Dashboard-struktur
- Grid-basert
- Kontrollpanel-følelse

---

# 1️⃣1️⃣ FORBUDTE MØNSTRE

Ikke tillatt:

- Gamification
- “Spin to win”
- Rabatt-popup
- Dynamisk fleksibilitet
- Individuelle preferanseendringer
- Ustrukturert filterkaos
- UI som skjuler systemets rammer

---

# 1️⃣2️⃣ TESTKRAV

Før ny UI-komponent:

- Test mot fail-closed
- Test mot cut-off
- Test mot tenant-isolasjon
- Test mot admin-rolle

---

# 1️⃣3️⃣ DESIGN REVIEW PROSESS

Ved større UI-endring:

1. Sjekk mot Platform Vision
2. Sjekk mot CodeX
3. Sjekk mot Security Architecture
4. Sjekk mot Avensia-beslutningstesten
5. Godkjenn i arkitektur-review

---

# 🏁 KONKLUSJON

Lunchportalen skal ikke være:

- Inspirerende
- Lekent
- Kreativt

Den skal være:

- Strukturert
- Autoritativ
- Forutsigbar
- Stabil

UI skal forsterke arkitekturen.
Ikke undergrave den.
