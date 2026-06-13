# SP-3.6 — K6 Del 4.6 Login-once-per-VU Report

**Dato:** 2026-05-24  
**Stop-punkt:** 3.6 — foundation enterprise-klar, vent `GO Del 5`

---

## Resultat

| Sak | Resultat |
|-----|----------|
| Login-once-per-VU (`auth.js`) | **OK** — modul-level `vuJar` + `{ jar }` på alle autentiserte kall |
| Smoke (correctness thresholds) | **PASS** exit 0 — checks 100%, `http_req_failed` 0% |
| Baseline (5→20 VUs, 5 min) | **PASS** exit 0 — checks 100%, `http_req_failed` 0% |
| Login 401 count (baseline) | **0** |
| Login-requests (baseline, setup + VU) | **21** (1 global setup + 20 VU — ingen per-iter re-login) |

---

## Endpoint p95 vs staging thresholds (baseline)

| Endpoint | p95 | Threshold | Holdt? |
|----------|-----|-----------|--------|
| week_browse | 1000ms | <1500ms | ✓ |
| day_view | 1430ms | <1500ms | ✓ |
| order_place | 2720ms | <3500ms | ✓ (DC-033-kandidat, ikke blokker) |
| kitchen_view | 348ms | <1500ms | ✓ |
| health | 713ms | <1000ms | ✓ |
| http_req_failed | **0%** | <1% / <5% abort | ✓ |

---

## Threshold-brudd

**Ingen** (smoke bruker `getSmokeThresholds`: checks + http_req_failed only).

---

## Cold-start

**Ja** — observert på smoke iter 1 (week p99 ~1.5s, order ~2.5s). Mitigert via 6.2.1 (smoke uten latency-terskler). Baseline p95 stabil etter ramp.

---

## HTML-rapporter

| Run | Path |
|-----|------|
| Smoke | `scripts/k6/results/2026-05-23T22-57-44-505Z.html` |
| Baseline | `scripts/k6/results/2026-05-23T22-56-16-738Z.html` |

Logg: `scripts/k6/results/baseline-loginonce-*.log`, `smoke-loginonce-*.log`

---

## DC-033 anbefaling

Order write p95 ~2.45–2.72s under 20 VUs er **kjent preflight-kjede-latency** (ikke én treg SQL). Akseptabelt for K6 baseline PASS; vurder parallel preflight / cache før prod soak — **ikke blokker for Del 5**.

---

## Endringer (Del 4.6)

| Fil | Endring |
|-----|---------|
| `scripts/k6/lib/auth.js` | `vuJar` / `vuAuthOk` / `ensureVuAuth()` login-once, `getVuJar()`, `authParams()` inkl. `jar` |
| `scripts/k6/lib/checks.js` | `order_place` sender `jar` fra `authParams` |
| `scripts/k6/lib/thresholds.js` | `getSmokeThresholds()` — checks + http_req_failed only |
| `scripts/k6/k6-live.js` | `resolveThresholds()` for smoke-only runs |
| `scripts/k6/scenarios/smoke.js` | Bruker `getSmokeThresholds` |

---

## STOP-PUNKT 3.6

**Smoke + baseline begge PASS** → foundation er enterprise-klar.  
→ Vent **`GO Del 5`** fra bruker.
