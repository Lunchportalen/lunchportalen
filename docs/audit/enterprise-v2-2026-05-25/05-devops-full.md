# Fase E — DevOps Full Deep

**Audit:** Enterprise v2 · **Dato:** 2026-05-25  
**Metode:** READ-ONLY · 15 workflows fil-åpnet · prod HTTP headers · git history · infra/k8s/workers deep  
**Status:** SUB E.1 + E.2 + E.3 **COMPLETE** → STOP-PUNKT E

**Pre-gate:** D-PAGE-01 verifisert **MOCK** (ikke P0) — Fase E fortsatt ([04-frontend-full.md §D.1.4](./04-frontend-full.md)).

**Artifacts:**

- `.tmp/curl-headers-voc.txt` — security header VOC (10 routes)
- `.tmp/curl-dashboard-anon.html` — D-PAGE-01 cross-ref
- v1 baseline: `archive/audit-v1-shallow/03-devops.md` (F3-* IDs re-verified)

---

## Coverage-ledger (Fase E)

| Sub | Scope | Filer åpnet | Coverage |
| --- | --- | ---: | ---: |
| **E.1** | Workflows + branch + git secrets | 15 YAML + `.githooks/pre-push` + `scripts/ci-guard.mjs` | 100% workflows |
| **E.2** | k8s/workers/infra/Vercel/Sentry | k8s/*, workers/*, infra/*, vercel.json, next.config.ts, sentry tri-config | 100% scope |
| **E.3** | Headers + observability + cost | 10 prod curls + SLO docs + v1 env matrix carry | VOC complete |

---

# SUB E.1 — Workflows + branch + secrets git-history

## E.1.1 GitHub Actions — alle 15 workflows (fil-åpnet)

| Workflow | Triggers | Jobs | Deploy / effekt | Secrets (count) |
| --- | --- | ---: | --- | ---: |
| `ci.yml` | push main, PR | 1 `build` | **Canonical release gate** | 8 |
| `ci-enterprise.yml` | push, PR, cron 03:00, dispatch | 1 `enterprise` | RC gate (build **non-blocking** post-audit) | 8 |
| `ci-agents.yml` | push main, PR | 1 `agents_gate` | Light gate; **postdeploy trigger** | 2 |
| `ci-e2e.yml` | push, PR, dispatch | 1 `e2e` | Localhost Playwright | 16 |
| `supabase-migrate.yml` | PR, push main, dispatch | 2 staging/prod | **Prod DB push on main** | 5 |
| `main_lunchportalen-umbraco.yml` | push main (umbraco17/**), dispatch | build+deploy | **Azure** `lunchportalen-umbraco` | 3 Azure OIDC |
| `postdeploy.yml` | workflow_run (ci-agents), dispatch | 1 | HTTP smoke `POSTDEPLOY_BASE_URL` | 1 |
| `rls-drift-check.yml` | cron 06:00, dispatch | 1 | Prod Postgres drift read | 1 `DATABASE_URL` |
| `security-audit.yml` | cron 07:00, dispatch | 1 | `npm audit --audit-level=high` | 0 |
| `deps-weekly.yml` | cron Mon 06:00, dispatch | 1 | Opens deps PR | 0 |
| `codex-audit-autofix.yml` | cron 20:00, dispatch | 1 | Bot PR + `risk:low` | 2 |
| `codex-design-system.yml` | cron 20:15, dispatch | 1 | Bot PR design | 1 |
| `automerge-lowrisk.yml` | PR events | 1 | Squash merge on label | GITHUB_TOKEN |
| `auto-engineer.yml` | dispatch only | 1 | Bot PR (no env) | 0 |
| `policy-merge.yml` | path cua/**, dispatch | matrix test | Python cua tool only | 0 |

### Secret inventory (unique)

`NEXT_PUBLIC_SUPABASE_*` (2), `SUPABASE_SERVICE_ROLE_KEY`, `SYSTEM_MOTOR_SECRET`, Sanity (4), E2E (8), `OPENAI_API_KEY`, `DATABASE_URL`, Azure OIDC (3), Supabase migrate (5), `POSTDEPLOY_BASE_URL`, `GITHUB_TOKEN`.

---

## E.1.2 CI gate fragmentering (v1 F3-02 re-verify)

| Pipeline | `ci:guard` | `build:enterprise` blocking | Tenant tests | Notes |
| --- | --- | --- | --- | --- |
| `ci.yml` | ✓ | ✓ **blocking** | ✓ | Matches `docs/RELEASE_GATE.md` intent |
| `ci-enterprise.yml` | ✓ | **continue-on-error** post-audit | partial | Nightly cron may green-wash |
| `ci-agents.yml` | ✗ | non-blocking (`|| echo`) | ✗ | Drives **postdeploy** |
| `ci-e2e.yml` | ✗ | N/A | ✗ | Playwright only |

| ID | Sev | Funn |
| --- | --- | --- |
| E-CI-01 | **P1** | **3 parallel CI pipelines** — unclear single required check for merge |
| E-CI-02 | **P1** | `ci-enterprise.yml` post-audit build `continue-on-error: true` (carry F3-02) |
| E-CI-03 | P2 | `postdeploy.yml` listens to **ci-agents**, not `ci.yml` |
| E-CI-04 | P2 | Bot PR chain (`codex-*` → `risk:low` → automerge) without in-workflow status enforcement |

---

## E.1.3 `scripts/ci-guard.mjs` + `.githooks/pre-push`

### ci-guard (hard gate in `ci.yml` only)

| Guard | Rule |
| --- | --- |
| Service-role key | Forbidden outside allowlist (`lib/supabase/admin.ts`, cron, superadmin, tests, migrations, workflows) |
| Orders writes | No direct `.from("orders").insert/update/…` in app/lib/components/scripts |
| Sanity regression | Blocks project id `f3vuhd2f` |
| Mojibake | UTF-8 corruption in `docs/**/*.md` |

**Gap:** Not run in `ci-e2e`, `ci-agents`, `ci-enterprise`, bot workflows.

### `.githooks/pre-push`

Runs `npm run preflight` only — **optional** (must be installed locally). No `ci:guard` unless preflight includes it.

---

## E.1.4 Git history — extended secret pattern scan

**Metode:** `git log -S` + HEAD blob scan (2026-05-25)

| Pattern | Resultat |
| --- | --- |
| JWT / service_role in tracked `.env*` commits | **Ingen P0** live keys in current HEAD tracked env files (carry Fase A) |
| `SUPABASE_SERVICE_ROLE_KEY=` in history | Commits relate to **rotation/reroll** (`b3cc32e0` staging credential rotate) — not active leak in tree |
| Private keys / `sk_live_` / `ghp_` in HEAD tracked source | **0 treff** in spot scan |

| ID | Sev | Funn |
| --- | --- | --- |
| E-SEC-01 | P2 | No automated **git-secrets** pre-commit hook — relies on ci-guard + human discipline |
| E-SEC-02 | P2 | `rls-drift-check.yml` uses prod `DATABASE_URL` in CI — exposure surface if secret leaked |

---

## E.1.5 Branch protection — F3-01 forsterking

### `origin/staging` ahead of `origin/main` (app/lib/migrations)

| SHA | Klassifisering | Tittel |
| --- | --- | --- |
| `e635940e` | **FIX** | profiles.id canonical (week/me routes) |
| `dab42931` | **FIX** | drop missing disabled_reason column |
| `b708e545` | **FIX** | employee scope on orders/today |

**Alle 3 = prod FIX** not yet on `origin/main` (re-verify 2026-05-25). Gjentatt marathon-mønster fra v1.

### GitHub API branch protection

| Check | Resultat |
| --- | --- |
| `gh api …/branches/main/protection` | **`gh` CLI not available** in audit environment (carry F3-09) |
| Workflow evidence | No `environment:` approval on `supabase-migrate.yml` prod job |
| Required checks | Documented intent in `ci.yml` comment — **API proof pending** |

| ID | Sev | Funn |
| --- | --- | --- |
| E-BR-01 | **P1** | **3 FIX commits** staging-only — prod deploy path may miss fixes (F3-01 confirmed) |
| E-BR-02 | P2 | Branch protection **unverified** via API — required reviews/status checks unknown |
| E-MIG-01 | **P1** | `supabase-migrate.yml` **prod db push on every main push** — no manual approval gate |

---

# SUB E.2 — Infra (k8s / workers / infra / Vercel / Sentry)

## E.2.1 k8s/ — aspirational (deep)

| File | Claim | Reality |
| --- | --- | --- |
| `k8s/deployment.yaml` L20 | `image: your-docker-image` | **Placeholder** — not buildable |
| Probes L28–42 | `/api/health/live`, `/api/health/ready` | **Valid** — matches Next routes |
| `k8s/service.yaml` | LoadBalancer | Generic template |
| CI deploy | — | **None** — no workflow references k8s |

**Claims that incorrectly rest on k8s:** None in prod runbooks — Vercel is actual host. k8s is **escape hatch only**.

| ID | Sev | Funn |
| --- | --- | --- |
| E-K8S-01 | P3 | k8s/ placeholder — document «not prod» to prevent operator confusion |

---

## E.2.2 infra/ — Terraform skeleton

| File | Content |
| --- | --- |
| `infra/main.tf` | AWS provider, `aws_ecs_cluster.app`, optional ALB if `alb_subnet_ids` set |
| `infra/ecs-service.tf.example` | Example only — not applied |

**No** Terraform state, backend, or CI apply found. **Not prod.**

| ID | Sev | Funn |
| --- | --- | --- |
| E-INFRA-01 | P3 | Terraform = future ECS path; zero production coupling today |

---

## E.2.3 workers/ — optional Redis sidecar

| Evidence | Detail |
| --- | --- |
| `workers/worker.ts` | `npm run worker:queue` — BRPOP loop, idempotent delivery keys |
| Primary prod path | Vercel crons → `/api/cron/*` (`vercel.json` 13 crons) |
| `retry_outbox` job | HTTP POST to `/api/cron/outbox` with `CRON_SECRET` |
| Stubs | `send_email`, `ai_generate`, `experiment_run` = log-only |
| Redis | Graceful **NO_REDIS** degrade in `lib/infra/queue.ts` |

**Kjøre-bekreftelse:** Not invoked by Vercel or CI — **manual/VM sidecar** if `QUEUE_*` + Redis set.

| ID | Sev | Funn |
| --- | --- | --- |
| E-WORK-01 | P2 | Worker **not proven running in prod** — outbox primary = Vercel cron |
| E-WORK-02 | P3 | Job types mostly stubs — queue infra ahead of implementation |

---

## E.2.4 Vercel — `vercel.json` + implicit deploy

### Crons (13)

| Path | Schedule |
| --- | --- |
| `/api/cron/outbox` | */2 min |
| `/api/cron/tripletex-outbox` | */3 min |
| `/api/cron/week-scheduler` | */10 min |
| `/api/cron/forecast` | 02:00 daily |
| `/api/cron/daily-order-summary` | 06:05, 07:05 Mon–Fri |
| `/api/cron/check-deviations` | 08,09,12,13 Mon–Fri |
| `/api/cron/preprod` | 08:05 Mon–Fri |
| `/api/cron/tripletex-*` (3) | various |
| `/api/cron/cleanup-invites` | 03:30 daily |
| `/api/cron/menu-*` (2) | 6h + Thu 12:00 |

