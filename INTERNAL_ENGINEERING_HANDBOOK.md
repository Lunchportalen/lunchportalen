# 🧠 LUNCHPORTALEN – INTERNAL ENGINEERING HANDBOOK

Dette dokumentet beskriver hvordan vi utvikler, endrer og vedlikeholder Lunchportalen.

Dette er ikke retningslinjer.
Dette er standard.

Hvis noe bryter dette dokumentet, er det feil.

---

# 1️⃣ GRUNNPRINSIPP

Lunchportalen er et driftssystem.

Vi optimaliserer for:

- Kontroll
- Determinisme
- Skalerbarhet
- Enkelhet
- Ingen manuelle unntak

Vi optimaliserer ikke for:

- Fleksibilitet
- Feature-bredde
- Individuelle tilpasninger

---

# 2️⃣ ARKITEKTURPRINSIPP

## 2.1 Database-first enforcement

Forretningslogikk skal håndheves i:

- DB (RLS)
- RPC
- Constraints

Ikke i frontend.

---

## 2.2 Én skrivevei

Orders skrives kun via:

- lp_order_set
- lp_order_cancel

Ingen direkte writes i API.

---

## 2.3 Fail-closed

Hvis noe er uklart:

- Blokker
- Returner eksplisitt feilkode
- Ikke “best effort”

---

# 3️⃣ KODESTANDARD

## 3.1 TypeScript

- Strict mode
- Ingen `any`
- Ingen implicit casting
- Ingen skjulte runtime-typer

## 3.2 API-kontrakt

Alle kritiske ruter skal:

- Returnere strukturert respons
- Inneholde rid
- Inneholde timestamp
- Ikke returnere tom 200 OK ved feil

---

## 3.3 Logging

Alle mutations skal:

- Logges i ops_events
- Inneholde actor
- Inneholde payload
- Ikke være skjulte

---

# 4️⃣ SERVICE ROLE REGLER

Service role er kun tillatt i:

- app/api/cron/**
- app/api/superadmin/system/**

Ikke i:

- order-ruter
- kitchen-ruter
- driver-ruter
- client-nære API-ruter

CI stopper brudd.

---

# 5️⃣ TENANT-ISOLASJON

Alle tabeller som har:

- company_id
- location_id

skal ha:

- Composite FK
- RLS
- Indekser

Ingen cross-tenant data er tillatt.

---

# 6️⃣ CUT-OFF & AGREEMENT

Cut-off (08:00 Oslo) er ikke en UI-funksjon.

Det er DB-logikk.

ACTIVE agreement er ikke et flagg i frontend.

Det er DB-validering.

---

# 7️⃣ FEATURE-UTVIKLING

Før ny feature:

1. Bestå Avensia-beslutningstesten
2. Dokumenter i ADR
3. Oppdater Threat Model ved behov
4. Oppdater Risk Register ved behov
5. Oppdater dokumentpakke

Ingen feature skal:

- Skape manuelle unntak
- Introdusere individuell fleksibilitet
- Lage alternative skriveveier

---

# 8️⃣ CI & MERGE KRAV

Før merge:

- ci:guard må passere
- typecheck må passere
- test:run må passere
- test:tenant må passere
- build:enterprise må passere

Ingen “vi fikser senere”.

---

# 9️⃣ INCIDENT-DISIPLIN

Ved feil:

- Ikke patch direkte i produksjon
- Ikke bypass RLS
- Ikke legge midlertidig override
- Bruk definert prosess
- Logg alt

---

# 🔟 TEKNISK GJELD

Teknisk gjeld skal:

- Dokumenteres
- Prioriteres
- Ikke skjules
- Ikke akkumuleres stille

Årlig arkitektur-review er obligatorisk.

---

# 1️⃣1️⃣ SCALING-DISIPLIN

Når:

- Orders > 3M → vurder partisjonering
- CPU > 70% sustained → vurder compute
- Snapshot > 500ms → optimaliser

Skalering er planlagt, ikke improvisert.

---

# 1️⃣2️⃣ DOKUMENTASJONSKRAV

Følgende dokumenter er en del av arkitekturen:

- SECURITY_ARCHITECTURE.md
- THREAT_MODEL.md
- RISK_REGISTER.md
- SCALABILITY_MODEL.md
- CODEX_DATAWRITE.md
- CODEX_CHECKLIST.md
- ADR
- DRP
- BCP

Endring i systemet → oppdater dokumentasjon.

---

# 1️⃣3️⃣ FORBUDTE MØNSTRE

Ikke tillatt:

- Direkte DB-writes uten RPC
- Service-role i feil kontekst
- Admin-override av orders
- Hardkodede unntak
- “Quick fix” i produksjon
- Feature-flag som omgår gates

---

# 1️⃣4️⃣ KULTUR

Engineering-kulturen skal være:

- Strukturert
- Konsekvent
- Dokumentert
- Forutsigbar
- Sikkerhetsorientert

Dette er ikke en startup som improviserer.
Det er en plattform.

---

# 🏁 KONKLUSJON

Lunchportalen bygges etter:

- Struktur fremfor fleksibilitet
- Standard fremfor tilpasning
- Kontroll fremfor komfort
- Langsiktig verdi fremfor kortsiktig feature

Dette dokumentet beskytter plattformen.
