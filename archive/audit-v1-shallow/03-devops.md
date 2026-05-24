# Enterprise Audit — Fase 3: DEVOPS / Platform Deep-Audit

**Date:** 2026-05-24  
**Scope:** READ-ONLY · GitHub CI/CD · Vercel · Supabase ops · Azure Umbraco · security headers  
**Baseline:** [00-inventory.md](./00-inventory.md) · [01-backend.md](./01-backend.md) · [02-frontend.md](./02-frontend.md)  
**Method:** Workflow scan, `git log`, live HTTP headers (PowerShell), `npm audit`, `npm run test:run`, `git check-ignore`

---

## Executive summary (Fase 3)

| # | Severity | Område | Funn | Bevis | Eier |
| --- | --- | --- | --- | --- | --- |
| F3-01 | **P1** | Branch policy | **3 FIX-commits** på `origin/staging` ikke på `origin/main` (DC-032 read-path). Gjentatt marathon-mønster. | §3.1 | [DEVOPS] |
| F3-02 | **P1** | CI gate truth | `ci-enterprise.yml` build-steg har **`continue-on-error: true`**; `audit:api`/`audit:repo` non-blocking. Avvik fra `docs/RELEASE_GATE.md`. | §3.2 | [DEVOPS] |
| F3-03 | **P1** | Env-paritet | **225** kode-env vs **38** Vercel-navn; staging-only Supabase/Sanity-blokk. (F0-03 bekreftet.) | §3.4 | [DEVOPS] |
| F3-04 | **P1** | Security headers (Umbraco) | `lunchportalen.no`: **ingen HSTS, CSP, X-Frame-Options, COOP/COEP**; `X-Powered-By: ASP.NET`. | §3.8 | [DEVOPS] |
| F3-05 | **P2** | Security headers (Vercel app) | `app.lunchportalen.no`: **HSTS** ✓ på HTML/API; **mangler CSP, X-Frame-Options, COOP/COEP, Referrer-Policy** på `/login`. | §3.8 | [DEVOPS] |
| F3-06 | **P2** | Secret management | Git history-scan: **ingen P0** live-nøkler i `.env*` commits; **ingen dokumentert rotasjonspolicy**. | §3.5 | [DEVOPS] |
| F3-07 | **P2** | SLO/SLI | SLO-registry finnes (`docs/SLO_ALERTING_RUNBOOK.md`); **ingen ekstern varsling** (PagerDuty/Slack/e-post). | §3.7 | [DEVOPS] |
| F3-08 | **P2** | npm CVE | **0 HIGH/CRITICAL**; **7 MODERATE** (vitest/vite dev chain). `security-audit.yml` kjører daglig. | §3.2 | [DEVOPS] |
| F3-09 | **P2** | Branch protection | **`gh` CLI utilgjengelig** — GitHub required reviews/status checks **ikke verifisert** via API. | §3.1 | [DEVOPS] |
| F3-10 | **P2** | Test fundament | **9 failing tests** (3 filer — kitchen batch 403, B1-04); **2405 passed** / 2538 total. | §3.13 | [DEVOPS+BACKEND] |
| F3-11 | **P2** | Backup/DR | Supabase **PITR ikke verifisert** i audit-sesjon; ingen dokumentert restore-test i repo. | §3.9 | [DEVOPS] |
| F3-12 | **P2** | Incident response | `/status` = bruker-blokkerings-UX, **ikke** public status-page; ingen ekstern on-call dokumentert. | §3.10 | [DEVOPS] |

---

## 3.1 Branch policy

### Divergens `origin/staging` → `origin/main`

```bash
git log origin/main..origin/staging --oneline -- app/ lib/ types/ supabase/migrations/
```

| SHA | Klassifisering | Tittel | Filer | Rationale |
| --- | --- | --- | --- | --- |
| `e635940e` | **FIX** | `fix(dc-032): use profiles.id (canonical) instead of profiles.user_id` | `week/route.ts`, `me/route.ts`, `me/agreement`, `scope/options` | **Prod-fix:** ghost `user_id` lookup → 500 på `/api/week`. Minimal, må til main. |
| `dab42931` | **FIX** | `fix(dc-032): week profile select — drop missing disabled_reason` | `week/route.ts`, `k6/checks.js` | **Prod-fix:** kolonne finnes ikke i schema. K6 smoke 403 accept. |
| `b708e545` | **FIX** | `fix(dc-032): allow employee scope on orders/today GET/POST` | `orders/today/route.ts` | **Prod-fix:** feil admin-only guard blokkerte employee + K6 day_view. |

