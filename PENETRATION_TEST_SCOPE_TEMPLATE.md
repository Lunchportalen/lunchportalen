# 🔍 LUNCHPORTALEN – PENETRATION TEST SCOPE TEMPLATE

Dette dokumentet definerer omfang, mål og rammer for ekstern penetrasjonstest av Lunchportalen.

Formålet er å:

- Validere sikkerhetsarkitektur
- Identifisere sårbarheter
- Dokumentere reell risiko
- Bekrefte at arkitekturen fungerer som designet

Dette dokumentet brukes før kontrahering av sikkerhetspartner.

---

# 1️⃣ TESTMÅL

Testen skal validere:

- Autentisering
- Autorisering
- Multi-tenant isolasjon
- Rolle-eskalering
- API-sikkerhet
- RLS-bypass
- Service-role misbruk
- Data-integritet
- Rate limiting
- Infrastruktur-eksponering

Testen skal ikke være kosmetisk.
Den skal forsøke å bryte systemet.

---

# 2️⃣ SCOPE – IN-SCOPE KOMPONENTER

## 2.1 Webapplikasjon

- Frontend (Next.js)
- API-ruter
- Session-håndtering
- Input-validering
- Error responses

## 2.2 API

- `/api/order/**`
- `/api/orders/**`
- `/api/admin/**`
- `/api/superadmin/**`
- `/api/kitchen/**`
- `/api/driver/**`
- `/api/cron/**` (begrenset og koordinert)

## 2.3 Database (logisk nivå)

- RLS-policy evaluering
- Tenant-isolasjon
- Agreement-gate
- Cut-off enforcement
- RPC-sikkerhet

## 2.4 Auth

- Supabase Auth
- Token-håndtering
- JWT-manipulasjon
- Session spoofing

## 2.5 Infrastruktur

- Vercel deployment
- Supabase endepunkter
- DNS og TLS
- Rate-limit evaluering

---

# 3️⃣ OUT-OF-SCOPE

- Supabase intern infrastruktur
- Vercel intern infrastruktur
- Sanity intern infrastruktur
- DDoS på leverandørnivå
- Fysisk sikkerhet

---

# 4️⃣ TESTKATEGORIER

## 4.1 Authentication Testing

- JWT manipulation
- Session replay
- Brute force resistance
- Password reset misuse

## 4.2 Authorization Testing

- Cross-tenant access
- Horizontal privilege escalation
- Vertical privilege escalation
- Role manipulation

## 4.3 Business Logic Testing

- Bypass of cut-off
- Bypass of ACTIVE agreement
- Duplicate order injection
- Cancel without agreement
- Manipulation of company status

## 4.4 API Testing

- Parameter tampering
- Injection attempts
- Unexpected field injection
- Mass assignment

## 4.5 RLS Testing

- Direct query attempts
- SQL injection attempts
- Cross-tenant queries
- RLS policy misconfiguration

## 4.6 Service-Role Misuse

- Identify any endpoint exposing elevated privileges
- Attempt bypass via crafted requests

## 4.7 Rate Limiting

- High frequency requests
- Replay attempts
- Concurrent requests around cut-off

---

# 5️⃣ TESTMETODOLOGI

Testen bør følge:

- OWASP Top 10
- OWASP API Security Top 10
- Multi-tenant SaaS testing framework
- Business logic attack modelling

Testen skal inkludere:

- Manual testing
- Automated scanning
- Attempted exploit proof-of-concept

---

# 6️⃣ RAPPORTKRAV

Leveransen skal inkludere:

- Executive summary
- Technical findings
- Severity classification
- Proof-of-concept steps
- Impact analysis
- Recommended mitigation
- Retest confirmation

Severity levels:

- Critical
- High
- Medium
- Low
- Informational

---

# 7️⃣ TESTMILJØ

- Staging-miljø identisk med produksjon
- Egen test-tenant
- Dedikerte testbrukere:
  - employee
  - company_admin
  - superadmin
  - kitchen
  - driver

Testere skal ikke bruke produksjonsdata.

---

# 8️⃣ KOORDINERING

Før test:

- Signer NDA
- Definer testvinduer
- Oppgi test-IPer
- Avklar rate-limit toleranse

Under test:

- Kritiske funn rapporteres umiddelbart
- Ingen destruktive tester uten godkjenning

---

# 9️⃣ RETEST

Alle funn må:

- Fikses
- Re-testes
- Dokumenteres
- Arkiveres

---

# 🔟 SUKSESSKRITERIER

Testen anses vellykket dersom:

- Ingen Critical funn
- Ingen High funn relatert til:
  - Tenant-isolasjon
  - RLS bypass
  - Service-role misuse
  - Agreement bypass
  - Cut-off bypass

Medium og Low skal ha plan for utbedring.

---

# 1️⃣1️⃣ KONKLUSJON

Lunchportalen skal tåle:

- Rollemanipulasjon
- Tenant-eskalering
- API-manipulasjon
- Business logic-angrep
- Replay-angrep
- Direct database bypass

Penetrasjonstesten skal validere at systemet er like robust i praksis som dokumentert i:

- SECURITY_ARCHITECTURE.md
- THREAT_MODEL.md
- CODEX_DATAWRITE.md
- RISK_REGISTER.md
