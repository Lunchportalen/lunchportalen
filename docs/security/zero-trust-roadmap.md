# 🔐 LUNCHPORTALEN – ZERO TRUST ROADMAP

Dette dokumentet beskriver hvordan Lunchportalen utvikler seg mot en
full Zero Trust Architecture over de neste 3–5 årene.

Zero Trust-prinsippet:

"Never trust. Always verify."

Ingen forespørsel skal stole på:

- Nettverk
- Bruker
- Rolle
- Intern tjeneste
- Service-role
- Infrastruktur

Alt skal verifiseres eksplisitt.

---

# 🎯 MÅL

Innen 5 år skal Lunchportalen:

- Ha full rolle- og scope-verifisering på alle nivåer
- Ha minimal service-role overflate
- Ha isolert system-motor
- Ha tydelig identity-bound requests
- Ha kontinuerlig verifikasjon av privilegier
- Være klar for enterprise SSO og SCIM

---

# 1️⃣ ZERO TRUST PRINSIPPER (APPLISERT PÅ LUNCHPORTALEN)

1. Ingen implicit trust
2. Identity-bound tilgang
3. Least privilege
4. Mikrosegmentering
5. Kontinuerlig verifikasjon
6. Logging før handling
7. Audit som standard

---

# 📅 FASE 1 – STABILISERING (0–12 MND)

Status i dag:

- DB-first enforcement
- RPC-only writes
- Service-role allowlist
- RLS enforcement
- Tenant isolation

Tiltak:

- Fullføre ISO/SOC struktur
- Eliminere unødvendig service-role bruk
- Stramme kitchen/driver scope
- Tvinge RPC-only for alle kritiske writes
- Aktivere strengere CI-gates

Mål:
- Ingen skjulte write-paths
- Ingen implicit admin-tilgang

---

# 📅 FASE 2 – IDENTITY HARDENING (1–2 ÅR)

Tiltak:

1. Enterprise SSO (SAML/OIDC)
2. SCIM provisioning
3. Session binding til IP / device fingerprint (valgfritt)
4. Short-lived tokens
5. Refresh token rotation
6. Enforce MFA for admin/superadmin

Mål:
- Identity-based access kontroll
- Redusert risiko for kompromittert konto

---

# 📅 FASE 3 – SERVICE SEGMENTATION (2–3 ÅR)

Tiltak:

1. Isoler cron/system-motor i egen runtime
2. Stram service-role ytterligere
3. Dedikerte DB-funksjoner for alle admin-tiltak
4. Scope-tabell for kitchen/driver
5. Eksplisitt permission-model per rolle

Mål:
- Ingen global tilgang
- Mikrosegmentert privilegium

---

# 📅 FASE 4 – CONTINUOUS VERIFICATION (3–4 ÅR)

Tiltak:

1. Periodisk tilgangsrevalidering
2. Automatisk rolleutløp
3. Suspicious activity detection
4. Security analytics
5. Advanced rate-limit basert på atferd

Mål:
- Dynamisk tilgangskontroll
- Proaktiv sikkerhet

---

# 📅 FASE 5 – FULL ZERO TRUST MODELL (4–5 ÅR)

Tiltak:

1. Policy-as-code
2. Infrastructure identity attestation
3. Mutual TLS mellom interne tjenester
4. Dedicated audit pipeline
5. Red-team årlig

Mål:
- Zero implicit trust
- Full sporbarhet
- Kontinuerlig compliance

---

# 🔎 HVA ZERO TRUST BETYR FOR LUNCHPORTALEN

## I dag:

- Trust basert på valid session + RLS
- Service-role isolert men eksisterer

## I fremtiden:

- All tilgang må være:
  - Identity-bound
  - Scope-bound
  - Context-aware
  - Continuously validated

---

# 📊 RISIKOREDUKSJON OVER TID

| Risiko | Nå | 5 år |
|--------|----|------|
| Service-role misuse | Moderat | Lav |
| Role escalation | Lav | Svært lav |
| Session hijacking | Moderat | Lav |
| Cross-tenant leak | Lav | Svært lav |
| Insider misuse | Moderat | Lav |

---

# 🧠 STRATEGISK BETYDNING

Zero Trust gir:

- Enterprise differensiering
- Konsern-aksept
- Lavere forsikringspremier
- Høyere tillit
- Redusert systemisk risiko

Det er ikke bare sikkerhet.
Det er strategisk moat.

---

# 🏁 KONKLUSJON

Lunchportalen har allerede:

- DB-first enforcement
- RLS
- RPC-only writes
- Tenant isolation

Det gir et sterkt fundament.

Zero Trust Roadmap bygger videre på dette
og forsterker systemet gradvis uten arkitekturbrudd.

Sikkerhet skal aldri være en sprint.
Det er en evolusjon.
