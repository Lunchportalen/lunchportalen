# 📊 LUNCHPORTALEN – EXECUTIVE MONITORING DASHBOARD BLUEPRINT

Dette dokumentet definerer hvilke KPI-er og indikatorer
som skal vises i Executive Dashboard.

Formål:

- Gi styret sanntidsinnsikt
- Avdekke risiko tidlig
- Måle arkitekturhelse
- Beskytte skalerbarhet
- Koble teknisk drift til forretningsverdi

Dette er ikke et utvikler-dashboard.
Dette er et beslutningsdashboard.

---

# 1️⃣ OVERORDNET STRUKTUR

Dashboardet skal ha 5 hovedseksjoner:

1. System Health
2. Security & Compliance
3. Operational Stability
4. Scale & Performance
5. Strategic Growth Signals

---

# 2️⃣ SYSTEM HEALTH

## 2.1 Uptime

- 30-dagers uptime %
- 7-dagers uptime %
- Pågående incident (ja/nei)

Mål:
> 99.9%+

---

## 2.2 API Health

- Error rate (24t)
- P95 latency (orders RPC)
- P95 latency (kitchen query)

Grønn:
- Error rate < 0.5%
- Orders RPC < 200ms

---

## 2.3 Cut-off Stability

- Antall feil ved 08:00
- Peak concurrency
- Timeout rate

Mål:
- 0 cut-off feil

---

# 3️⃣ SECURITY & COMPLIANCE

## 3.1 RLS Integrity

- Tenant isolation test status (pass/fail)
- Antall RLS violations

Mål:
- 0 violations

---

## 3.2 Service-Role Integrity

- CI guard failures (30d)
- Service-role misuse attempts

Mål:
- 0 i produksjon

---

## 3.3 Incident Count

- P1 (kritisk) siste 12 mnd
- P2 siste 12 mnd
- MTTD
- MTTR

---

## 3.4 Compliance Status

- ISO readiness %
- SOC 2 status
- Dokumentasjon oppdatert (ja/nei)

---

# 4️⃣ OPERATIONAL STABILITY

## 4.1 Orders Volume

- Orders per dag
- Orders per firma
- Peak hour distribution

---

## 4.2 Snapshot Performance

- Snapshot generation time
- Snapshot consistency errors

Mål:
- < 500ms

---

## 4.3 DB Health

- Orders table size
- Index bloat %
- Dead tuples
- CPU utilization

---

# 5️⃣ SCALE & PERFORMANCE

## 5.1 Tenant Growth

- Antall aktive firma
- Antall ansatte
- Gjennomsnitt ansatte per firma

---

## 5.2 Cost per Tenant

- Infrastrukturkost / aktivt firma
- Infrastrukturkost / order

Mål:
- Stabil eller fallende marginalkost

---

## 5.3 Capacity Thresholds

Varsler når:

- Orders > 3M (vurder partisjonering)
- CPU > 70%
- Snapshot > 500ms
- Error rate > 1%

---

# 6️⃣ STRATEGIC GROWTH SIGNALS

## 6.1 Switching Cost Indicators

- % firma med > 6 mnd historikk
- % firma med integrasjoner
- % firma med aktiv bruk > 80%

---

## 6.2 Risk Signals

- Service-role policy brudd
- Agreement conflicts
- Cross-tenant anomalies
- Unexpected write spikes

---

# 7️⃣ TRAFFIC LIGHT SYSTEM

Dashboardet skal bruke:

🟢 Grønn – Stabil  
🟡 Gul – Krever oppmerksomhet  
🔴 Rød – Krever handling  

Ingen skjulte tall.
Ingen “cosmetic green”.

---

# 8️⃣ EXECUTIVE SUMMARY VIEW

Øverst i dashboard:

- Uptime
- Incident status
- Cut-off status
- Tenant isolation status
- Compliance status
- Orders volum siste 7 dager

Dette skal kunne leses på 30 sekunder.

---

# 9️⃣ OPERATIVT DASHBOARD (CTO VIEW)

Utvidet view med:

- Query latency
- DB performance
- RPC timing
- Error logs
- Security events
- Deployment status

---

# 🔟 IMPLEMENTASJON

Data hentes fra:

- Supabase stats
- Custom metrics
- ops_events
- Health endpoints
- CI logs

Kan bygges via:

- Internal admin view
- Grafana / Datadog
- Custom monitoring API

---

# 1️⃣1️⃣ REVIEW FREKVENS

| Rolle | Frekvens |
|-------|----------|
| CTO | Ukentlig |
| CEO | Månedlig |
| Styre | Kvartalsvis |

---

# 🏁 KONKLUSJON

Executive Dashboard skal:

- Avdekke risiko før den materialiserer seg
- Måle arkitekturdisiplin
- Måle sikkerhetsdisiplin
- Måle skalering
- Koble teknisk helse til forretningsverdi

Dette er styringsverktøyet
for å beskytte plattformens verdi.
