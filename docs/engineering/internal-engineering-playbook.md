# 🧠 LUNCHPORTALEN – INTERNAL ENGINEERING PLAYBOOK (ADVANCED)

Dette dokumentet beskriver hvordan vi bygger, endrer og beskytter Lunchportalen
på et avansert nivå.

Dette er ikke onboarding.
Dette er operasjonsmanual for arkitekturbeskyttelse.

Hvis noe bryter dette dokumentet → stopp.

---

# 1️⃣ ARKITEKTURELL FILOSOFI

Lunchportalen er:

- Et deterministisk driftssystem
- Database-first enforced
- Fail-closed
- Uten manuelle unntak
- Multi-tenant isolert
- Write-minimal

Vi optimaliserer for:

- Struktur
- Forutsigbarhet
- Kontroll
- Lav operasjonell risiko

Vi optimaliserer ikke for fleksibilitet.

---

# 2️⃣ DOMENEMODELL

Kritiske domener:

- Company
- Location
- Agreement
- Profile
- Order
- Kitchen snapshot
- Ops events

Alle domener skal:

- Ha klar eierskap
- Ha eksplisitte constraints
- Ha deterministisk livssyklus

---

# 3️⃣ WRITE-PATH DISCIPLINE

## 3.1 Orders

Orders skrives kun via:

- `lp_order_set`
- `lp_order_cancel`

Alle andre writes er forbudt.

## 3.2 Agreement og Company status

Endringer skal skje via:

- Server-RPC
- Rollevalidering
- Scopevalidering
- Logging

Ingen direkte service-role writes uten eksplisitt godkjenning.

---

# 4️⃣ RLS-STRATEGI

RLS er ikke et tillegg.
Det er primær sikkerhetsmekanisme.

Regler:

- All tilgang evalueres via `auth.uid()`
- company_id er primær tenant-grense
- location_id er sekundær grense
- Superadmin er eksplisitt rolle
- Ingen implicit trust

Ved endring i RLS:
- Oppdater ADR
- Oppdater Threat Model
- Oppdater Risk Register
- Oppdater tester

---

# 5️⃣ API-ARKITEKTUR

API-ruter er transportlag.
De skal:

- Ikke inneholde forretningslogikk
- Ikke inneholde tenant-avgjørelser
- Ikke inneholde cut-off logikk
- Ikke inneholde rollevalidering utover pre-check

Forretningsregler ligger i DB.

---

# 6️⃣ SERVICE-ROLE DISCIPLIN

Service-role:

- Kun i cron
- Kun i system/superadmin
- Aldri i order-ruter
- Aldri i kitchen-ruter uten eksplisitt RPC

CI guard stopper brudd.

Service-role er siste utvei, ikke standard.

---

# 7️⃣ FEILHÅNDTERING

Alle kritiske mutations skal:

- Returnere strukturert feilkode
- Inneholde rid
- Inneholde timestamp
- Ikke returnere “OK” ved delvis feil

Feil skal være:

- Deterministiske
- Dokumenterte
- Forutsigbare

---

# 8️⃣ PERFORMANCE DISCIPLIN

## 8.1 Indekser

Alle queries på:

- orders
- agreements
- profiles

må bruke indekser.

Ingen seq scans i produksjon på kritiske paths.

## 8.2 Observability

Mål:

- RPC latency
- Snapshot generation time
- Cut-off load
- Error rate
- Dead tuples

Observability før feature.

---

# 9️⃣ FEATURE EVALUATION PROTOCOL

Før ny feature:

1. Passer den plattformvisjonen?
2. Bryter den no-exception?
3. Skaper den admin-støy?
4. Lager den ny write-path?
5. Krever den unntak i RLS?
6. Introduserer den ny rolle?

Hvis ja → eskaler til arkitektur-review.

---

# 🔟 END-TO-END FLOW TESTING

Alle kritiske flows skal ha tester for:

- Tenant isolation
- Cut-off enforcement
- ACTIVE agreement enforcement
- Role-based access
- Idempotent writes

Ingen feature deployes uten test for disse.

---

# 1️⃣1️⃣ INCIDENT DISCIPLIN

Ved produksjonsfeil:

- Ikke bypass RLS
- Ikke deaktivere cut-off
- Ikke legge inn midlertidig override
- Ikke endre DB direkte uten logging

Følg INCIDENT_RESPONSE_PLAN.

---

# 1️⃣2️⃣ TEKNISK GJELD

Teknisk gjeld skal:

- Identifiseres
- Dokumenteres
- Planlegges
- Ikke akkumuleres i skjul

Årlig arkitektur-review er obligatorisk.

---

# 1️⃣3️⃣ SCALE READINESS CHECK

Før hver større milepæl:

- Orders volume
- DB latency
- Index bloat
- Service-role audit
- Tenant-isolation test
- CI guard pass rate

Hvis noe er rødt → stopp vekst.

---

# 1️⃣4️⃣ CULTURE

Vi bygger ikke kode.
Vi bygger system.

Vi bygger ikke features.
Vi bygger struktur.

Vi løser ikke problemer med fleksibilitet.
Vi løser dem med disiplin.

---

# 🏁 KONKLUSJON

Denne playbooken beskytter:

- Arkitekturen
- Sikkerheten
- Skalerbarheten
- Verdien av selskapet

Lunchportalen skal aldri degenerere til en fleksibel app.

Den skal forbli en strukturert plattform.
