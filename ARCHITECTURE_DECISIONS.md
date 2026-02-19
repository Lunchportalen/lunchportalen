# 🧠 LUNCHPORTALEN – ARCHITECTURE DECISIONS (ADR)

Dette dokumentet beskriver arkitektoniske beslutninger som er tatt i Lunchportalen.

Hver beslutning følger formatet:

- Context
- Decision
- Consequences

Målet er å:

- Dokumentere hvorfor systemet er bygget slik
- Hindre utilsiktet arkitektur-drift
- Sikre konsistens over tid
- Gi revisjons- og investorklarhet

---

# ADR-001 – Database-first enforcement

## Context
Forretningsregler (cut-off, avtale, tenant-isolasjon) kan ikke overlates til frontend eller API-lag alene.

## Decision
All kritisk logikk håndheves på databasenivå via:

- RLS
- RPC
- Composite FK
- UNIQUE constraints

## Consequences
+ Systemet er deterministisk
+ Ingen UI-bypass mulig
+ Fail-closed
− Mer kompleks SQL
− Krever sterk CI og dokumentasjon

---

# ADR-002 – RPC-only writes for orders

## Context
Direkte writes i API-ruter skaper risiko for bypass av avtale/cutoff.

## Decision
All skriveoperasjon på `orders` skjer via:

- `lp_order_set`
- `lp_order_cancel`

Direkte `.insert/.update` er forbudt i produksjonskode.

## Consequences
+ Idempotens
+ Konsistent feilrespons
+ Ingen skjulte writes
− Krever CI-guard

---

# ADR-003 – No DELETE on orders

## Context
Bestillinger må være sporbare.

## Decision
Orders slettes aldri.
Status settes til `CANCELLED`.

## Consequences
+ Revisjonsspor
+ Ingen tap av historikk
− Tabellvekst håndteres via retention/partisjonering

---

# ADR-004 – Multi-tenant via company_id

## Context
Lunchportalen er B2B multi-tenant.

## Decision
Tenant-isolasjon håndheves via:

- company_id
- location_id
- Composite FK
- RLS

## Consequences
+ Ingen cross-tenant leak
+ Skalerbar modell
− Kompleksitet i policies

---

# ADR-005 – Fail-Closed Cut-off Enforcement

## Context
Cut-off 08:00 er kjerne i forretningsmodellen.

## Decision
Cut-off håndheves i DB (timezone Europe/Oslo).

## Consequences
+ Ingen manuelle unntak
+ Forutsigbar drift
− Krever presis tidshåndtering

---

# ADR-006 – Service-role allowlist

## Context
Service-role kan omgå RLS.

## Decision
Service-role er kun tillatt i:

- cron
- system/superadmin
- migrations
- workflows

CI stopper brudd.

## Consequences
+ Ingen utilsiktet bypass
+ Sikker rollebruk
− Krever streng repository-disciplin

---

# ADR-007 – Single Active Agreement per Location

## Context
Flere ACTIVE avtaler skaper uklarhet.

## Decision
Partial unique index:

(company_id, location_id) WHERE status='ACTIVE'

## Consequences
+ Entydig avtalegrunnlag
+ Ingen tvetydighet
− Krever korrekt avtaleprosess

---

# ADR-008 – No-exception rule

## Context
Manuelle unntak skaper systemisk risiko.

## Decision
Systemet tillater ingen manuelle overstyringer.

## Consequences
+ Forutsigbarhet
+ Enklere skalering
− Mindre fleksibilitet i edge cases

---

# ADR-009 – Write-minimal design

## Context
Høy write-kompleksitet skaper race conditions.

## Decision
Orders har to write-paths.
Resten er read-heavy.

## Consequences
+ Lav risiko
+ Skalerbarhet
+ Enkel debugging
− Krever presis RPC-implementasjon

---

# ADR-010 – Logging via ops_events

## Context
Kritiske endringer må være sporbare.

## Decision
Alle mutations logges i `ops_events`.

## Consequences
+ Revisjonsspor
+ Incident-analyse
− Økt log-volum

---

# ADR-011 – Partition-ready orders

## Context
Orders vokser lineært.

## Decision
Designet er kompatibelt med fremtidig RANGE partition.

## Consequences
+ Fremtidssikker
+ Ingen redesign nødvendig
− Ikke aktivert før nødvendig

---

# ADR-012 – Enterprise CI hardening

## Context
Utviklerfeil er største risiko.

## Decision
CI stopper:

- Service-role misuse
- Direct order writes
- Tenant-isolation brudd

## Consequences
+ Arkitekturbeskyttelse
+ Langsiktig stabilitet
− Krever disiplin

---

# ADR-013 – Deterministisk API-kontrakt

## Context
Stille feil er uakseptabelt.

## Decision
Alle RPC returnerer strukturert:

- code
- message
- rid
- timestamp

## Consequences
+ Forutsigbarhet
+ Debugging enklere
− Streng API-standard

---

# ADR-014 – No implicit admin overrides

## Context
Admin kan fristes til å overstyre bestillinger.

## Decision
Company_admin kan ikke endre ansattes ordre.

## Consequences
+ Modellbeskyttelse
+ Ingen skjulte avvik
− Mindre fleksibilitet

---

# ADR-015 – Snapshot-based kitchen visibility

## Context
Kjøkken trenger stabile tall.

## Decision
Kjøkken kan bruke snapshot-struktur fremfor live-query hvis nødvendig.

## Consequences
+ Stabil produksjon
+ Lav risiko for race conditions
− Litt ekstra kompleksitet

---

# KONKLUSJON

Lunchportalen sin arkitektur er basert på:

- Database-first enforcement
- Minimal write paths
- Multi-tenant sikkerhet
- Deterministiske operasjoner
- No-exception modell

Enhver endring i:

- Roller
- RLS
- RPC
- Service-role policy
- Cut-off logikk
- Agreement-modell

må føre til ny ADR-oppføring.

Arkitektur skal aldri endres implisitt.