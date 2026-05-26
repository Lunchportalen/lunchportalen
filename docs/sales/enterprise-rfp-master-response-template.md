# 🏢 LUNCHPORTALEN – ENTERPRISE RFP MASTER RESPONSE TEMPLATE

Dette dokumentet brukes som standard teknisk og sikkerhetsmessig svar
ved RFP / sikkerhetsskjema / enterprise-forespørsler.

Alle svar er basert på dokumentert arkitektur og styringsrammeverk.

---

# 1️⃣ COMPANY OVERVIEW

**Produktnavn:** Lunchportalen  
**Type:** Multi-tenant SaaS (firmalunsjplattform)  
**Hosting:** Cloud-native (Supabase + Vercel)  
**Region:** EU/EØS (der relevant)  

Lunchportalen er et deterministisk driftssystem for firmalunsj,
bygget med database-first enforcement og fail-closed prinsipp.

---

# 2️⃣ SECURITY ARCHITECTURE

## Q: Hvordan håndteres tilgangskontroll?

A:
- Supabase Auth (JWT-basert)
- Rollemodell (employee, company_admin, superadmin, kitchen, driver)
- Row Level Security (RLS)
- Composite tenant-isolasjon via company_id
- Ingen rolle bestemmes i frontend

Referanse:
- ../security/security-architecture.md
- ../security/access-control-policy.md

---

## Q: Hvordan sikres multi-tenant isolasjon?

A:
- company_id + location_id
- Composite FK
- RLS policies
- Tenant-isolation tester i CI
- Ingen global SELECT uten rollevalidering

---

## Q: Hvordan håndteres kritiske write-operasjoner?

A:
- RPC-only writes (orders via lp_order_set / cancel)
- REVOKE direkte INSERT/UPDATE/DELETE
- CI-guard mot bypass
- Logging i ops_events

---

# 3️⃣ DATA PROTECTION

## Q: Hvilke persondata behandles?

A:
- Navn
- E-post
- Firma-tilknytning
- Bestillingsvalg

Behandles ikke:
- Fødselsnummer
- Betalingskort
- Sensitive helseopplysninger

Referanse:
- ../compliance/compliance-overview.md
- ../governance/data-governance-policy.md

---

## Q: Er dere GDPR-kompatible?

A:
Ja.
- Kunde = behandlingsansvarlig
- Lunchportalen = databehandler
- Dataminimering
- Retention policy
- RLS enforcement
- DPA tilgjengelig

---

# 4️⃣ INFRASTRUCTURE & AVAILABILITY

## Q: Hvordan sikres tilgjengelighet?

A:
- Supabase backup (PITR)
- Disaster Recovery Plan
- Business Continuity Plan
- Fail-closed design
- RTO/RPO definert

Referanse:
- ../security/incident/disaster-recovery-plan.md
- ../security/incident/business-continuity-plan.md

---

## Q: Hva er deres RTO/RPO?

A:
- RTO: < 2–4 timer (scenarioavhengig)
- RPO: < 5–15 minutter

---

# 5️⃣ INCIDENT RESPONSE

## Q: Hvordan håndteres sikkerhetshendelser?

A:
- Dokumentert Incident Response Plan
- Logging via ops_events
- Root cause-analyse
- Dokumentert corrective action log

Referanse:
- ../security/incident/incident-response-plan.md
- ../compliance/corrective-actions-log.md

---

# 6️⃣ COMPLIANCE & CERTIFICATION

## Q: Har dere SOC 2 / ISO 27001?

A:
- SOC 2 alignment dokumentert
- ISO 27001 readiness strukturert
- Full ISMS-dokumentasjon
- Risk Treatment Plan
- Statement of Applicability

Referanse:
- ../compliance/soc2-control-matrix.md
- ISO27001_ALIGNMENT_MATRIX.md
- ../compliance/statement-of-applicability-iso27001.md

---

# 7️⃣ CHANGE MANAGEMENT

## Q: Hvordan håndteres kodeendringer?

A:
- Pull Request-prosess
- Code review
- CI guard
- Preflight før deploy
- Ingen direkte produksjonsendringer
- ADR for arkitekturendring

Referanse:
- ../governance/change-management-policy.md
- ../governance/codex-checklist.md

---

# 8️⃣ VENDOR MANAGEMENT

## Q: Hvilke underleverandører brukes?

A:
- Supabase (DB/Auth)
- Vercel (Hosting)
- Sanity (CMS)

Alle leverandører:
- Har sikkerhetsdokumentasjon
- Kan inngå DPA
- Opererer i EU/EØS der relevant

Referanse:
- ../governance/vendor-management-policy.md

---

# 9️⃣ LOGGING & AUDIT

## Q: Har dere audit trail?

A:
Ja.
- Alle kritiske mutations logges i ops_events
- Inneholder actor, company_id, payload, rid
- Sporbarhet er innebygd

---

# 🔟 AI USAGE

## Q: Bruker dere AI?

A:
Ja – kontrollert og internt.

AI brukes til:
- Prognose
- Analyse
- ESG-rapportering

AI brukes ikke til:
- Rettighetsbeslutninger
- Rolleendringer
- Automatisk ordrejustering

Referanse:
- ../strategy/ai-strategy-internal-controlled.md
- ../governance/responsible-ai-policy.md

---

# 1️⃣1️⃣ SCALABILITY

## Q: Kan dere håndtere 10 000+ ansatte?

A:
Ja.
Arkitekturen er designet for:

- 50 000+ firma
- 10+ millioner ansatte
- 10–20 millioner+ orders årlig

Tiltak:
- Indekser
- Retention policy
- Partisjonering (roadmap)
- Read replicas (roadmap)

Referanse:
- ../strategy/frameworks/scalability-model.md

---

# 1️⃣2️⃣ PENETRATION TESTING

## Q: Har dere gjennomført sikkerhetstesting?

A:
- Dokumentert Red Team Simulation Playbook
- Penetration Test Scope Template
- Årlig testplan

Referanse:
- ../security/red-team-simulation-playbook.md
- ../security/penetration-test-scope-template.md

---

# 1️⃣3️⃣ CONTACT

For ytterligere dokumentasjon eller teknisk gjennomgang:

Kontakt:
- CTO
- Security Officer

Full dokumentpakke tilgjengelig på forespørsel.