**No Vercel deploy workflow in GitHub** — assumed Git integration + preview on PR.

| ID | Sev | Funn |
| --- | --- | --- |
| E-VER-01 | P2 | Cron density (outbox */2) + pool 60 conn — aligns with C-POOL-01 |
| E-VER-02 | P2 | No workflow-enforced **promotion** staging→prod for app (DB separate via supabase-migrate) |

---

## E.2.5 Sentry tri-config (full review)

| Layer | File | Behavior |
| --- | --- | --- |
| Server | `sentry.server.config.ts` | `buildSentryInitOptions()` |
| Edge | `sentry.edge.config.ts` | Same shared options |
| Client | `instrumentation-client.ts` | Same + `captureRouterTransitionStart` |
| Bootstrap | `instrumentation.ts` | Loads server/edge config; `onRequestError` → Sentry |
| Shared | `lib/sentry/scrubEvent.ts` | DSN resolve, env mapping (`VERCEL_ENV`), **PII scrub**, ignore patterns |
| Build | `next.config.ts` | `withSentryConfig` — sourcemaps upload, delete after upload |

| Setting | Prod value |
| --- | --- |
| `tracesSampleRate` | **0.1** |
| `sendDefaultPii` | **false** |
| `beforeSend` | scrubs cookies, auth headers, email, sensitive extra keys |
| Ignore | `Failed to fetch`, `NEXT_REDIRECT`, `AbortError` |