**Ingen** av de 3 er WIP/EXPERIMENT/HOTFIX-STAGING-ONLY — alle er **production FIX** som bør være på `main`.

### Lokal `main` vs remote

| Ref | Note |
| --- | --- |
| Local `main` `2aeb7d9f` | **3 commits ahead** of `origin/main` — cherry-picks av samme DC-032 fixes + ghost-kolonne patch |
| `origin/main` `3cf4e294` | Prod deploy baseline — **mangler** DC-032 fixes |

### GitHub branch protection

| Sjekk | Resultat |
| --- | --- |
| `gh api .../branches/main/protection` | **Utilgjengelig** — `gh` ikke installert i audit-miljø (F3-09) |
| Dokumentert merge gate | `ci.yml` på `push`/`pull_request` → **`main`** (blokkerende steps) |
| `staging` branch CI | **Ikke** i `ci.yml` triggers — kun `main` |

**Due-diligence gap:** Branch protection rules (required reviews, required checks) må verifiseres manuelt i GitHub Settings eller med `gh` — ikke skimmet som «OK» uten API-bevis.

---

## 3.2 CI-gates

**15 workflows** (fra Fase 0 §0.6). Nøkkel-gates:

| Workflow | Trigger | Blokkerer merge? | Funn |
| --- | --- | --- | --- |
| **`ci.yml`** | push/PR `main` | **Ja** | `ci:guard` → platform-guards → typecheck → lint → test → tenant → **`build:enterprise:ci`**; audits **informational** (`continue-on-error`) |
| **`ci-enterprise.yml`** | push `main`, PR, cron 03:00 | **Delvis** | Pre-audit blocking; **post-audit build `continue-on-error: true`** (L149–150) |
| `ci-e2e.yml` | push/PR `main` | Ja (e2e) | Playwright |
| `security-audit.yml` | cron 07:00 | Advisory | `npm audit --audit-level=high` |
| `rls-drift-check.yml` | scheduled/PR | Advisory | RLS snapshot drift |

### Avvik `docs/RELEASE_GATE.md` vs `ci-enterprise.yml`

`RELEASE_GATE.md` L19: «No step uses `continue-on-error`».

**Faktisk:** `ci-enterprise.yml` L150 `continue-on-error: true` på post-audit build; L132–133 audit non-blocking.

**F3-02 P1:** Release gate documentation og enterprise workflow er **ikke aligned**.

### npm audit (2026-05-24)

```
npm audit --audit-level=high → 0 high, 0 critical
7 moderate (vitest → vite chain, devDependencies)
```

---

## 3.3 Vercel-konfig

**`vercel.json`:** Kun **13 cron**-entries — ingen `headers`, `rewrites`, concurrency caps.

| Aspekt | Verdi |
| --- | --- |
| Crons | 13 paths (outbox */2, tripletex */3, …) — se §1.9 i `01-backend.md` |
| Edge vs Node | API routes default **`export const runtime = "nodejs"`** på cron/kritiske paths |
| Headers i repo | `next.config.ts` L22–34: kun **Cache-Control** på `/og/*` — **ingen security headers** definert i Next config |
| Vercel platform | Legger **HSTS** på deploy (observert live); CSP/COOP **ikke** |

**Preview deploys:** Standard Vercel preview per PR — ingen dokumentert cleanup-policy i repo.

---

## 3.4 Env-paritet

(Fra Fase 0 §0.7 — bekreftet uendret.)

| Kilde | Count |
| --- | ---: |
| `process.env.*` i kode | **225** |
| Vercel env navn | **38** |
| `.env.example` | **~15** |

**Kritisk gap (F3-03):** Staging Supabase/Sanity/CRON block kun på Vercel **`staging`** env — prod og staging deploy kan peke på **ulike** backends uten synlighet i git.

**`.env.local`:** `git check-ignore -v .env.local` → **`.gitignore:13`** ✓

---

## 3.5 Secret management (ekspert — git history-scan)

### Metode

```bash
git check-ignore -v .env.local
git log --all -p -G "eyJhbGci" -- "*.env" "*.env.*"   # JWT in env files → empty
git log --all -p -G "sk_live_" -- .                   # Stripe live → empty
git log --all -p -G "CRON_SECRET=" -- .               # only docs commits (dc-026/dc-029)
```

### Resultat

