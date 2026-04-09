# H2 — Observability minimum (pilot)

**Dato:** 2026-03-29  
**Mål:** Se **5xx**, **cron-feil**, og **operativ helse** uten ny plattform.

## 5xx / API-feil (prosess-lokal)

| Mekanisme | Hvor |
|-----------|------|
| `runInstrumentedApi` | Teller **500+** respons via `recordError()` i `lib/observability/store.ts`. |
| `GET /api/observability` | Superadmin — returnerer `processMetrics` (requests, errors, errorRate, latency). |

## Cron failure visibility

| Mekanisme | Hvor |
|-----------|------|
| `cron_runs` tabell | Skrives av **outbox** (og andre jobber, f.eks. forecast/preprod) ved ok/feil. |
| **H2:** `GET /api/observability` | Inkluderer nå `cronRecentFailures`: siste **20** rader med `status=error` (sortert `ran_at` desc). |
| `lib/observability/sli.ts` | `computeSliCronOutbox` bruker `cron_runs` — meldinger oppdatert til å matche faktisk atferd. |

## Social publish failures

| Observasjon | Hvor |
|-------------|------|
| API returnerer **200** med `published: false`, `PUBLISH_DRY_RUN` når Meta ikke er koblet — **ikke** 5xx. | `POST /api/social/posts/publish` |
| Operatør må sjekke **respons-body** og `cron_runs` / applogg — ikke bare HTTP-status. |

## ESG / SEO

| Flate | Minimum |
|-------|---------|
| **ESG** | Feil i API → **5xx** + `jsonErr`; superadmin `/api/observability` for prosessfeil. Ingen egen ESG-dashboard i H2. |
| **SEO** | `build:enterprise` kjører SEO-skript; feil **blokkerer** deploy — se CI-logg. |

## Mangler (eksplisitt)

- Ingen sentral **PagerDuty** / **Slack**-kobling i denne fasen.
- Ingen dedikert **dashboard** kun for social dry-run — avhenger av API-svar + manuell review.

## Kodeendringer (H2)

- `app/api/observability/route.ts` — `cronRecentFailures` i payload.