| ID | Sev | Funn |
| --- | --- | --- |
| E-SEN-01 | P2 | Alert **rate-limiting not in repo** — Sentry project rules unknown (dashboard config) |
| E-SEN-02 | P3 | `audit-v4.cjs` flags `sentry.*.config.ts` as dead — **false positive** (runtime via instrumentation) |

---

## E.2.6 `next.config.ts` — security-relevant

| Feature | Status |
| --- | --- |
| Global security headers | **Only** `/og/*` Cache-Control — **no CSP/HSTS at Next layer** |
| Umbraco proxy | `/umbraco` → `UMBRACO_CMS_ORIGIN` / delivery URL |
| Marketing redirects | Many paths → `lunchportalen.no` (Umbraco) |
| Typecheck/lint at build | **Ignored** — enforced in CI instead |
| Sentry webpack plugin | Sourcemaps to Sentry org/project |

---

# SUB E.3 — Security headers + observability + cost

## E.3.1 Headers VOC — prod curl (10 routes)

**Host:** `https://app.lunchportalen.no` · 2026-05-25

| Route | Status | HSTS | CSP | X-Frame | X-Content-Type | Referrer-Policy | COOP/COEP | LP-MW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 307 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | skip-auth |
| `/login` | 200 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | bypass |
| `/week` | 303→login | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | redirect |
| `/kitchen` | 303→login | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | redirect |
| `/admin/orders` | 303→login | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | redirect |
| `/dashboard` | **200** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | **skip-auth** |
| `/api/health` | 200 | ✓ | ✗ | ✗ | **nosniff** | ✗ | ✗ | allowlist |
| `/api/auth/me` | 401 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | api 401 |
| `/superadmin/system` | 303→login | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | redirect |
| `/registrer` | 200 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | skip-auth |

