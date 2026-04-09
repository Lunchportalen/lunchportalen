# CMS main base — Åpne risikoer

**Dato:** 2026-03-29  
**Primær kilde:** `docs/hardening/OPEN_PLATFORM_RISKS.md`, `docs/enterprise-ready/ENTERPRISE_LIVE_OPEN_RISKS.md`, `UMBRACO_LEVEL_CMS_TRAFFIC_LIGHT_MATRIX.md`.

## A. Arkitektur / sannhet

| ID | Risiko |
|----|--------|
| B1 | To spor for «uke» (Sanity `weekPlan` vs meny/`mealType`) — krever produkt/UX-klarhet. |
| D4 | Flere CMS/backoffice-ruter øker **flate** for gating-feil. |

## B. Plattform

| ID | Risiko |
|----|--------|
| A1 | Middleware uten rolle. |
| A2 | Stor APIflate — inkonsistent gate. |
| A3 | `strict: false`. |
| E1 | Worker job stubs. |
| E2 | Cron drift/dobbelkjøring. |

## C. Growth

| ID | Risiko |
|----|--------|
| D1 | Social ekstern publish — DRY_RUN. |
| D2 | SEO forventning vs batch/editor. |
| D3 | ESG tom data — tolkning. |

## D. CMS-spesifikt

- **Dokumentasjon vs kode:** Ved avvik vinner **kode** — jf. bruker mandate.

---

**Stoppregel:** Ingen nye produktfaser startet herfra uten eksplisitt instruks.
