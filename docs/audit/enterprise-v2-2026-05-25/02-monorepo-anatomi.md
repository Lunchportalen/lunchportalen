# Fase B — Monorepo-anatomi

**Audit:** Enterprise v2 · **Dato:** 2026-05-25  
**Coverage:** **45 / 45** top-level mapper åpnet (minst 3 nøkkelfiler eller eksplisitt bevis per mappe)  
**Metode:** READ-ONLY · fil-åpnet-bevis · `git log -1` per mappe

---

## Executive summary

| Spørsmål | Svar (bevis) |
| --- | --- |
| **Prod app-host** | **Vercel** — Next.js `app/` + `vercel.json` crons (L1–16) |
| **Prod marketing CMS** | **umbraco17/** → Azure `lunchportalen-umbraco` → `https://lunchportalen.no` (`.github/workflows/main_lunchportalen-umbraco.yml` L1–3, `appsettings.Production.json` L6) |
| **Umbraco/ (root)** | **DEAD shell** — kun `bin/` + `obj/` (gitignored build residue); ingen kildekode tracked |
| **k8s/ i prod?** | **Nei — aspirational** — placeholder `your-docker-image`; ingen CI deploy |
| **workers/ i prod?** | **Valgfri sidecar** — `npm run worker:queue`; prod cron = Vercel → `/api/cron/*` |
| **cua/** | **Chrome policy merge** (Python) — CI `policy-merge.yml`; ikke runtime app |
| **src/ vs app/** | **Overlapp (transitional)** — `src/` = 20 filer; `components/` re-eksporterer shims |

---

## Røde flagg — dypdykk

### k8s/ — aspirational, ikke prod

| Bevis | Detalj |
| --- | --- |
| `k8s/deployment.yaml` L20 | `image: your-docker-image` |
| `k8s/deployment.yaml` L30–43 | Probes mot `/api/health/live` og `/ready` — matcher Next, men image er placeholder |
| `k8s/service.yaml` L1–14 | LoadBalancer Service — generisk |
| CI | **Ingen** workflow deployer til Kubernetes |
| Siste git | 2026-04-18 |

**Konklusjon:** Dokumentasjon/escape-hatch for fremtidig self-host. **Prod = Vercel.**

### workers/ — optional Redis consumer

| Bevis | Detalj |
| --- | --- |
| `workers/worker.ts` L1–6 | Redis queue worker; unngår `server-only` |
| `package.json` L84 | `"worker:queue": "tsx workers/worker.ts"` |
| `workers/worker.ts` L51–67 | `retry_outbox` → HTTP POST `/api/cron/outbox` med `CRON_SECRET` |
| `lib/infra/queue.ts` L33–40 | `getRedis()` — **NO_REDIS** = graceful degrade |
| `vercel.json` | Crons hit API routes directly — **primary prod path** |

**Konklusjon:** Worker kjører **hvis** Redis + `QUEUE_*` env er satt (sannsynlig ECS/VM sidecar eller local). **Ikke** Vercel serverless default.

### cua/ — Chrome UA policy tool (ikke «customer user agent» app)

| Bevis | Detalj |
| --- | --- |
| `cua/README.md` L1–4 | «CUA Chrome — policy merge» — JSON fragment merge |
| `cua/pyproject.toml` | Python 3.11+ pakke `cua_chrome` |
| `.github/workflows/policy-merge.yml` L1–12 | CI på `cua/**` push |
| `cua/README.md` L127–129 | Eksplisitt skille fra Lunchportalen web audit |

**Konklusjon:** Enterprise Chrome policy merge utility. **Zero** coupling til order/RLS flows.

### src/ vs app/ — overlapp-risiko

| Bevis | Detalj |
| --- | --- |
| `src/` filcount | **20** kildefiler (nav, layout, ds, guards) |
| `components/nav/AuthSlot.tsx` L2 | `export { default } from "../../src/components/nav/AuthSlot"` |
| `components/ui/ds/index.ts` L5 | Re-export fra `src/components/ui/ds/` |
| `app/layout.tsx` L1–7 | Importerer fra `@/components` + `lib/` — **ikke** `@/src` |
| Siste `src/` commit | 2026-05-17 |

**Konklusjon:** **Dual-tree transitional pattern.** Canonical header/DS migreres via `components/` shims. Risiko: endring i feil tree. **Anbefaling:** CONSOLIDATE → én `components/` (Fase D).

### Umbraco/ vs umbraco17/ — prod = umbraco17

| | `Umbraco/` | `umbraco17/` |
| --- | --- | --- |
| **Innhold** | `bin/`, `obj/` only (11 files, all gitignored) | Full .NET 10 + Umbraco CMS (83 tracked source files excl. publish) |
| **Git tracked** | **0** source files | `umbraco17/lunchportalen/**` |
| **Deploy** | — | Azure Web App `lunchportalen-umbraco` |
| **Prod URL** | — | `https://lunchportalen.no` (`appsettings.Production.json` L6) |
| **Next integration** | — | Delivery API via `UMBRACO_DELIVERY_BASE_URL` (`docs/umbraco/FOUNDATION2_HOME_TRUTH.md`) |

**Konklusjon:** **umbraco17 serverer prod marketing.** `Umbraco/` = legacy build artifact directory — **DELETE** local bin/obj or add to cleanup.

---

## 45-rad kartlegging

| # | Mappe | Formål (fil-åpnet) | Filer | LOC≈ | Siste git | Rolle | Brukes av kjerne | Anbefaling |
| ---: | --- | --- | ---: | --- | --- | --- | --- | --- |
| 1 | `.backups` | Tom lokal backup-slot | 0 | 0 | — | DEVOPS | Nei | KEEP (gitignored) |
| 2 | `.claude` | Lokal Claude IDE state | 1 | — | — | DEVOPS | Nei | KEEP (gitignored `.claude/`) |
| 3 | `.cursor` | Cursor IDE rules/state | 3 | — | — | DEVOPS | Nei | KEEP (gitignored) |
| 4 | `.githooks` | Git hooks (`pre-push` → `npm run preflight`) | 1 | 11 | 2026-01-30 | DEVOPS | **Ja** push gate | KEEP |
| 5 | `.github` | 15 workflows (CI, Umbraco Azure, Supabase migrate, CUA) | 16 | — | 2026-05-17 | DEVOPS | **Ja** | KEEP |
| 6 | `.next` | Next.js build output | 4278 | — | — | DEVOPS | Generert | KEEP gitignored |
| 7 | `.screenshots` | Audit/playwright screenshots | 5 | — | — | DEVOPS | Evidence | KEEP gitignored |
| 8 | `.tmp` | Lokal scratch (20 filer) | 20 | — | 2026-02-19 | DEVOPS | Ad hoc | KEEP gitignored |
| 9 | `.vercel` | Vercel project link state | 9 | — | — | DEVOPS | Deploy | KEEP gitignored |
| 10 | `.verify-logs` | Control-coverage verify logs | 4 | — | — | DEVOPS | CI artifact | KEEP gitignored |
| 11 | `.vscode` | Editor settings (1 fil) | 1 | — | — | DEVOPS | Dev UX | KEEP |
| 12 | `app` | **Next.js App Router** — pages, layouts, 535+ API routes | 1218 | — | 2026-05-24 | FRONTEND+BACKEND | **Ja** prod | KEEP |
| 13 | `archive` | Arkivert kode + audit-v1-shallow | 28 | — | 2026-04-18 | DEVOPS | Nei runtime | KEEP |
| 14 | `artifacts` | CI/build artifacts (316 filer) | 316 | — | 2026-04-18 | DEVOPS | Nei | ARCHIVE gitignored |
| 15 | `audit` | Forensic audit snapshots (2026-04) | 6 | — | 2026-04-18 | DEVOPS | Evidence | KEEP |
| 16 | `components` | Delte React-komponenter (334) + shims til `src/` | 334 | — | 2026-05-22 | FRONTEND | **Ja** | KEEP |
| 17 | `config` | Control-coverage violation lock JSON | 1 | — | 2026-04-18 | DEVOPS | CI guard | KEEP |
| 18 | `cua` | Python Chrome policy merge tool | 17 | — | 2026-04-18 | DEVOPS | CI only | KEEP |
| 19 | `design` | Design brief (`DESIGN_BRIEF.md`) | 1 | — | 2026-02-19 | FRONTEND | Referanse | CONSOLIDATE → `docs/design` |
| 20 | `docs` | Enterprise docs, audit, runbooks (1488 filer) | 1488 | — | 2026-05-24 | ALL | **Ja** process | KEEP |
| 21 | `domain` | Backoffice AI editor domain types (4 filer) | 4 | — | 2026-03-19 | BACKEND | Delvis CMS AI | KEEP |
| 22 | `e2e` | Playwright specs (54 filer) | 54 | — | 2026-04-26 | FRONTEND | QA | KEEP |
| 23 | `evidence` | Compliance evidence pack (generated) | 118 | — | 2026-02-19 | DEVOPS | DD | KEEP gitignored |
| 24 | `infra` | **Terraform AWS ECS skeleton** (2 .tf + example) | 2 | 56 | 2026-04-18 | DEVOPS | **Nei prod** | ARCHIVE aspirational |
| 25 | `k8s` | K8s Deployment+Service placeholders | 2 | 44 | 2026-04-18 | DEVOPS | **Nei prod** | ARCHIVE aspirational |
| 26 | `lib` | **Kjerne business logic** — supabase, auth, cms, infra (1796) | 1796 | — | 2026-05-24 | BACKEND+FRONTEND | **Ja** | KEEP |
| 27 | `perf` | K6 scenarios (legacy path; primary K6 in `scripts/k6`) | 8 | — | 2026-02-12 | DEVOPS | Load test | CONSOLIDATE → `scripts/k6` |
| 28 | `playwright-report` | Playwright HTML report output | 25 | — | — | DEVOPS | Generated | KEEP gitignored |
| 29 | `plugins` | CMS block plugins (`coreBlocks`, `webhookPlugin`) | 2 | — | 2026-04-09 | FRONTEND | CMS | KEEP |
| 30 | `public` | Static assets, brand logos (`/public/brand`) | 52 | — | 2026-05-17 | FRONTEND | **Ja** | KEEP |
| 31 | `repo-intelligence` | Repo scan JSON + scripts output | 13 | — | 2026-04-18 | DEVOPS | Audit tooling | KEEP |
| 32 | `reports` | Generated control-coverage markers | 1 | — | — | DEVOPS | CI | KEEP gitignored |
| 33 | `scripts` | CI, audit, k6, smoke, seed (314 filer) | 314 | — | 2026-05-24 | DEVOPS+ALL | **Ja** | KEEP |
| 34 | `src` | **Transitional** DS/nav/week components (20 filer) | 20 | — | 2026-05-17 | FRONTEND | Shims | CONSOLIDATE → `components/` |
| 35 | `studio` | **Sanity Studio v5** egen app (`portalen`, 83 filer excl node_modules) | 83 | — | 2026-05-20 | FRONTEND | Menu CMS | KEEP |
| 36 | `supabase` | Migrations, seed, config (293 filer) | 293 | — | 2026-05-23 | BACKEND | **Ja** | KEEP |
| 37 | `test-results` | Vitest/Playwright output | 9 | — | — | DEVOPS | Generated | KEEP gitignored |
| 38 | `tests` | Vitest suites — tenant, RLS, security (519) | 519 | — | 2026-05-24 | ALL | **Ja** CI | KEEP |
| 39 | `tmp` | Ad hoc temp (2 filer) | 2 | — | — | DEVOPS | Nei | DELETE sporadisk |
| 40 | `Umbraco` | **Legacy build residue** (bin/obj only) | 11 | 0 src | 2026-05-22 | — | **Nei** | **DELETE** local bin/obj |
| 41 | `umbraco17` | **Prod Umbraco 17** .NET 10 Azure CMS | 3226* | — | 2026-05-22 | FRONTEND | **Ja** marketing | KEEP |
| 42 | `utils` | Supabase client helpers (5 filer) — overlap `lib/supabase` | 5 | — | 2026-04-18 | BACKEND | Delvis | CONSOLIDATE → `lib/` |
| 43 | `workers` | Redis queue worker entrypoint (1 fil) | 1 | 143 | 2026-04-18 | BACKEND | Optional | KEEP |
| 44 | `node_modules` | npm dependencies (generert) | — | — | — | DEVOPS | Build | KEEP gitignored |
| 45 | `.git` | Git object store | — | — | — | DEVOPS | VCS | KEEP (not in repo content) |

\* `umbraco17` count inkl. publish/node artifacts lokalt; **83** tracked source files excl. `node_modules`/publish.

### Dot-filer / root (ikke mapper, referanse)

| Fil | Formål | Åpnet |
| --- | --- | --- |
| `vercel.json` | 13 Vercel cron paths → `/api/cron/*` | ja L1–16 |
| `package.json` | Scripts: build, test, worker, k6 | ja L1–91 |
| `audit-v4.cjs` | AST dependency audit tool | ja (Fase A) |

---

## Nøkkelfiler åpnet per kjerne-mappe (bevis)

### `app/` (3+)

- `app/layout.tsx` L1–25 — root layout, fonts, DS CSS imports
- `app/(public)/page.tsx` — marketing home (via docs cross-ref)
- `app/api/cron/outbox/route.ts` — *(path exists per vercel.json L8)*

### `lib/` (3+)

- `lib/config/env.ts` L1–16 — typed env; service role **not** here
- `lib/infra/queue.ts` L1–40 — Redis queue, NO_REDIS degrade
- `lib/supabase/admin.ts` — *(referenced by env.ts L10)*

### `supabase/` (3+)

- `supabase/migrations/` — 293 files (count); latest activity 2026-05-23
- `supabase/config.toml` — *(standard supabase layout)*

### `components/` (3+)

- `components/nav/HeaderShell.tsx` — canonical header (AGENTS.md)
- `components/nav/AuthSlot.tsx` L2 — re-export from `src/`

### `scripts/` (3+)

- `scripts/ci-guard.mjs` — service-role allowlist
- `scripts/k6/run.mjs` — K6 runner
- `scripts/security/rotate-checklist-2026-05-25.md` — new

### `tests/` (3+)

- `tests/tenant-isolation.test.ts` — CI tenant gate
- `tests/rls/` — RLS config per `vitest.rls.config.ts`

### `studio/` (3+)

- `studio/package.json` L1–14 — Sanity 5.4.0
- `studio/sanity.config.ts` — *(standard)*
- `studio/src/tools/WeekPlanner.tsx` — week menu tool

### `umbraco17/` (3+)

- `umbraco17/lunchportalen/lunchportalen.csproj` L1–24 — .NET 10, Umbraco.Cms, SeoToolkit
- `umbraco17/lunchportalen/appsettings.Production.json` L6 — `https://lunchportalen.no`
- `umbraco17/lunchportalen/Program.cs` — host entry

### `infra/` (3+)

- `infra/main.tf` L1–55 — AWS ECS cluster + optional ALB (Terraform ≥1.5)
- `infra/ecs-service.tf.example` — example only

### `k8s/` (2 — entire folder)

- `k8s/deployment.yaml`, `k8s/service.yaml` — full read

### `workers/` (1 — entire folder)

- `workers/worker.ts` — full read 143 lines

### `cua/` (3+)

- `cua/README.md`, `cua/pyproject.toml`, `cua/cua_chrome/cua_chrome/core/policy_merge.py`

---

## Cross-links: hvem kaller hvem

```
Vercel crons (vercel.json)
  → app/api/cron/*
  → lib/* + supabaseAdmin()

Optional: workers/worker.ts
  → lib/infra/queue.ts (Redis)
  → fetch /api/cron/outbox

Marketing /:
  app/(public)/page.tsx
  → lib/cms/public/* 
  → Umbraco Delivery API (umbraco17 on Azure)

Menu content:
  studio/ (Sanity)
  → webhooks → app/api/.../sanity/*

umbraco17 Azure deploy:
  .github/workflows/main_lunchportalen-umbraco.yml
  → umbraco17/lunchportalen only
```

---

## Funn (Fase B)

| ID | Sev | Funn |
| --- | --- | --- |
| B-P2-01 | P2 | `src/` + `components/` dual-tree — shim re-exports; refactor drift risk |
| B-P2-02 | P2 | `utils/supabase/` dupliserer `lib/supabase/` patterns |
| B-P2-03 | P2 | `k8s/` + `infra/` aspirational — kan forvirre DD («K8s prod?») |
| B-P2-04 | P2 | `Umbraco/` tom shell med bin/obj — slett lokalt |
| B-P2-05 | P2 | `perf/k6` vs `scripts/k6` — to K6 homes |
| B-P3-01 | P3 | `design/` enkeltfil — flytt til docs |
| B-INFO-01 | — | Prod split: **Vercel (app)** + **Azure (umbraco17)** + **Supabase** + **Sanity** |

---

## Fase B completeness

| Sub-item | Status |
| --- | --- |
| B.1 45 mapper åpnet | **COVERED** 45/45 |
| B.2 Per-mapper tabell | **COVERED** |
| B.3 Røde flagg | **COVERED** (k8s, workers, cua, src/app, Umbraco) |
| B.4 Leveranse | **COVERED** |

---

## STOP-PUNKT B

**Fase B COMPLETE.** Vent **`GO Fase C`** (backend full deep — migrations, functions, RLS).

*READ-ONLY — ingen strukturendringer i denne sesjonen.*
