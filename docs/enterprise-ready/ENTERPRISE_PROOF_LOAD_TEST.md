# Enterprise proof — lasttest (E0: «Ingen lasttest»)

**Dato:** 2026-04-17  
**Miljø:** Lokalt — `next start` (produksjonsbygg eksisterende `.next`), `http://127.0.0.1:3000`  
**Verktøy:** `scripts/enterprise-proof-load.mjs` (Node `fetch`, 50 samtidige «virtuelle brukere», 120 s wall-clock)

---

## 1. Testoppsett

| Felt | Verdi |
|------|--------|
| **Dato / tid** | 2026-04-17 (kjørt etter server «Ready») |
| **Endpoints** | `GET /api/sre/uptime` (lett UP-ping), `GET /api/health` (DB + env-sjekk) |
| **Mix** | 50 % uptime / 50 % health |
| **Samtidighet** | 50 parallelle løkker (konstant trykk) |
| **Varighet** | 120 s (2 min) |
| **Request rate** | Ikke fast RPS — maksimal rate begrenset av klientens evne til å fullføre `fetch` (åpen løkke til tidsstopp) |

**Avgrensning (ærlig):** Dette er **representativ API-last** for tilgjengelige **unauthenticated** GET-er som treffer Node-runtime og (for health) database. **`GET /api/order/window`**, **`GET /api/week`**, **`POST /api/order/set-day`** og **`GET /api/kitchen`** er **ikke** med i denne kjøringen (krever sesjon / roller). E0-punktet «ingen lasttest» er dermed **delvis** adressert med målbart bevis, ikke full autentisert kjerne-flyt.

---

## 2. Resultater

| Metrikk | Verdi |
|---------|--------|
| **Totalt antall requests** | 8 365 |
| **HTTP OK (2xx)** | 8 365 |
| **Feil** | 0 |
| **Feilrate** | 0 % |
| **Snitt responstid** | 718 ms |
| **p95 responstid** | 1 466 ms |
| **p99 responstid** | 2 714 ms |
| **Veggklokke** | ~120,6 s |

**Kort observasjon:** Ingen HTTP-feil i perioden; **p95 ~1,5 s** og **p99 ~2,7 s** på blanding med tung `/api/health` tyder på **akseptabel stabilitet** for dette scenariet, men **ikke** bevis for skala på autentiserte ordre-/uke-endepunkter.

---

## 3. Rå bevis

**Kommando:**  
`$env:BASE_URL="http://127.0.0.1:3000"; $env:LOAD_CONCURRENCY="50"; $env:LOAD_DURATION_MS="120000"; $env:LOAD_MIX="uptime:0.5,health:0.5"; node scripts/enterprise-proof-load.mjs`

**JSON-output (fra script):**

```json
{
  "base": "http://127.0.0.1:3000",
  "concurrency": 50,
  "durationMs": 120000,
  "mix": "uptime:0.5,health:0.5",
  "totalRequests": 8365,
  "ok": 8365,
  "fail": 0,
  "errorRatePct": 0,
  "avgLatencyMs": 717.99,
  "p95LatencyMs": 1465.68,
  "p99LatencyMs": 2714.48,
  "wallClockMs": 120600,
  "sampleErrors": []
}
```

---

## 4. Konklusjon

**Testen viser stabil drift innenfor valgt last** (50 samtidige, 2 min, 0 % HTTP-feil på valgt mix) for **uptime + health**.

---

## 5. Status mot E0

**E0: «Ingen lasttest» → DELVIS**

- **Bevis finnes:** Ja — dokumentert kjøring med tall og 0 % feilrate for definert scope.  
- **Full lukking:** **Nei** — autentiserte kjerne-endepunkter (ordre/uke/kitchen) er **ikke** lasttestet her; følg opp egen kjøring med testbruker/seed om full lukking kreves.
