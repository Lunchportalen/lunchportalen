# k6 Live Performance Test — Runbook

**Scope:** RC prod baseline + stress (controlled)  
**Suite:** `scripts/k6/k6-live.js`  
**Varighet full kjøring:** ~55 min  
**Mål:** BASELINE + STRESS — ikke å ødelegge prod.

Teknisk referanse: `scripts/k6/README.md`

---

## 30 min før kjøring

- [ ] Bekreft testvindu med lavt trafikkvolum
- [ ] Sjekk smoke-bruker virker: login via nettleser mot `https://app.lunchportalen.no` (`smoke-test@lunchportalen.no`)
- [ ] Verifiser `.env.local` har passord satt (`PLAYWRIGHT_TEST_PASSWORD` eller `K6_SMOKE_PASSWORD`)
- [ ] Staging dry-run PASS (BLOCKER for første prod-kjøring):

  ```powershell
  npm run k6:staging-smoke
  ```

  Forvent: exit 0, `http_req_failed` = 0%, alle checks grønne.  
  Ved `401 invalid_login` på staging: se `scripts/smoke/provision-smoke-user.mjs` og dc-011-notat.

- [ ] Sett Sentry alert-rules på «mute for 90 min» eller forleng duration
- [ ] Si fra til eventuelle andre developers så de ikke er forvirret av spikes

---

## 5 min før kjøring

- [ ] Åpne fire browser-tabs side-ved-side:
  - **Vercel Dashboard** → Speed Insights (prod)
  - **Vercel Dashboard** → Logs (prod, live)
  - **Supabase Dashboard** → Reports → API performance (prod)
  - **Sentry** → Issues (filter: prod, last 1h)
- [ ] Terminal klar i repo-root (`c:\prosjekter\lunchportalen` eller tilsvarende)
- [ ] Sjekk at ingen Vercel-deploy er pågående (vent til **Ready**)
- [ ] k6 tilgjengelig: `k6 version` (eller `winget install GrafanaLabs.k6`)

---

## Under kjøring

Sett prod-env én gang:

```powershell
$env:K6_BASE_URL = "https://app.lunchportalen.no"
$env:K6_TAG_ENV = "prod"
```

- [ ] Lett dry-run først:

  ```powershell
  $env:K6_FASES = "smoke"
  node scripts/k6/run.mjs
  ```

- [ ] Hvis OK — kjør full suite:

  ```powershell
  $env:K6_FASES = "setup,smoke,baseline,soak,stress,spike,recovery"
  node scripts/k6/run.mjs
  ```

  Alternativ: `npm run k6:live` (sjekk at `K6_FASES` og `K6_BASE_URL` er satt som over).

- [ ] Watch i parallell:
  - Vercel Logs for 5xx-spikes
  - Supabase active connections (skal aldri nå pool-limit)
  - Sentry for nye issue-typer
- [ ] Ha **Ctrl+C** klar — k6 stopper testen umiddelbart

### Innebygde abort-thresholds (k6 stopper auto)

| Metrikk | Grense |
|---------|--------|
| `http_req_failed` | > 5% → abort |
| `http_req_duration` p99 | > 5000 ms → abort |

Normal SLO-fail (exit ≠ 0 ved slutt, ikke nødvendigvis auto-abort): `http_req_failed` > 1%, p95 > 800 ms. Se `scripts/k6/lib/thresholds.js`.

---

## Abort-triggers (manuell intervensjon)

Avbryt med **Ctrl+C** og noter tidspunkt + aktiv fase hvis:

- Faktisk kundeklage kommer inn (sjekk Slack/e-post)
- Supabase active connections > 80% av pool
- Vercel 5xx-rate > 5%
- En cron-job feiler under testen (kollisjon med k6)

---

## Etter kjøring

- [ ] JSON-output i `scripts/k6/results/<timestamp>.json`
- [ ] Summary i `scripts/k6/results/<timestamp>-summary.json` og `*-summary-export.json`
- [ ] HTML-rapport: `scripts/k6/results/<timestamp>.html` (genereres automatisk av `k6-live.js`)
- [ ] Sjekk Sentry for nye issues introdusert (vurder hver enkelt)
- [ ] Sjekk Supabase slow query-logger (top 10)
- [ ] Skriv `docs/audit/k6-live-<YYYY-MM-DD>.md` med funn

### Metrikk-sjekkliste (SLO)

- [ ] `http_req_failed` < 1%
- [ ] `week_browse_duration` p95 < 800 ms
- [ ] `order_place_duration` p95 < 1500 ms
- [ ] Ingen uventede 5xx i Company A ordrelogg
- [ ] `/superadmin/system` health OK etter test (manuell spot-check)

---

## Recovery-validering

- [ ] **5 min** etter test-stopp: er prod-respons normal igjen?
- [ ] **30 min** etter: ingen lingering errors i Sentry?
- [ ] **24 timer** etter: business-tall ok? Ingen anomalier?

---

## Fase-oversikt (referanse)

| Fase | VUs | Varighet | Notat |
|------|-----|----------|-------|
| setup | 1 | 30s | Pre-warm alle endepunkter |
| smoke | 1 | 1 min | Verifiser auth + endpoints |
| baseline | 5→20 | 5 min | Normal last |
| soak | 20 | 30 min | Memory leak / connection pool |
| stress | 20→100 | 10 min | Degraderingspunkt |
| spike | 50→150 | 3 min | Burst |
| recovery | 5 | 5 min | Stabilisering |

Delvis kjøring: `K6_FASES=smoke,baseline` (kommaseparert).

---

## Referanser

- Suite README: `scripts/k6/README.md`
- Smoke provision: `scripts/smoke/provision-smoke-user.mjs`
- Auth preflight: `node scripts/k6/preflight-auth.mjs`
- AGENTS.md — ingen k6 CI-gate; marathon er manuell
