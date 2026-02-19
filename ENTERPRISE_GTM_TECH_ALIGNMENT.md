# 🚀 LUNCHPORTALEN – ENTERPRISE GO-TO-MARKET TECH ALIGNMENT

Dette dokumentet beskriver hvordan teknologiplattformen støtter
Lunchportalen sin enterprise go-to-market strategi.

Formålet er å sikre:

- Teknologi støtter salgsstrategi
- Salgsargumenter er teknisk forankret
- Enterprise-krav kan møtes uten arkitekturendring
- Plattformen bygger switching cost

---

# 🎯 STRATEGISK POSISJONERING

Lunchportalen selges ikke som:

- En app
- Et personalgode
- En fleksibel lunsjportal

Den selges som:

- En operasjonsplattform
- En kostnadskontrollmotor
- En bærekrafts- og matsvinnmotor
- En strukturert infrastrukturkomponent

Teknologien må støtte dette narrativet.

---

# 1️⃣ ENTERPRISE-KRAV VS TEKNISK STØTTE

## 1.1 IT-sikkerhet

Enterprise spør:

- Hvordan håndterer dere tenant-isolasjon?
- Kan dere dokumentere RLS?
- Har dere SOC/ISO readiness?
- Hvordan håndterer dere cut-off og determinisme?

Teknisk støtte:

- Composite FK + RLS
- RPC-only writes
- SOC2_CONTROL_MATRIX.md
- ISO27001_ALIGNMENT_MATRIX.md
- SECURITY_ARCHITECTURE.md

---

## 1.2 Compliance & Governance

Enterprise krever:

- DPA
- Dokumentert risikoanalyse
- Incident-plan
- DR-plan
- Business continuity

Teknisk støtte:

- COMPLIANCE_OVERVIEW.md
- RISK_REGISTER.md
- INCIDENT_RESPONSE_PLAN.md
- DISASTER_RECOVERY_PLAN.md
- BUSINESS_CONTINUITY_PLAN.md

---

## 1.3 Integrasjon

Enterprise krever:

- SSO
- SCIM
- API
- ERP/HR-integrasjon

Roadmap-støtte:

- Enterprise SSO (År 2)
- SCIM provisioning
- Versjonert API
- Webhooks
- Partner API-program

---

## 1.4 Skalering

Enterprise spør:

- Tåler dere 10 000 ansatte?
- Tåler dere konsern med 20 lokasjoner?
- Hva skjer ved 50 000 firma?

Teknisk støtte:

- SCALABILITY_MODEL.md
- Orders-partisjonering (roadmap)
- Read replicas (roadmap)
- Zero Trust roadmap

---

# 2️⃣ SALGSARGUMENT SOM ER TEKNISK SANT

## Argument 1: "Ingen manuelle unntak"

Teknisk realitet:
- No-exception rule
- DB-level enforcement
- Ingen admin override

---

## Argument 2: "Full kontroll og forutsigbarhet"

Teknisk realitet:
- Cut-off i DB
- ACTIVE agreement gate
- Idempotente writes
- Fail-closed

---

## Argument 3: "Enterprise-ready"

Teknisk realitet:
- Dokumentert governance
- SOC2-alignment
- ISO-alignment
- Risk register
- Compliance roadmap

---

## Argument 4: "Lav operasjonell risiko"

Teknisk realitet:
- Deterministisk system
- Write-minimal design
- Logging via ops_events
- CI-hardening

---

# 3️⃣ GTM-STØTTENDE FUNKSJONER (ROADMAP)

## Fase 1 – Enterprise Entry

- SSO
- SCIM
- API versioning
- Compliance pack

## Fase 2 – Konsernsegment

- Multi-location advanced
- Konsernrapportering
- Scope-basert kitchen/driver

## Fase 3 – Gårdeiersegment

- Bygg-nivå rapportering
- ESG eksport
- Matsvinnanalyse

---

# 4️⃣ SWITCHING COST STRATEGI

Teknologi støtter switching cost gjennom:

- Historisk ordredata
- Integrasjoner
- Konsernstruktur
- Rapportering
- ESG-eksport
- Operasjonell avhengighet

Switching cost øker med:

- Tidsbruk
- Integrasjoner
- Compliance-innarbeiding

---

# 5️⃣ ENTERPRISE RFP-STRATEGI

Ved RFP skal følgende leveres:

- Enterprise Sales Technical Pack
- Security Architecture
- SOC2 alignment
- ISO alignment
- Risk register
- DR plan
- KPI framework

Målet:

Redusere friksjon i IT-gjennomgang.

---

# 6️⃣ RISIKO FOR GTM

## Risiko: Over-tilpasning

Hvis enterprise-krav fører til:

- Manuelle unntak
- Alternative write-paths
- Individuell fleksibilitet

→ Arkitekturen svekkes.

Dette er ikke tillatt.

---

## Risiko: Feature creep

GTM-press kan føre til:

- “Bare denne ene kunden”
- Spesialregler

Dette bryter plattformen.

---

# 7️⃣ ALIGNMENT PRINSIPP

Teknologi og salg må alltid være aligned:

- Selg det systemet faktisk er.
- Ikke lov fleksibilitet som ikke finnes.
- Ikke lov unntak som bryter modell.
- Ikke skap administrativ kompleksitet.

---

# 🏁 KONKLUSJON

Lunchportalen sin GTM-strategi fungerer fordi:

- Teknologi og arkitektur er strukturert.
- Sikkerhet er dokumentert.
- Plattformen er deterministisk.
- Compliance er forankret.
- Skalering er planlagt.

Teknologi er ikke støttefunksjon.
Den er fundamentet for markedet.