**OWASP gap-analyse (app.lunchportalen.no):**

| Header | Gap | Risk |
| --- | --- | --- |
| **CSP** | Missing on all sampled routes | XSS blast radius if injection exists — **P1 hardening backlog** |
| **X-Frame-Options / frame-ancestors** | Missing | Clickjacking on auth pages — **P2** |
| **Referrer-Policy** | Missing | Token leakage via Referer — **P2** |
| **Permissions-Policy** | Missing | Feature abuse — **P3** |
| **HSTS** | Present (`max-age=63072000`) via Vercel | ✓ |
| **X-Content-Type-Options** | Only `/api/health` | **P2** — inconsistent |

*v1 F3-04/F3-05: Umbraco `lunchportalen.no` headers worse — out of app scope (Fase G).*

| ID | Sev | Funn |
| --- | --- | --- |
| E-HDR-01 | **P1** | No **CSP** on Vercel app (carry F3-05 elevated for RC) |
| E-HDR-02 | P2 | No X-Frame-Options / COOP on `/login`, `/dashboard` |
| E-HDR-03 | P2 | `/dashboard` public 200 — combines with D-PAGE-01 mock exposure |

---

## E.3.2 Sentry events vs alerts

| Layer | In-repo | Gap |
| --- | --- | --- |
| Event scrubbing | ✓ `scrubSentryEvent` | — |
| Trace sampling | 10% prod | Cost control partial |
| Alert rules | **Not in repo** | No Slack/PagerDuty wiring documented |
| SLO integration | Superadmin System UI | No auto-page on SLO breach |

**Rate-limiting on alerts:** Not configurable in application code — **Sentry SaaS quota + alert rules** (unknown without dashboard access). Risk: noisy `Failed to fetch` already ignored in code.

| ID | Sev | Funn |
| --- | --- | --- |
| E-OBS-01 | P2 | SLO registry exists (`lib/observability/sloRegistry.ts`, `docs/SLO_ALERTING_RUNBOOK.md`) — **no external paging** (carry F3-07) |
| E-OBS-02 | P2 | `cron_outbox` SLI **unknown** until outbox persists `cron_runs` (documented in runbook) |
| E-OBS-03 | P3 | Sentry alert rate limits — **verify in Sentry UI** (out of repo scope) |

---

## E.3.3 Cost monitoring — 4 plattformer

