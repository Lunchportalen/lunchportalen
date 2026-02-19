# 🚀 LUNCHPORTALEN – 5-ÅRS PRODUKT ROADMAP (DETALJERT)

Dette dokumentet beskriver Lunchportalen sin produktutvikling
over en 5-års horisont.

Roadmapen følger prinsippene:

- No-exception rule
- Én sannhetskilde
- Deterministisk drift
- Enterprise readiness
- Skalerbar arkitektur

Ingen funksjon skal bryte arkitekturen.

---

# 🎯 STRATEGISK RETNING

Lunchportalen skal utvikles fra:

Et stabilt driftssystem
→ til en operasjonsplattform
→ til en integrerbar infrastrukturkomponent
→ til en data- og ESG-motor for næringsbygg

---

# 📅 ÅR 1 – STABILISERING & ENTERPRISE GRUNNMUR

## Q1
- Fullføre compliance-struktur (ISO/SOC readiness)
- Stramme alle write-paths
- Eliminere overlappende order-ruter
- Standardisere API-responsformat

## Q2
- Observability (RPC latency, cut-off metrics)
- Kitchen performance-optimalisering
- Snapshot-forbedring
- Eksplisitt error-contract i alle API-ruter

## Q3
- Admin UI for agreement lifecycle (forenklet)
- Bedre firmastatus-visualisering
- Stabilisering av cron-system

## Q4
- Partisjonering-klargjøring (ikke aktivering)
- Database-optimalisering
- Pre-aggregation av rapportdata

🎯 Mål år 1:
- Stabil plattform uten arkitekturbrudd
- Enterprise-salg mulig

---

# 📅 ÅR 2 – ENTERPRISE & INTEGRASJON

## Q1
- Enterprise SSO (SAML/OIDC)
- MFA for admin/superadmin
- Session hardening

## Q2
- SCIM provisioning
- Bulk brukeropprettelse
- Role-mapping for konsern

## Q3
- Versjonert offentlig API
- Webhooks for:
  - New order
  - Order cancel
  - Agreement status change

## Q4
- Konsernstruktur (multi-location advanced)
- Cross-location rapportering

🎯 Mål år 2:
- Konsernsegment
- API-first plattform
- Høyere switching cost

---

# 📅 ÅR 3 – DATA & ANALYSE

## Q1
- KPI-dashboard for firma
- Kostnadsanalyse per lokasjon

## Q2
- Matsvinn-rapportering
- ESG-rapport per firma

## Q3
- Prognosemotor (intern AI)
- Forventet volum-estimat per uke

## Q4
- Smart kapasitetsvarsling til kjøkken
- Anbefalinger basert på historikk

🎯 Mål år 3:
- Lunchportalen som beslutningsstøtte
- Bærekraftsposisjonering
- Differensiering

---

# 📅 ÅR 4 – INFRASTRUKTUR & SKALERING

## Q1
- Orders-partisjonering aktiv
- Arkivering av historiske orders

## Q2
- Read replicas for kjøkken
- Latency-optimalisering

## Q3
- Region-separasjon (hvis nødvendig)
- Tenant-based routing

## Q4
- Avansert monitoring
- Alert automation

🎯 Mål år 4:
- 50 000+ firma håndterbart
- Stabil ytelse under peak

---

# 📅 ÅR 5 – PLATTFORM & ØKOSYSTEM

## Q1
- Partner API program
- ERP-integrasjon

## Q2
- HR-system integrasjon
- Adgangssystem-integrasjon

## Q3
- ESG-eksportstandard
- Gårdeier-dashboard

## Q4
- Event-driven arkitektur (begrenset)
- Plattform-økosystem (kontrollert)

🎯 Mål år 5:
- Lunchportalen som infrastruktur
- Plattformverdi > applikasjonsverdi

---

# 🧠 PRODUKTREGELVERK

Alle nye funksjoner må:

- Ikke introdusere manuelle unntak
- Ikke åpne nye skriveveier
- Ikke omgå RLS
- Ikke øke admin-støy
- Ikke skape fleksibilitet på individnivå

---

# 📊 PRIORITERINGSMODELL

Prioriteringsrekkefølge:

1. Arkitekturstabilitet
2. Compliance
3. Ytelse
4. Enterprise-funksjoner
5. Data-verdi
6. Integrasjoner
7. UI-forbedringer

UI er aldri viktigere enn arkitektur.

---

# ⚠ RISIKO VED FEIL ROADMAP

Hvis roadmap brytes:

- Arkitektur degenererer
- Teknisk gjeld øker
- Cut-off-logikk svekkes
- Switching cost faller
- Enterprise-aksept reduseres

Dette skal ikke skje.

---

# 📈 SUKSESSMÅLING

Årlig evaluering av:

- Arkitektur-integritet
- Uptime
- Compliance-status
- Tenant-isolation
- Security incidents
- Performance under cut-off
- Brukerretensjon
- Konsernintegrasjoner

---

# 🏁 KONKLUSJON

Lunchportalen skal ikke vokse gjennom:

- Fleksibilitet
- Feature-bredde
- Individuelle unntak

Den skal vokse gjennom:

- Struktur
- Standardisering
- Integrasjon
- Data
- Kontroll

Dette er en plattformstrategi, ikke en feature-strategi.