| Sjekk | Resultat |
| --- | --- |
| `.env.local` tracked? | **Nei** — gitignored |
| JWT/service-role i committed `.env*` | **Ingen treff** i targeted `-G` scan |
| `CRON_SECRET=` in history | Kun **dokumentasjon** commits, ikke literal secrets i diff sample |
| Pre-commit secret hook | **Ingen** `.husky/` hooks funnet |

### Rotasjon

| Secret | Dokumentert rotasjon | Siste rotasjon i repo |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | **Nei** | — |
| `CRON_SECRET` | **Nei** | — |
| `SANITY_WEBHOOK_SECRET` | **Nei** | — |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Referert i k6 docs | 2026-05-23 DC-028 |

**F3-06 P2:** Ingen P0 eksponering funnet, men **ingen enterprise rotasjonspolicy** → due-diligence gap.

---

## 3.6 Observability

| Komponent | Bevis | Status |
| --- | --- | --- |
| Sentry | `lib/sentry/scrubEvent.ts` | `sendDefaultPii: false`, `beforeSend` scrubber cookies/auth/email/phone; env mapping prod/staging/preview |
| Structured logging | `opsLog`, `X-Rid` headers | Sporbar RID på API |
| SLI/SLO | `lib/observability/sli.ts`, `sloRegistry.ts` | **6 SLO-er** definert |
| Cron failures UI | `app/api/observability/route.ts` | Leser `cron_runs` — **tom/degraded** (B1-09) |
| Tracing | Sentry `tracesSampleRate` 0.1 prod | Delvis APM |

---

## 3.7 SLO/SLI

**Kilde:** `docs/SLO_ALERTING_RUNBOOK.md` + `lib/observability/sloRegistry.ts`

| SLO-id | Mål | SLI-kilde | Audit-note |
| --- | ---: | --- | --- |
| `system_health` | 99.5% | `system_health_snapshots` | Operativ |
| `cron_critical` | 99% | `cron_runs` | **Unknown/degraded** — tabell mangler (B1-09) |
| `cron_outbox` | 99% | `cron_runs` job=outbox | **Unknown** — samme root cause |
| `order_write` | 99.5% | åpne `system_incidents` ORDER | Proxy-SLI, ikke request-rate |
| `auth_protected_route` | 99.9% | åpne AUTH incidents | Proxy-SLI |
| `content_publish` | 99% | SANITY/INTEGRATION incidents | Proxy-SLI |

**F3-07 P2:** Runbook er ærlig om **ingen ekstern varsling** (L47–49). Alarmer kun i Superadmin UI.

---

## 3.8 Security headers (ekspert — live curl)

**Metode:** `Invoke-WebRequest` HEAD/GET 2026-05-24.

### `app.lunchportalen.no` (Vercel / Next.js)