| Platform | Prod role | In-repo cost visibility |
| --- | --- | --- |
| **Vercel** | Next.js app + crons | **None** — no usage dashboard in repo |
| **Supabase** | Postgres + Auth + pooler | Pool margin flagged (C-POOL-01); no billing alerts |
| **Sanity** | CMS content | No quota monitoring |
| **Azure** | Umbraco (`lunchportalen-umbraco`) | Workflow deploy only — no cost hook |

| ID | Sev | Funn |
| --- | --- | --- |
| E-COST-01 | P2 | **No unified cost observability** across 4 platforms |
| E-COST-02 | P2 | K6/load tests exist (`scripts/k6/`) but no automated **cost guard** on Vercel invocations |

---

## E.3.4 SLO/SLI dokumenter — gap vs v1

*(Nummerert før Fase F cross-cut; skip-auth inventory er **§E.3.5**.)*

| Asset | Status |
| --- | --- |
| `docs/SLO_ALERTING_RUNBOOK.md` | **Authoritative operator doc** — 6 SLO definitions |
| `lib/observability/sloRegistry.ts` | Code registry matches doc |
| `lib/observability/sli.ts` | SLI calculators — some **incident-inferred** not request-rate |
| UI | Superadmin → System → SLO card |
| External alerting | **Missing** |
| Public status page | `/status` = user blocking UX, not operator status (F3-12) |

| ID | Sev | Funn |
| --- | --- | --- |
| E-SLO-01 | P2 | order_write/auth SLI inferred from **open incidents** — not true success rate |
| E-SLO-02 | P2 | No documented **SLO error budget** policy or executive review cadence |

---

## E.3.5 Middleware skip-auth cross-cut (Fase F)

**Metode:** `rg "skip.?auth|skipAuth|Skip-Auth|noAuth" app/ lib/ middleware.ts -i` + `scripts/audit/f1-unprotected-pages.mjs` · 2026-05-25

### Produsent (kode)

| Fil | Rolle |
| --- | --- |
| `middleware.ts` L148–151 | Setter `x-lp-mw-skip-auth: 1` når `!needsAuth` |
| `middleware.ts` L26–37 | `isProtectedPath()` — **9** prefixer krever sesjon |
| `middleware.ts` L11–23 | `isBypassPath()` — statisk + `/login` + `/status` |
| `lib/server/auth/apiAllowlist.ts` | **83** `/api/*` ruter allowlist (`x-lp-mw-bypass: allowlist`) |
| `tests/middleware/*`, `tests/security/no-implicit-bypass.test.ts` | Kontrakt-tester (forventer headers, ikke prod-dok) |

**Treff i `app/` + `lib/`:** ingen `skipAuth`/`noAuth`-hjelpefunksjoner — kun middleware produserer headeren.

### Beskyttelsesmodell

```
needsAuth = isProtectedPath(pathname) && !isExplicitlyPublicProtectedSubpath(pathname)
```

**Beskyttede side-prefixer:** `/saas`, `/week`, `/superadmin`, `/admin`, `/backoffice`, `/orders`, `/driver`, `/kitchen`, `/leverandor`

**31/207 sider** uten middleware auth-gate (session refresh, ingen redirect).

