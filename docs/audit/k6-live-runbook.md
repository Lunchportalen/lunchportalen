# k6 Live Runbook — Lunchportalen

**Dato:** 2026-05-23  
**Scope:** RC prod performance baseline + stress (controlled)  
**Suite:** `scripts/k6/k6-live.js`

---

## 1. Formål

Etablere reproducerbar lastprofil mot `app.lunchportalen.no` med:

- Realistisk mixed workload (employee week browse dominant)
- SLO-baserte thresholds med auto-abort ved kritisk brudd
- Strukturert JSON/HTML output for marathon dag 4 analyse

**Mål:** BASELINE + STRESS — ikke å ødelegge prod.

---

## 2. Forutsetninger

| Krav | Verifisering |
|------|--------------|
| k6 installert | `k6 version` |
| Smoke-bruker aktiv | `smoke-test@lunchportalen.no` i Company A |
| Passord i `.env.local` | `PLAYWRIGHT_TEST_PASSWORD` |
| Staging dry-run PASS | `K6_FASES=smoke` mot staging |

Provision smoke user (staging):

```bash
node scripts/smoke/provision-smoke-user.mjs
```

---

## 3. Testvindu

- **Planlagt:** Marathon dag 4, avtalt testvindu (lav trafikk)
- **Varighet full suite:** ~55 min
- **Rollback:** Stopp k6 (Ctrl+C); ingen data-migrering nødvendig

---

## 4. Kjøreplan

### 4.1 Staging dry-run (BLOCKER for prod)

```powershell
$env:K6_BASE_URL = "https://staging.app.lunchportalen.no"
$env:K6_TAG_ENV = "staging"
$env:K6_FASES = "smoke"
node scripts/k6/run.mjs
```

**PASS:** exit 0, `http_req_failed` = 0%, alle checks grønne.

**FAIL handling:**

| Symptom | Handling |
|---------|----------|
| 401 login | Kjør `provision-smoke-user.mjs`; verifiser staging deploy env = Supabase `uigxsboqeruxflgzqztl` (samme som dc-011 FAIL) |
| Threshold brudd | Fix script/threshold — ikke prod |
| 5xx spikes | Escaler til platform — utsett prod |

### 4.2 Staging full suite (valgfri)

```powershell
$env:K6_FASES = "setup,smoke,baseline,soak,stress,spike,recovery"
node scripts/k6/run.mjs
```

### 4.3 Prod baseline (første prod-kjøring)

```powershell
$env:K6_BASE_URL = "https://app.lunchportalen.no"
$env:K6_TAG_ENV = "prod"
$env:K6_FASES = "setup,smoke,baseline"
node scripts/k6/run.mjs
```

### 4.4 Prod full marathon (kun etter baseline PASS)

```powershell
$env:K6_FASES = "setup,smoke,baseline,soak,stress,spike,recovery"
node scripts/k6/run.mjs
```

---

## 5. Abort-kriterier (innebygd)

k6 stopper testen automatisk hvis:

- `http_req_failed` > 5%
- `http_req_duration` p99 > 5000ms

Manuell abort: Ctrl+C + dokumenter tidspunkt og aktiv fase.

---

## 6. Artefakter

Lagres i `scripts/k6/results/`:

- `*.json` — rå metrics
- `*-summary.json` — aggregert summary
- HTML via `k6-reporter` (valgfritt)

Arkiver med timestamp + miljø (`staging` / `prod`) i filnavn.

---

## 7. Post-run sjekkliste

- [ ] `http_req_failed` < 1%
- [ ] `week_browse_duration` p95 < 800ms
- [ ] `order_place_duration` p95 < 1500ms
- [ ] Ingen uventede 5xx i Company A ordrelogg
- [ ] `/superadmin/system` health OK etter test (manuell spot-check)

---

## 8. Referanser

- Suite README: `scripts/k6/README.md`
- Smoke provision: `scripts/smoke/provision-smoke-user.mjs`
- AGENTS.md CI gates (ingen k6 gate — manuell marathon)
