# 💰 LUNCHPORTALEN – COST MODEL

Dette dokumentet beskriver kostnadsstrukturen for Lunchportalen
ved ulike skaleringsnivåer.

Målet er:

- Forutsigbar kostnadsvekst
- Høy bruttomargin
- Lav operasjonell kompleksitet
- Kontrollert skalering

---

# 1️⃣ KOSTNADSKATEGORIER

## 1.1 Infrastruktur

- Supabase (Database + Auth + Storage)
- Vercel (Hosting + Serverless)
- Sanity (CMS)
- E-post (Nodemailer / SMTP)
- Domene + DNS

---

## 1.2 Variable kostnader

- Database storage (orders)
- Database compute (queries)
- Serverless executions
- Snapshot-generering
- E-postvolum

---

## 1.3 Faste kostnader

- Grunnplan Supabase
- Grunnplan Vercel
- Sanity plan
- Monitoring
- Backup

---

# 2️⃣ ESTIMERT SKALERING

## Scenario A – 1 000 firma

Antatt:
- 200 ansatte per firma
- 60 % bruker
- 3 dager per uke

≈ 360 000 orders per år

### Estimert kostnad (årlig)

| Tjeneste | Estimat |
|----------|---------|
| Supabase | Lav |
| Vercel | Lav |
| Sanity | Lav |
| Totalt | Svært lav |

Margin: Meget høy

---

## Scenario B – 10 000 firma

≈ 3–4 millioner orders per år

### Forventet infrastruktur

- Supabase oppgradert compute
- Read-replica for kjøkken
- Økt lagring

Kostnad øker lineært, men
inntektsvekst > kostnadsvekst

Margin: Høy

---

## Scenario C – 50 000 firma

≈ 10–20 millioner orders per år

Tiltak:

- Orders-partisjonering
- Dedikert Supabase compute
- Read-replicas
- Snapshot-optimalisering
- Aggregerte view-tabeller

Kostnadsprofil:

- Database blir primær driver
- Serverless-kostnad sekundær

Margin: Fortsatt høy (SaaS-modell)

---

# 3️⃣ KOSTNADSDRIVERE

## 3.1 Orders-tabellen

Største vekstfaktor.

Tiltak:

- Retention policy
- Arkivering av gamle partisjoner
- Indekser optimalisert
- Snapshot caching

---

## 3.2 Peak load (08:00 cut-off)

Kortvarig høy trafikk.

Tiltak:

- DB-level enforcement
- Idempotente writes
- Effektive indekser
- Serverless autoskalering

---

## 3.3 Logging & rate events

Kan vokse raskt.

Tiltak:

- 30 dagers retention
- Automatisk cleanup

---

# 4️⃣ UNIT ECONOMICS

## 4.1 Kost per firma

Infrastrukturkost per firma synker med skala.

Modell:

- Lav marginalkost per nytt firma
- Faste kostnader fordeles
- Multi-tenant modell gir høy effektivitet

---

## 4.2 Kost per ansatt

Nær null marginalkost.

Primært lagring + lesing.

---

# 5️⃣ SKALERINGSSTRATEGI

## Fase 1 – < 10k firma

- Nåværende arkitektur holder
- Minimal tuning nødvendig

## Fase 2 – 10k–50k firma

- Orders-partisjonering
- Read replica
- Monitoring optimalisering

## Fase 3 – 50k+

- Region-separasjon (hvis nødvendig)
- Dedikert DB-cluster
- CDN-optimalisering

---

# 6️⃣ KONTROLLPUNKTER

Ved følgende terskler:

| Trigger | Tiltak |
|---------|--------|
| 3M orders | Evaluér partisjonering |
| 10M orders | Aktiver månedlig partition |
| CPU > 70% sustained | Oppgrader compute |
| Snapshot > 500ms | Pre-aggregation |

---

# 7️⃣ RISIKOER

## Risiko: Uforutsett DB-bloat

Tiltak:
- Autovacuum tuning
- Indeks-rebuild ved behov

## Risiko: Kostnadssjokk

Tiltak:
- Monitoring
- Kost per tenant dashboard
- Automatisk varsling

---

# 8️⃣ LANGSIKTIG MODELL

Lunchportalen er:

- Write-minimal
- Read-optimalisert
- Multi-tenant
- DB-first

Det gir:

- Lav marginalkost
- Høy bruttomargin
- Forutsigbar kostnad per ny kunde

---

# 9️⃣ KONKLUSJON

Lunchportalen kan:

- Skalere til 50 000+ firma
- Opprettholde høy margin
- Holde teknisk kompleksitet kontrollert
- Skalere lineært uten arkitekturendring

Kostnadsvekst er kontrollert og forutsigbar.