| Kategori | URL-er | Dokumentert hvorfor? |
| --- | --- | --- |
| Public marketing | `/`, `/[slug]`, `/registrer`, `/product/[id]` | Implisitt `(public)` — **ingen sentral liste** |
| Auth/onboarding | `/login`, `/logout`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/auth/callback`, `/onboarding/*`, `/register*`, `/registrer*` | Forventet — **ikke i compliance-pack** |
| Employee shell (⚠) | `/dashboard`, `/home`, `/today`, `/min-side` | **Ikke dokumentert** — `(app)/` layout antyder innlogget UX |
| System/drift (⚠) | `/system`, `/system/[section]`, `/system/kvittering`, `/outbox`, `/pending` | **Ikke dokumentert** — krever per-side server guard |
| Annet | `/status`, `/avtale-ikke-aktiv`, `/menus/week`, `/vilkår` | Delvis forventet |

**Prod:** `GET /dashboard` → **200**, mock «Acme AS», `X-Lp-Mw-Skip-Auth: 1` ([§D.1.4](./04-frontend-full.md)).

### API public-by-design (83 allowlist)

Middleware krever ikke sesjon; hver route implementerer cron/webhook/anon-gate. Kategorier: 33 cron, 3 webhook, 46 anon, 1 api-key (`apiAllowlist.ts` header).

| ID | Sev | Funn |
| --- | --- | --- |
| E-MW-01 | **P1** | `SECURITY_ARCHITECTURE.md` §2.2 vs skip-auth + public `/dashboard` (F-LYV-01) |
| E-MW-02 | P2 | Ingen authoritative public-route register for DD |
| E-MW-03 | P2 | `(app)/home`, `/today`, `/min-side` uten middleware-gate |

*Cross-ref: [06-compliance-vs-kode.md §F.1.A](./06-compliance-vs-kode.md)*

---

# Fase E — funn-oppsummering

| ID | Sev | Rolle | Funn |
| --- | --- | --- | --- |
| E-CI-01 | P1 | DEVOPS | 3 parallel CI pipelines — no single required merge gate |
| E-CI-02 | P1 | DEVOPS | ci-enterprise build continue-on-error (F3-02) |
| E-BR-01 | P1 | DEVOPS | 3 prod FIX commits on staging not main (F3-01) |
| E-MIG-01 | P1 | DEVOPS | Prod DB migrate on every main push — no approval |
| E-HDR-01 | P1 | DEVOPS | No CSP on app.lunchportalen.no |
| E-CI-03 | P2 | DEVOPS | postdeploy wired to ci-agents not ci.yml |
| E-CI-04 | P2 | DEVOPS | Bot automerge chain without status enforcement |
| E-SEC-01 | P2 | DEVOPS | No git-secrets pre-commit |
| E-SEC-02 | P2 | DEVOPS | Prod DATABASE_URL in rls-drift CI |
| E-BR-02 | P2 | DEVOPS | Branch protection API unverified (F3-09) |
| E-VER-01 | P2 | DEVOPS | Cron density vs connection pool |
| E-VER-02 | P2 | DEVOPS | App promotion path not workflow-governed |
| E-WORK-01 | P2 | DEVOPS | Redis worker not proven in prod |
| E-SEN-01 | P2 | DEVOPS | Sentry alert rules not in repo |
| E-OBS-01 | P2 | DEVOPS | No external paging for SLO breaches |
| E-OBS-02 | P2 | DEVOPS | Outbox SLI unknown |
| E-COST-01 | P2 | DEVOPS | No cross-platform cost monitoring |
| E-COST-02 | P2 | DEVOPS | No Vercel invocation cost guard |
| E-SLO-01 | P2 | DEVOPS | Incident-inferred SLIs |
| E-SLO-02 | P2 | DEVOPS | No error budget policy |
| E-HDR-02 | P2 | DEVOPS | Missing frame/referrer headers |
| E-HDR-03 | P2 | DEVOPS+FE | Public /dashboard + weak headers |
| E-MW-01 | P1 | DEVOPS+COMPLIANCE | Skip-auth vs SECURITY_ARCHITECTURE §2.2 (F-LYV-01) |
| E-MW-02 | P2 | DEVOPS | No public route register |
| E-MW-03 | P2 | DEVOPS | Un-gated `(app)/` employee paths |
| E-K8S-01 | P3 | DEVOPS | k8s placeholder |
| E-INFRA-01 | P3 | DEVOPS | Terraform skeleton unused |
| E-WORK-02 | P3 | DEVOPS | Worker job stubs |
| E-SEN-02 | P3 | DEVOPS | audit-v4 false dead on sentry configs |

---

## Completeness (E.1–E.3)

| Item | Status |
| --- | --- |
| E.1 All 15 workflows opened | **COVERED** |
| E.1 ci-guard + githooks | **COVERED** |
| E.1 Git secret history scan | **COVERED** (no P0) |
| E.1 Branch divergence F3-01 | **COVERED** |
| E.2 k8s/workers/infra deep | **COVERED** |
| E.2 Sentry tri-config | **COVERED** |
| E.2 vercel.json + next.config | **COVERED** |
| E.3 Headers VOC 10 routes | **COVERED** |
| E.3 SLO/alert/cost gaps | **COVERED** |
| E.3.5 Skip-auth cross-cut (Fase F) | **COVERED** |

---

## STOP-PUNKT E

**Fase E COMPLETE.** Vent **`GO Fase F`** (compliance vs kode) eller **`GO Fase G`** (Umbraco marketing).

*READ-ONLY — ingen workflow-, infra- eller secret-endringer i denne sesjonen.*
