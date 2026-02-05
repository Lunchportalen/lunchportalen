# Lunchportalen – Design Brief (Codex)

## Formål
Bygge et helhetlig, premium og nytenkende designsystem med tydelig rød tråd på tvers av hele Lunchportalen.
Uttrykket skal være **sexy, rolig og selvsikkert**, med enterprise-presisjon – aldri leken eller tilfeldig.

Designet skal gi følelsen av et moderne **command center**, der brukeren alltid har kontroll.

Inspirert av kvalitetsnivået til GetInspired.no og Lunsjkollektivet.no, men med et **unikt og selvstendig uttrykk**.

---

## Overordnede prinsipper

### 1. Rød tråd
- Én visuell logikk overalt
- Samme spacing, radius, skygger og typografi i hele systemet
- Ingen “spesialtilfeller” per side

### 2. Premium ro
- Store flater
- Luft og tydelig hierarki
- Kontrast uten hardhet
- Designet skal føles dyrt – ikke bråkete

### 3. System først
- **Tokens → komponenter → sider**
- Ingen inline-farger, tilfeldige marginer eller “quick fixes”
- Alt skal kunne justeres sentralt

### 4. Forutsigbar UX
- Brukeren skal alltid forstå:
  - hva som er låst
  - hvorfor noe er utilgjengelig
  - hva neste steg er
- Ingen skjulte regler

---

## Visuell stil

### Fargebase
- **Base:** Mørk premium (graphite / near-black)
- **Surface:** To nivåer (primary + secondary)
- **Text:** Lys, varm grå (ikke kritthvit)

### Primærfarge
- **Crimson / vinrød**
  - Føles kraftfull og eksklusiv
  - Ikke alarmrød
  - Brukes på primære handlinger, aktive states og fokus

### Accent
- **Varm amber / coral**
  - Brukes svært sparsomt
  - Kun til highlights, micro-feedback og spesielle states

### Statusfarger
- Success: tydelig, men dempet grønn
- Warning: varm gul, ikke neon
- Danger: klar, men kontrollert rød

---

## Typografi

- Sans-serif med høy lesbarhet (Geist / system-ui)
- Klart skille mellom:
  - overskrifter
  - brødtekst
  - metadata
- Ingen dekorative fonter

---

## Radius, spacing og skygger

### Radius
- Cards: stor radius (16–20px)
- Inputs / Buttons: medium (12–14px)
- Ingen skarpe hjørner

### Spacing
- Basert på faste trinn (4 / 8 / 16 / 24 / 32 / 40)
- Vertikal rytme er viktigere enn horisontal tetthet

### Skygger
- Myke
- Brede
- Lav opasitet
- Skal gi dybde, ikke “flytende kort”

---

## Komponentprinsipper

### Cards
- All informasjon presenteres i cards
- Cards er rolige, stabile flater
- Header + content er tydelig separert

### Buttons
- Klare hierarkier:
  - Primary
  - Secondary
  - Ghost
- Subtil hover
- Lett “press” på active (scale 0.98)

### Badges / Chips
- Brukes for:
  - status
  - systemtilstand
  - korte metadata
- Aldri som primær handling

### Inputs
- Tydelig fokus-state
- Disabled og locked må være visuelt åpenbart

---

## Micro-interactions

- Subtile animasjoner (150–200ms)
- Ingen bounce eller leken easing
- Følelsen skal være “presis maskin”, ikke leketøy

Eksempler:
- Hover-løft på card
- Lett glow på fokus
- Myk overgang på toggles

---

## Avanserte UX-mønstre (tillatt)

- Command Center-tidslinje (status: bestilt → låst → pakket → levert)
- Smart empty-state:
  - forklar *hvorfor* det er tomt
  - hva som skjer videre
- System-feedback når regler slår inn (f.eks. 08:00-cutoff)
- Kommandopalette (⌘K) for admin/superadmin

---

## Hard avgrensning (IKKE tillatt)

Codex har **ikke lov** til å:
- Endre auth, guards, audit-logikk eller cron
- Endre API-kontrakter
- Endre forretningsregler
- Introdusere nye dependencies
- Endre no-exception-prinsippet
- Endre roller eller tilgangsmodell

Design-endringer skal være **rent visuelle og strukturelle**.

---

## Codex-instruks (binding)

Når Codex arbeider med design:
- Følg denne briefen slavisk
- Hvis noe er uklart: **ikke gjett**
- Hvis ingen trygg forbedring finnes: **gjør ingenting**

Målet er konsistens, ikke kreativ improvisasjon.
