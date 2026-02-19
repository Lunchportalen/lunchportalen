# 🧠 LUNCHPORTALEN – TECH DUE DILIGENCE PACKAGE

Dette dokumentet gir en samlet teknisk oversikt for due diligence.

Formålet er å gi:

- Investorer
- Enterprise-kunder
- Teknisk revisjonsteam
- CTO/arkitekt-evaluering

… en strukturert vurdering av systemets modenhet.

---

# 1️⃣ PRODUKTOVERSIKT

Lunchportalen er et deterministisk, multi-tenant driftssystem for firmalunsj.

Kjennetegn:

- Database-first enforcement
- Fail-closed arkitektur
- Ingen manuelle unntak
- Deterministisk produksjonsflyt
- Write-minimal design
- Multi-tenant isolasjon

Systemet er bygget for skalerbarhet og revisjon.

---

# 2️⃣ ARKITEKTUR

## 2.1 Teknologistack

- Next.js 15
- Supabase (Auth + Postgres + RLS)
- Sanity (CMS)
- Nodemailer (SMTP)
- GitHub Actions (CI)
- Vercel (hosting)

## 2.2 Arkitekturmodell

- API-lag (Next.js routes)
- Database (RLS + RPC)
- Hard-gated writes
- Service-role allowlist
- CI-guard enforcement

Forretningslogikk håndheves i DB, ikke i frontend.

---

# 3️⃣ SIKKERHET

## 3.1 Autentisering

- Supabase Auth
- JWT-basert
- `auth.uid()` i RLS og RPC

## 3.2 Autorisering

- Rollebasert tilgang
- Tenant-isolasjon via company_id
- Composite FK

## 3.3 Write-kontroll

- RPC-only writes for orders
- REVOKE direkte writes
- CI-guard stopper brudd

## 3.4 Logging

- ops_events
- Audit trail
- Structured feilkoder

---

# 4️⃣ SKALERBARHET

Designet for:

- 50 000+ firma
- 10+ millioner ansatte
- 10–20 millioner+ orders årlig

Skaleringsmekanismer:

- Indekser
- Retention policy
- Partisjonering ved behov
- Write-minimal design

Ingen arkitekturendring kreves ved 50k firma.

---

# 5️⃣ DATAHÅNDTERING

## 5.1 GDPR

- Kunde = behandlingsansvarlig
- Lunchportalen = databehandler
- Dataminimering
- Retention
- RLS-isolasjon

## 5.2 Backup

- Supabase daglig backup
- Point-in-time recovery
- Restore-prosedyrer dokumentert

---

# 6️⃣ OPERASJONELL MODENHET

Dokumenterte planer:

- Security Architecture
- Threat Model
- Risk Register
- Disaster Recovery Plan
- Business Continuity Plan
- Incident Response Plan
- Codex-policy
- CI hardening

Systemet har eksplisitt no-exception policy.

---

# 7️⃣ KODEKVALITET & CI

- TypeScript strict mode
- Typecheck i CI
- Tenant-isolation tests
- CI-guard for service-role misuse
- CI-guard for direct order writes
- Preflight før merge

Ingen kritiske writes uten eksplisitt RPC.

---

# 8️⃣ RISIKOANALYSE

Primære risikoer:

- Infrastruktur-outage
- Service-role misuse
- Utviklerfeil
- Datakorrupt hendelse

Mitigering:

- Fail-closed design
- DB-level enforcement
- CI policy
- Dokumentert DR-plan

Rest-risiko anses som håndterbar.

---

# 9️⃣ ORGANISATORISK MODENHET

Lunchportalen opererer med:

- Dokumentert arkitektur
- Dokumentert risiko
- Dokumentert incident-håndtering
- Dokumentert compliance
- Dokumentert kostnadsmodell

Dette reduserer “founder risk” og teknisk gjeld.

---

# 🔟 KONKLUSJON

Lunchportalen fremstår som:

- Teknisk robust
- Sikkerhetsmessig disiplinert
- Skalerbar
- Reviderbar
- Enterprise-forberedt
- Lav operasjonell risiko

Arkitekturen støtter aggressiv vekst uten strukturell risiko.

Teknisk fundament er investerbart.