| URL | HSTS | CSP | X-Frame-Options | X-Content-Type-Options | COOP | COEP | Referrer-Policy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/health` | **✓** `max-age=63072000` | ✗ | ✗ | **✓** `nosniff` | ✗ | ✗ | ✗ |
| `/login` (HTML) | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `/week` (302→login) | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**F3-05 P2:** App har **HSTS** (Vercel default) og nosniff på API — **mangler CSP og clickjacking-headers** på HTML surfaces.

### `lunchportalen.no` (Azure IIS / Umbraco)

| Header | Verdi |
| --- | --- |
| `Server` | Microsoft-IIS/10.0 |
| `X-Powered-By` | ASP.NET |
| `Strict-Transport-Security` | **Mangler** |
| `Content-Security-Policy` | **Mangler** |
| `X-Frame-Options` | **Mangler** |
| `Cross-Origin-Opener-Policy` | **Mangler** |

**F3-04 P1:** Marketing-domene **uten HSTS/CSP** — due-diligence kjernefelt for public-facing site.

---

## 3.9 Backup & DR

| Aspekt | Status |
| --- | --- |
| Supabase PITR | **Ikke verifisert** via MCP/dashboard i denne sesjonen |
| Documented RTO/RPO | `docs/hardening/OBSERVABILITY_AND_OPERATIONS_PLAN.md` nevner PITR — **ikke tallfestet** |
| Restore test | **Ingen** dokumentert verified restore i repo |
| Runbook «alt nede» | Delvis — SLO runbook + superadmin system |

**F3-11 P2:** DR readiness ** ikke bevist** — klassisk due-diligence spørsmål.

---

## 3.10 Incident response

| Aspekt | Status |
| --- | --- |
| `/status` route | **Bruker-blokkerings-UX** (`app/status/page.tsx`) — ikke offentlig status.incident.io |
| On-call | **Ikke dokumentert** (1-mann RC antatt) |
| Post-mortems | **Ingen** index i repo siste 6 mnd |
| Superadmin incidents | `system_incidents` + SLO UI |

**F3-12 P2**

---

## 3.11 Cost monitoring

| Provider | Alerts i repo |
| --- | --- |
| Vercel | **Nei** |
| Supabase | **Nei** |
| Sanity | **Nei** |
| Sentry | Quota via Sentry dashboard — ikke i repo |

**Funn-count: 0** (informative gap, P3 om ikke krevet)

---

## 3.12 Umbraco-platform

| Aspekt | Verdi |
| --- | --- |
| Deploy | `.github/workflows/main_lunchportalen-umbraco.yml` → Azure **`lunchportalen-umbraco`** |
| Trigger | push `main` paths `umbraco17/lunchportalen/**` |
| Stack | .NET 10, IIS (live headers) |
| Security | Se §3.8 — **F3-04** |
| CI/CD | **Separat** fra Next.js Vercel pipeline |

---

## 3.13 Tester-fundament

**Kjørt:** `npm run test:run` (2026-05-24)

| Metrikk | Verdi |
| --- | ---: |
| Test files | 499 (472 pass, 3 fail, 24 skip) |
| Tests | 2538 (2405 pass, **9 fail**, 124 skip) |
| Failing | 3 kitchen-batch files — **403** (B1-04 profileLookup) |

**CI implication:** `ci.yml` kjører `test:run` som **blocking** — local main med kitchen-regresjon ville **fail CI** hvis pushet uten fix.

**E2E:** `ci-e2e.yml` separat; Playwright ikke kjørt i Fase 3 sesjon.

---

## Fase 3 completeness-sjekk (pre STOP-PUNKT 3)

| Sub-item | Status | Funn-count | Note |
| --- | --- | ---: | --- |
| 3.1 branch policy | **COVERED** | 2 | F3-01 (3× FIX klassifisert) + F3-09 (protection API uverifisert) |
| 3.2 CI-gates | **COVERED** | 2 | F3-02 (continue-on-error) + F3-08 (7 moderate CVE) |
| 3.3 Vercel-konfig | **COVERED** | 0 | Crons + node runtime dokumentert; ingen P1 |
| 3.4 env-paritet | **COVERED** | 1 | F3-03 (225 vs 38) |
| 3.5 secret management | **COVERED** | 1 | F3-06 — history scan clean, rotasjon mangler |
| 3.6 observability | **COVERED** | 0 | Sentry scrub + RID; cron SLI blind (B1-09 cross-ref) |
| 3.7 SLO/SLI | **COVERED** | 1 | F3-07 — ingen ekstern varsling |
| 3.8 security headers | **COVERED** | 2 | F3-04 (Umbraco P1) + F3-05 (Vercel P2) |
| 3.9 backup & DR | **COVERED** | 1 | F3-11 — PITR/restore ikke bevist |
| 3.10 incident response | **COVERED** | 1 | F3-12 |
| 3.11 cost monitoring | **COVERED** | 0 | Ingen alerts dokumentert — informativt |
| 3.12 Umbraco-platform | **COVERED** | 1 | F3-04 (deles med 3.8) — egen pipeline OK |
| 3.13 tester-fundament | **COVERED** | 1 | F3-10 — 9 failing kitchen tests |

**Due-diligence kjernefelt (3.5, 3.8):** Ekspertvurdert med git `-G` scan + live headers — **ikke skim**.

---

## STOP-PUNKT 3

Fase 3 DEVOPS/Platform-leveranse er **komplett**.

**Vent på:** `GO Fase 4` for syntese → `00-executive-summary.md`.

**Ikke start Fase 4** uten eksplisitt GO.

---

## Appendiks — kommandoer

```powershell
# Security headers
Invoke-WebRequest -Uri "https://app.lunchportalen.no/api/health" -Method Head -UseBasicParsing
Invoke-WebRequest -Uri "https://app.lunchportalen.no/login" -UseBasicParsing
Invoke-WebRequest -Uri "https://lunchportalen.no/" -Method Head -UseBasicParsing

# Branch divergens
git log origin/main..origin/staging --oneline -- app/ lib/ types/ supabase/migrations/

# Secrets
git check-ignore -v .env.local
git log --all -p -G "eyJhbGci" -- "*.env" "*.env.*"

# Tests + audit
npm audit --audit-level=high
npm run test:run
```
