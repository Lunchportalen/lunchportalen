# k6 Live Performance Suite — Lunchportalen

Enterprise load-testing suite for `app.lunchportalen.no` (and staging dry-runs).

## Prerequisites

### Install k6 (Windows)

```powershell
winget install GrafanaLabs.k6
# eller: choco install k6
k6 version
```

### Credentials

Smoke user: `smoke-test@lunchportalen.no` (Company A only — all writes scoped to this tenant).

Password lives in `.env.local` as `PLAYWRIGHT_TEST_PASSWORD` (provision via `node scripts/smoke/provision-smoke-user.mjs`).

## Quick start

**Staging dry-run (recommended før prod):**

Krever `VERCEL_AUTOMATION_BYPASS_SECRET` og `PLAYWRIGHT_TEST_PASSWORD` i `.env.local`.
Bruk git-staging URL (Vercel bypass fungerer pålitelig):

```powershell
$env:K6_TAG_ENV = "staging"
$env:K6_FASES = "smoke"
npm run k6:staging-smoke
```

`run.mjs` resolver automatisk `https://lunchportalen-git-staging-lunchportalen.vercel.app` når `K6_TAG_ENV=staging`.

**Auth-blocker (2026-05-23):** Hvis `/api/auth/login` returnerer `401 invalid_login` på staging (samme som `dc-011-smoke`), kjør `node scripts/smoke/provision-smoke-user.mjs` og verifiser at deploy env peker på staging Supabase (`uigxsboqeruxflgzqztl`). k6-scriptene er OK når login PASS i dc-011.

**Full prod suite (~55 min):**

```powershell
$env:K6_BASE_URL = "https://app.lunchportalen.no"
$env:K6_TAG_ENV = "prod"
$env:K6_FASES = "setup,smoke,baseline,soak,stress,spike,recovery"
node scripts/k6/run.mjs
```

**Direct k6 (all env vars explicit):**

```powershell
k6 run `
  -e K6_BASE_URL=https://staging.app.lunchportalen.no `
  -e K6_SMOKE_EMAIL=smoke-test@lunchportalen.no `
  -e K6_SMOKE_PASSWORD=<secret> `
  -e K6_TAG_ENV=staging `
  -e K6_FASES=smoke `
  --out json=scripts/k6/results/run.json `
  --summary-export scripts/k6/results/run-summary.json `
  scripts/k6/k6-live.js
```

## Faser

| Fase | VUs | Varighet | Formål |
|------|-----|----------|--------|
| setup | 1 | 30s | Pre-warm alle endepunkter |
| smoke | 1 | 1 min | Verifiser auth + alle endepunkter |
| baseline | 5→20 | 5 min | Normal last, etabler baseline |
| soak | 20 | 30 min | Memory leak / connection pool |
| stress | 20→100 | 10 min | Finn degraderingspunkt |
| spike | 50→150 | 3 min | Burst-absorpsjon |
| recovery | 5 | 5 min | Verifiser stabilisering |

Deaktiver faser med `K6_FASES` (kommaseparert). Eksempel: `K6_FASES=smoke,baseline`.

## Workload-mix

I baseline, soak, stress, spike og recovery:

| Scenario | Vekt | Endepunkt |
|----------|------|-----------|
| week_browse | 60% | `GET /api/week` |
| order_place | 20% | `POST /api/orders` (Idempotency-Key) |
| day_view | 10% | `GET /api/orders?date=<i dag>` |
| kitchen_view | 5% | `GET /api/kitchen/today` |
| health | 5% | `GET /api/health` |

Alle requests tagges med `scenario` + `endpoint` for granulær analyse.

## SLO / thresholds

Suite stopper automatisk (abort) ved kritiske brudd:

- `http_req_failed` > 5% → abort
- `http_req_duration` p99 > 5000ms → abort

Normal fail (exit code ≠ 0 ved slutt):

- `http_req_failed` > 1%
- `http_req_duration{expected:true}` p95 > 800ms
- Per-endpoint Trends (se `lib/thresholds.js`)

## Kjør enkeltscenario

```powershell
k6 run -e K6_SMOKE_PASSWORD=... scripts/k6/scenarios/smoke.js
k6 run -e K6_SMOKE_PASSWORD=... scripts/k6/scenarios/baseline.js
```

## Output

Resultater skrives til `scripts/k6/results/` (gitignored):

- `<timestamp>.json` — rå k6 metrics stream
- `<timestamp>-summary.json` — handleSummary export
- `<timestamp>-summary-export.json` — `--summary-export`

### HTML-rapport

HTML genereres automatisk av `k6-live.js` via [benc-uk/k6-reporter](https://github.com/benc-uk/k6-reporter) (CDN, ingen npm-pakke nødvendig):

- `scripts/k6/results/<timestamp>.html`

For enkeltscenario uten innebygd HTML:

```powershell
k6 run scripts/k6/scenarios/smoke.js 2>&1 | Out-File scripts/k6/results/console.txt
```

## Env-variabler

| Variabel | Påkrevd | Default |
|----------|---------|---------|
| `K6_BASE_URL` | ja | `https://app.lunchportalen.no` |
| `K6_SMOKE_EMAIL` | ja | `smoke-test@lunchportalen.no` |
| `K6_SMOKE_PASSWORD` | ja | — |
| `K6_FASES` | nei | alle faser |
| `K6_OUTPUT_DIR` | nei | `scripts/k6/results` |
| `K6_TAG_ENV` | nei | `prod` |

## Tolke resultater

1. **http_req_failed** — skal holde under 1% på staging smoke; prod baseline typisk < 0.5%.
2. **Per-endpoint Trends** — sammenlign p95 mot SLO i `lib/thresholds.js`.
3. **Tags** — filtrer JSON på `scenario` / `endpoint` for å finne flaskehalser.
4. **order_place 409/422** — forventet ved duplikat/validering; telles ikke som infra-feil (checks tillater disse).

## Sikkerhet / scope

- Writes kun mot Company A smoke-bruker
- Idempotency-Key på alle `POST /api/orders`
- Ingen Sanity-skriving (kun read via `/api/week`)
- Ingen Tripletex-webhook-trigger

Se også: `docs/audit/k6-live-runbook.md`
