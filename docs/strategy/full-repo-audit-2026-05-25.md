# Sprint AA — Full Repo Audit

**Date:** 2026-05-25  
**Mode:** READ-ONLY (ingen sletting/flytting i denne sesjonen)  
**Baseline:** 2389 tests passed · Cleanup Z paused (Z.1–Z.3 merged)  
**Cross-ref:** [phase2-cut-list-2026-05-26.md](./phase2-cut-list-2026-05-26.md) · [phase2-synergi-roadmap-2026-05-26.md](./phase2-synergi-roadmap-2026-05-26.md)

---

## Executive sammendrag

| Metrikk | Verdi |
|---------|------:|
| Top-level enheter crawlet | **275** (44 mapper + 231 filer) |
| Mapper auditert (ekskl. build-artifacts) | **42** (31 vanlige + 11 dot-folders) |
| Build-artifact-mapper ekskludert | **6** lokalt tilstede |
| Top-level filer klassifisert | **231** |
| Tracked filer i git (`git ls-files`) | **6 598** |
| Untracked lokale filer (excl. standard ignore) | **115** |
| Estimert LOC i kode-mapper (ts/tsx/js/mjs/cs/cshtml/sql) | **~410 000+** |

### Klassifisering (top-level enheter + per-mapper default)

| Kategori | Enheter | Andel |
|----------|--------:|------:|
| **KEEP** | **148** | 54% |
| **CUT** | **98** | 36% |
| **REFACTOR** | **74** | 27%* |
| **INVESTIGATE** | **0** (12 løst 2026-05-25) | — |

\*REFACTOR overlapper KEEP (docs-flytting på KEEP-innhold) — tellemodell: 70 docs REFACTOR + 3 mapper REFACTOR + 1 fil.  
\*\*Etter Thomas INVESTIGATE-resolution: alle 12 enheter har beslutning — se §INVESTIGATE RESOLVED.

**Security-status:** **OK** — ingen `.env`-filer med secrets committed. Kun `.env.example` og `.env.postdeploy.example` i git.

**Største funn:**
1. **Dual-tree `app/` + `src/`** — prod i `app/`; `src/` er 20-filers shim (REFACTOR).
2. **~106 scratch-filer** på root (untracked) — `.commit_msg_*`, p3m3, mcp, tpt, exec.
3. **~70 governance-.md på root** — skal til `docs/{kategori}/` (REFACTOR).
4. **`archive/`** — 32 filer, 0 runtime consumers → CUT-kandidat.
5. **`k8s/` + `infra/`** — **CUT** (Gruppe 12a/12b) — Thomas 2026-05-25.
6. **OVERRASKELSE:** `ISO 27001 alignment matrix` (fil uten `.md`-suffix) · `queue.json` (gitignored snapshot) · `studio/` inkl. lokal `node_modules` (~96k filer on disk, ikke tracked).

---

## Crawl-scope (verifikasjon)

### Crawlet

**Vanlige mapper (31):**  
`app`, `archive`, `artifacts`, `audit`, `components`, `config`, `cua`, `design`, `docs`, `domain`, `e2e`, `evidence`, `infra`, `k8s`, `lib`, `perf`, `plugins`, `public`, `repo-intelligence`, `reports`, `scripts`, `src`, `studio`, `supabase`, `tests`, `umbraco17`, `utils`, `workers`  
+ build-artifact-mapper som finnes lokalt: `node_modules`, `playwright-report`, `test-results`, `tmp`

**Dot-folders (11 auditert, `.git` ekskludert):**  
`.backups`, `.claude`, `.cursor`, `.githooks`, `.github`, `.next`, `.screenshots`, `.tmp`, `.vercel`, `.verify-logs`, `.vscode`

**Top-level filer:** alle 231 filer i repo-root (inkl. dot-filer).

### Ekskludert (build-artifacts — Del 2)

`node_modules/`, `.next/`, `dist/`, `build/`, `.tmp/`, `tmp/`, `test-results/`, `playwright-report/`, `coverage/`, `.vercel/` — ikke klassifisert videre; kun gitignore-verifikasjon.

### OVERRASKELSER vs Thomas-screenshots

| Enhet | Notat |
|-------|-------|
| `ISO 27001 alignment matrix` | Fil **uten** `.md`-extension på root |
| `queue.json` | Hyperscale queue snapshot — **gitignored**, finnes lokalt |
| `design-system.md` | Lowercase doc på root (ikke ALL_CAPS-mønster) |
| `audit-v4.cjs` | **Tracked** legacy audit script på root |
| `.vercel-trigger.txt` | **Tracked** deploy trigger-fil |
| `evidence/` (118 filer) | Gitignored generated — finnes lokalt, ikke i git |
| `artifacts/` (316 filer) | Gitignored — finnes lokalt |
| `studio/node_modules/` | Massiv on-disk footprint; 0 committed paths |

---

## Build-artifacts (ekskludert)

| mappe | finnes? | gitignored? | committed count | status |
|-------|---------|-------------|-----------------|--------|
| `node_modules/` | ja | ja (`.gitignore:6`) | 0 | ✅ OK |
| `.next/` | ja | ja (`.gitignore:2`) | 0 | ✅ OK |
| `dist/` | nei | ja (pattern) | 0 | ✅ OK |
| `build/` | nei | ja (pattern) | 0 | ✅ OK |
| `.tmp/` | ja | ja (`.gitignore:47`) | 0 | ✅ OK |
| `tmp/` | ja | ja (`.gitignore:48`) | 0 | ✅ OK |
| `test-results/` | ja | ja (`.gitignore:70`) | 0 | ✅ OK |
| `playwright-report/` | ja | ja (`.gitignore:69`) | 0 | ✅ OK |
| `coverage/` | nei | ja (pattern) | 0 | ✅ OK |
| `.vercel/` | ja | ja (`.gitignore:41`) | 0 | ✅ OK |

**Git hooks:** `core.hooksPath = .githooks` · `package.json` har `hooks:install` / `hooks:check` (ingen husky).

---

## Vanlige mapper (alfabetisk)

### app/

| | |
|---|---|
| **Fil-antall** | 1 212 (workspace) · ~1 237 tracked |
| **LOC** | ~168 857 |
| **Siste git** | `51f9b18f` 2026-05-25 phase-b dead-api-ai-routes |
| **Innhold** | Next.js App Router — prod runtime (Vercel). Routes: `(app)`, `(auth)`, `(backoffice)`, `(public)`, `admin`, `api`, `superadmin`, m.fl. |
| **Top-level** | Route groups, `layout.tsx`, `globals.css`, `styles/` |
| **Consumers** | Entry point for all HTTP/UI — middleware, Vercel crons, e2e |
| **Pillar 2/ESG** | Admin/kitchen/week flows; ESG dashboard paths post-kill |
| **Klassifisering** | **KEEP** |

### archive/

| | |
|---|---|
| **Fil-antall** | 32 |
| **LOC** | ~2 849 |
| **Siste git** | `536cba51` 2026-05-24 archive k6_test_users.sql |
| **Innhold** | Dead-code graveyard per `archive/README.md` — ikke i aktiv import-graf |
| **Consumers utenfor archive/** | **0** TS-imports · kun `tests/runtime/EnterpriseBuildParity.test.ts` + audit scripts ignorerer |
| **Klassifisering** | **CUT** (Sprint AB Gruppe 11) — Thomas 2026-05-25 |

### artifacts/

| | |
|---|---|
| **Fil-antall** | 316 (lokal, gitignored) |
| **LOC** | 0 (binære/build) |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | CI/build output cache |
| **Consumers** | 0 — `.gitignore:96` |
| **Klassifisering** | **CUT** (lokal disk-hygiene, ikke i git) |

### audit/

| | |
|---|---|
| **Fil-antall** | 6 tracked |
| **LOC** | 0 (markdown) |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | Forensic snapshot `audit/forensic-2026-04-05/` (AUDIT_MASTER, ledgers) |
| **Consumers** | Referert i docs/ · ikke runtime |
| **DD/audit-trail** | Ja — historisk DD-evidence |
| **Klassifisering** | **KEEP** (ev. REFACTOR → `docs/audit/forensic-2026-04-05/` i AB) |

### components/

| | |
|---|---|
| **Fil-antall** | 334 |
| **LOC** | ~30 707 |
| **Siste git** | `c915b54c` 2026-05-22 ESG kill |
| **Innhold** | Shared React components (nav, admin, CMS, superadmin) |
| **Consumers** | `@/components/*` — app/, lib/, tests/ |
| **Klassifisering** | **KEEP** |

### config/

| | |
|---|---|
| **Fil-antall** | 1 tracked (`control-coverage-violation-lock.json`) |
| **LOC** | 0 |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | Lock-fil for `npm run verify:control-coverage` |
| **Consumers** | `scripts/verify-control-coverage.mjs` |
| **Klassifisering** | **KEEP** |

### cua/

| | |
|---|---|
| **Fil-antall** | 17 |
| **LOC** | 0 (Python) |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | Chrome policy merge tool (`cua_chrome`) — **C**hrome **U**nified **A**ggregation |
| **Consumers** | `.github/workflows/policy-merge.yml` (CI on `cua/**`) |
| **Klassifisering** | **KEEP** |

### design/

| | |
|---|---|
| **Fil-antall** | 1 (`DESIGN_BRIEF.md`) |
| **LOC** | 0 |
| **Siste git** | `6a630e37` 2026-02-19 |
| **Innhold** | Design brief; runtime design i `lib/design/` |
| **Consumers** | Docs-referanse · `lib/design/*` er kanonisk runtime |
| **Klassifisering** | **REFACTOR** → `docs/engineering/design-brief.md` (Thomas 2026-05-25) |

### docs/

| | |
|---|---|
| **Fil-antall** | 1 507 |
| **LOC** | ~12 536 (md/sql i scope) |
| **Siste git** | `7e34bcbd` 2026-05-25 kontakt 500 doc |
| **Innhold** | Kanonisk dokumentasjon (audit, strategy, rc, governance) |
| **Consumers** | CI agents gate, human ops, DD pack |
| **Klassifisering** | **KEEP** |

### domain/

| | |
|---|---|
| **Fil-antall** | 3 |
| **LOC** | ~156 |
| **Siste git** | `839fd6a6` 2026-03-19 |
| **Innhold** | Domain types/helpers |
| **Consumers** | Grep `@/domain` — begrenset, men aktiv |
| **Klassifisering** | **KEEP** |

### e2e/

| | |
|---|---|
| **Fil-antall** | 54 |
| **LOC** | ~7 388 |
| **Siste git** | `d60cd355` 2026-04-26 Umbraco domain |
| **Innhold** | Playwright e2e specs |
| **Consumers** | `npm run e2e` · `.github/workflows/ci-e2e.yml` |
| **Klassifisering** | **KEEP** |

### evidence/

| | |
|---|---|
| **Fil-antall** | 118 (lokal, gitignored) |
| **LOC** | 0 |
| **Siste git** | `cdbadc77` 2026-02-19 ignore policy |
| **Innhold** | Generated compliance evidence |
| **Consumers** | 0 runtime · `.gitignore:59` |
| **Klassifisering** | **CUT** (lokal) · policy: external store |

### infra/

| | |
|---|---|
| **Fil-antall** | 2 (`main.tf`, `ecs-service.tf.example`) |
| **LOC** | 0 (HCL) |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | Terraform AWS ECS — **ikke prod** (Vercel + Azure) |
| **Consumers** | 0 i `.github/`, `vercel.json` |
| **Klassifisering** | **CUT** (Sprint AB Gruppe 12b) — Thomas 2026-05-25 |

### k8s/

| | |
|---|---|
| **Fil-antall** | 2 (`deployment.yaml`, `service.yaml`) |
| **LOC** | 0 |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | K8s template placeholders (`your-docker-image`) |
| **Consumers** | 0 CI/Vercel |
| **Klassifisering** | **CUT** (Sprint AB Gruppe 12a) — Thomas 2026-05-25 |

### lib/

| | |
|---|---|
| **Fil-antall** | 1 769 |
| **LOC** | ~131 531 |
| **Siste git** | `df3a872c` 2026-05-25 phase-b control cut |
| **Innhold** | Core business logic, auth, CMS, AI (post-Fase B), billing |
| **Consumers** | app/, components/, tests/, scripts/ |
| **Pillar 2/ESG** | `lib/ai/demandEngine`, ESG paths per synergi-roadmap |
| **Klassifisering** | **KEEP** |

### perf/

| | |
|---|---|
| **Fil-antall** | 8 |
| **LOC** | 0 (JS k6) |
| **Siste git** | `b5e7c93f` 2026-02-12 k6 skeleton |
| **Innhold** | k6 load scenarios (`perf/k6/`) |
| **Consumers** | Manual/CI-adhoc · README i mappen |
| **Klassifisering** | **KEEP** |

### plugins/

| | |
|---|---|
| **Fil-antall** | 2 |
| **LOC** | ~44 |
| **Siste git** | `24bec71a` 2026-04-09 |
| **Innhold** | CMS plugins (`coreBlocks`, `webhookPlugin`) |
| **Consumers** | `lib/cms/plugins/loadPlugins.ts` → `@/plugins/*` |
| **Klassifisering** | **KEEP** |

### public/

| | |
|---|---|
| **Fil-antall** | 52 |
| **LOC** | 0 |
| **Siste git** | `24a0f80f` 2026-05-17 logo asset |
| **Innhold** | Next.js static assets (`brand/`, favicons, `matbilder/`) |
| **Consumers** | 50+ refs `/brand/`, `/public/` i app/components |
| **Note** | AGENTS.md forventer `/public/brand/LP-logo-uten-bakgrunn.png` — verifiser navnedrift |
| **Klassifisering** | **KEEP** |

### repo-intelligence/

| | |
|---|---|
| **Fil-antall** | 13 JSON |
| **LOC** | 0 |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | Generated repo map (`scripts/scanRepo.ts`) · last scan 2026-03-26 |
| **Consumers** | `lib/repo/query.ts`, `lib/repo-intelligence/buildSystemGraph.ts` |
| **Klassifisering** | **REFACTOR** — weekly `repo:scan` CI (Thomas 2026-05-25). **Ikke CUT:** `buildSystemGraph.ts` er live (`/api/superadmin/system-graph/data`) |

### reports/

| | |
|---|---|
| **Fil-antall** | 1 (lokal `control-coverage-markers.json`, gitignored) |
| **Siste git** | — |
| **Innhold** | CI marker dump |
| **Consumers** | `verify:control-coverage` regenererer |
| **Klassifisering** | **CUT** (lokal generated) |

### scripts/

| | |
|---|---|
| **Fil-antall** | 331 |
| **LOC** | ~54 218 |
| **Siste git** | `51f9b18f` 2026-05-25 |
| **Innhold** | Smoke, audit, seed, migrate, verify, deploy helpers |
| **Consumers** | `package.json` scripts, `.github/workflows/` |
| **Klassifisering** | **KEEP** |

### src/

| | |
|---|---|
| **Fil-antall** | 20 |
| **LOC** | ~983 |
| **Siste git** | `63bdfe35` 2026-05-17 header logo |
| **Innhold** | Transitional shim — nav, ds, week components + 2 lib files |
| **Consumers** | `@/components/*` alias precedence + 8 re-exports i `components/` |
| **Konflikt** | **`app/` + `src/` begge finnes; `src/app/` finnes IKKE** — ikke dual-router, men dual-component-tree |
| **Klassifisering** | **REFACTOR** Gruppe **10.5** → `components/` — Thomas 2026-05-25 |

### studio/

| | |
|---|---|
| **Fil-antall** | ~47 source + lokal node_modules |
| **LOC** | Sanity schema/desk (excl. node_modules) |
| **Siste git** | `75a55235` 2026-05-20 billing tier |
| **Innhold** | Sanity Studio (`sanity.config.ts`, `sanity.cli.ts`, schemaTypes) |
| **Consumers** | `npm run sanity:build`, menu CMS, Pillar 2 data |
| **Klassifisering** | **KEEP** |

### supabase/

| | |
|---|---|
| **Fil-antall** | 291 |
| **LOC** | SQL migrations dominant |
| **Siste git** | `02031a88` 2026-05-24 K6 migration reconcile |
| **Innhold** | Migrations, seeds, config |
| **Consumers** | Runtime RLS, CI migrate workflow |
| **Klassifisering** | **KEEP** |

### tests/

| | |
|---|---|
| **Fil-antall** | 515 |
| **LOC** | (part of vitest suite) |
| **Siste git** | `51f9b18f` 2026-05-25 |
| **Innhold** | Vitest unit/integration (2389 passed baseline) |
| **Consumers** | CI build/e2e/enterprise |
| **Klassifisering** | **KEEP** |

### umbraco17/

| | |
|---|---|
| **Fil-antall** | 3 226 |
| **LOC** | C#/Razor dominant |
| **Siste git** | `702ce987` 2026-05-25 Z.3 ViewImports |
| **Innhold** | Umbraco 17 marketing CMS (Azure App Service) |
| **Consumers** | `main_lunchportalen-umbraco.yml`, www.lunchportalen.no |
| **Klassifisering** | **KEEP** |

### utils/

| | |
|---|---|
| **Fil-antall** | 5 (`utils/supabase/*`) |
| **LOC** | minimal |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | Legacy Supabase client helpers |
| **Consumers** | **~18** `@/utils` imports (middleware, week, lib/supabase) vs **2** `@/lib/utils` |
| **Klassifisering** | **REFACTOR** — dedup til `lib/supabase/` + `lib/utils/` (Sprint AB Gruppe 10) |

### workers/

| | |
|---|---|
| **Fil-antall** | 1 (`worker.ts`) |
| **LOC** | minimal |
| **Siste git** | `532dc713` 2026-04-18 |
| **Innhold** | Optional Redis queue consumer |
| **Consumers** | `package.json` `worker:queue` · **0** vercel.json refs (crons brukes) |
| **Klassifisering** | **CUT** (Sprint AB Gruppe 13) — Thomas 2026-05-25. Vercel crons primary; worker er log-only stub |

---

## Dot-folders (alfabetisk)

| Folder | ls-files | gitignore | Siste commit | Klassifisering |
|--------|----------|-----------|--------------|----------------|
| `.backups/` | 0 | ✅ | — | **KEEP** (empty slot) |
| `.claude/` | 0 | ✅ | — | **KEEP** (local IDE) |
| `.cursor/` | 0 | ✅ | — | **KEEP** (local agent) |
| `.githooks/` | 1 (`pre-push`) | nei | `8a576c14` 2026-01-30 | **KEEP** — aktiv pre-push gate |
| `.github/` | 16 | nei | `0e9314dd` 2026-05-17 | **KEEP** — 15 workflows + CODEOWNERS |
| `.next/` | 0 | ✅ | — | ekskludert (build) |
| `.screenshots/` | 0 | ✅ | — | **CUT** lokal (5 debug screenshots) |
| `.tmp/` | 0 | ✅ | `54ee3482` 2026-02-19 | **CUT lokalt** (Thomas 2026-05-25) — slett innhold; mappe gitignored |
| `.vercel/` | 0 | ✅ | — | **KEEP** gitignored · verifiser `.env.production.local` aldri staged |
| `.verify-logs/` | 0 | ✅ | — | **KEEP** gitignored logs |
| `.vscode/` | 0 | ✅ | — | **KEEP** gitignored |

### `.github/workflows/` (alle KEEP)

`auto-engineer.yml`, `automerge-lowrisk.yml`, `ci.yml`, `ci-agents.yml`, `ci-e2e.yml`, `ci-enterprise.yml`, `codex-audit-autofix.yml`, `codex-design-system.yml`, `deps-weekly.yml`, **`main_lunchportalen-umbraco.yml`** (aktiv — Z.3 deploy 2026-05-25), `policy-merge.yml`, `postdeploy.yml`, `rls-drift-check.yml`, `security-audit.yml`, `supabase-migrate.yml`

---

## Top-level filer

### 9.1 Core-infra (KEEP)

| Fil | Formål |
|-----|--------|
| `package.json`, `package-lock.json` | npm manifest |
| `tsconfig.json` | TypeScript |
| `next.config.ts`, `next-env.d.ts` | Next.js |
| `middleware.ts` | Edge middleware |
| `vercel.json` | Vercel crons + config |
| `playwright.config.ts` | E2E |
| `vitest.config.ts`, `vitest.rls.config.ts` | Unit tests |
| `postcss.config.cjs`, `tailwind.config.cjs` | CSS |
| `.eslintrc.cjs` | Lint |
| `Dockerfile` | Container build |
| `sentry.edge.config.ts`, `sentry.server.config.ts` | Sentry |
| `instrumentation.ts`, `instrumentation-client.ts` | Observability |

### 9.2 Git/IDE-config (KEEP)

`.gitignore`, `.gitattributes`, `.dockerignore`, `.editorconfig`, `.cursorignore`, `.sentryclirc`

### 9.3 DotNet-infra (KEEP)

`Directory.Packages.props`, `lunchportalen.sln`

### 9.4 README/CHANGELOG/AGENTS (KEEP på root)

`README.md`, `CHANGELOG.md`, `AGENTS.md`, `AGENTS_TLDR.md`

### 9.5 Docs til flytting (REFACTOR) — 70 filer

| Fil | Mål-sti | Begrunnelse |
|-----|---------|-------------|
| `ACCESS_CONTROL_POLICY.md` | `docs/governance/access-control-policy.md` | Governance |
| `AI_KPI_FRAMEWORK.md` | `docs/strategy/ai-kpi-framework.md` | Strategy |
| `AI_RISK_ASSESSMENT_FRAMEWORK.md` | `docs/governance/ai-risk-assessment-framework.md` | Governance |
| `AI_STRATEGY_INTERNAL_CONTROLLED.md` | `docs/strategy/ai-strategy-internal-controlled.md` | Strategy |
| `ARCHITECTURE_DECISIONS.md` | `docs/engineering/architecture-decisions.md` | Engineering |
| `AUDIT_CALENDAR.md` | `docs/governance/audit-calendar.md` | Governance |
| `BOARD_LEVEL_SUMMARY.md` | `docs/governance/board-level-summary.md` | Governance |
| `BUSINESS_CONTINUITY_PLAN.md` | `docs/governance/business-continuity-plan.md` | Governance |
| `CHANGE_MANAGEMENT_POLICY.md` | `docs/governance/change-management-policy.md` | Governance |
| `CODEX_CHECKLIST.md` | `docs/engineering/codex-checklist.md` | Engineering |
| `CODEX_DATAWRITE.md` | `docs/engineering/codex-datawrite.md` | Engineering |
| `COMPLIANCE_OVERVIEW.md` | `docs/compliance/compliance-overview.md` | Compliance |
| `COMPLIANCE_ROADMAP_12M_ISO.md` | `docs/compliance/compliance-roadmap-12m-iso.md` | Compliance |
| `CORRECTIVE_ACTIONS_LOG.md` | `docs/governance/corrective-actions-log.md` | Governance |
| `COST_MODEL.md` | `docs/strategy/cost-model.md` | Strategy |
| `CRO_FRAMEWORK.md` | `docs/strategy/cro-framework.md` | Strategy |
| `CURSOR_MASTER_PROMPT_LUNCHPORTALEN_V4.md` | `docs/engineering/cursor-master-prompt-v4.md` | Engineering |
| `CURSOR_PHASED_PROMPTS_LUNCHPORTALEN_V5.md` | `docs/engineering/cursor-phased-prompts-v5.md` | Engineering |
| `DATA_FLOW_DIAGRAM.md` | `docs/engineering/data-flow-diagram.md` | Engineering |
| `DATA_GOVERNANCE_POLICY.md` | `docs/governance/data-governance-policy.md` | Governance |
| `design-system.md` | `docs/engineering/design-system.md` | Engineering |
| `DEVELOPER_ONBOARDING_GUIDE.md` | `docs/engineering/developer-onboarding-guide.md` | Engineering |
| `DISASTER_RECOVERY_PLAN.md` | `docs/governance/disaster-recovery-plan.md` | Governance |
| `DOCS_OVERVIEW.md` | `docs/governance/docs-overview.md` | Governance |
| `DRIFTSCODEX.md` | `docs/engineering/driftscodex.md` | Engineering |
| `ENGINEERING_KPI_FRAMEWORK.md` | `docs/engineering/engineering-kpi-framework.md` | Engineering |
| `ENTERPRISE_AI_POSITIONING_BRIEF.md` | `docs/sales/enterprise-ai-positioning-brief.md` | Sales |
| `ENTERPRISE_CONTROL_MAP.md` | `docs/governance/enterprise-control-map.md` | Governance |
| `ENTERPRISE_GTM_TECH_ALIGNMENT.md` | `docs/sales/enterprise-gtm-tech-alignment.md` | Sales |
| `ENTERPRISE_RFP_MASTER_RESPONSE_TEMPLATE.md` | `docs/sales/enterprise-rfp-master-response-template.md` | Sales |
| `ENTERPRISE_SALES_TECHNICAL_PACK.md` | `docs/sales/enterprise-sales-technical-pack.md` | Sales |
| `ESG_KPI_FRAMEWORK.md` | `docs/strategy/esg-kpi-framework.md` | Strategy / Pillar 2 |
| `ESG_SALES_NARRATIVE_PACK.md` | `docs/sales/esg-sales-narrative-pack.md` | Sales |
| `ESG_SUSTAINABILITY_TECHNICAL_BRIEF.md` | `docs/strategy/esg-sustainability-technical-brief.md` | Strategy |
| `EVIDENCE_INDEX.md` | `docs/compliance/evidence-index.md` | Compliance |
| `EXECUTIVE_ESG_DASHBOARD_BLUEPRINT.md` | `docs/strategy/executive-esg-dashboard-blueprint.md` | Strategy |
| `EXECUTIVE_MONITORING_DASHBOARD_BLUEPRINT.md` | `docs/strategy/executive-monitoring-dashboard-blueprint.md` | Strategy |
| `GROWTH_AND_RISK_ALIGNMENT_BRIEF.md` | `docs/strategy/growth-and-risk-alignment-brief.md` | Strategy |
| `INCIDENT_RESPONSE_PLAN.md` | `docs/governance/incident-response-plan.md` | Governance |
| `INTERNAL_AUDIT_TEMPLATE.md` | `docs/governance/internal-audit-template.md` | Governance |
| `INTERNAL_ENGINEERING_HANDBOOK.md` | `docs/engineering/internal-engineering-handbook.md` | Engineering |
| `INTERNAL_ENGINEERING_PLAYBOOK.md` | `docs/engineering/internal-engineering-playbook.md` | Engineering |
| `INVESTOR_SECURITY_BRIEF.md` | `docs/security/investor-security-brief.md` | Security |
| `MANAGEMENT_REVIEW_TEMPLATE.md` | `docs/governance/management-review-template.md` | Governance |
| `MASTER_SECURITY_POLICY.md` | `docs/security/master-security-policy.md` | Security |
| `MISSION_CRITICAL_OPERATIONS_STANDARD.md` | `docs/governance/mission-critical-operations-standard.md` | Governance |
| `PENETRATION_TEST_SCOPE_TEMPLATE.md` | `docs/security/penetration-test-scope-template.md` | Security |
| `PLATFORM_VISION_DOCUMENT.md` | `docs/strategy/platform-vision-document.md` | Strategy |
| `PRODUCT_ROADMAP_5Y_DETAILED.md` | `docs/strategy/product-roadmap-5y-detailed.md` | Strategy |
| `RED_TEAM_SIMULATION_PLAYBOOK.md` | `docs/security/red-team-simulation-playbook.md` | Security |
| `REPO_DEEP_DIVE_REPORT.md` | `docs/audit/repo-deep-dive-report.md` | Audit |
| `RESPONSIBLE_AI_POLICY.md` | `docs/governance/responsible-ai-policy.md` | Governance |
| `RISK_REGISTER.md` | `docs/governance/risk/risk-register.md` | Risk |
| `RISK_TREATMENT_PLAN.md` | `docs/governance/risk/risk-treatment-plan.md` | Risk |
| `RLS_POLICIES.md` | `docs/security/rls-policies.md` | Security |
| `ROLE_MATRIX.md` | `docs/governance/role-matrix.md` | Governance |
| `SCALABILITY_MODEL.md` | `docs/engineering/scalability-model.md` | Engineering |
| `SECURITY_ARCHITECTURE.md` | `docs/security/security-architecture.md` | Security |
| `SECURITY_STRATEGY_5Y.md` | `docs/security/security-strategy-5y.md` | Security |
| `SEO_STRATEGY_DOCUMENT.md` | `docs/strategy/seo-strategy-document.md` | Strategy |
| `SOC2_CONTROL_MATRIX.md` | `docs/compliance/soc2-control-matrix.md` | Compliance |
| `SOC2_PREPARATION_OUTLINE.md` | `docs/compliance/soc2-preparation-outline.md` | Compliance |
| `SOCIAL_MEDIA_PLAYBOOK.md` | `docs/sales/social-media-playbook.md` | Sales |
| `STATEMENT_OF_APPLICABILITY_ISO27001.md` | `docs/compliance/statement-of-applicability-iso27001.md` | Compliance |
| `TECH_DUE_DILIGENCE_PACKAGE.md` | `docs/compliance/tech-due-diligence-package.md` | DD |
| `TECHNOLOGY_STRATEGY_5Y.md` | `docs/strategy/technology-strategy-5y.md` | Strategy |
| `THREAT_MODEL.md` | `docs/security/threat-model.md` | Security |
| `UI_UX_GOVERNANCE.md` | `docs/governance/ui-ux-governance.md` | Governance |
| `VENDOR_MANAGEMENT_POLICY.md` | `docs/governance/vendor-management-policy.md` | Governance |
| `ZERO_TRUST_ROADMAP.md` | `docs/security/zero-trust-roadmap.md` | Security |
| `ISO 27001 alignment matrix` | `docs/compliance/iso27001-alignment-matrix.md` | Compliance (rename + .md) |

### 9.6 Scratch/stale (CUT) — 106+ filer untracked

**Gruppe 1 — commit_msg (40):** alle `.commit_msg_*.txt`

**Gruppe 2 — p3m3 (25):** `.p3m3-*`, `.audit-full.json`, `.dc011-inventory.json`

**Gruppe 3 — mcp (7):** `.mcp_apply_*`, `mcp_apply_*`, `mcp_patch13_*`

**Gruppe 4 — tpt (10):** `.tpt_*`, `.migration_*`

**Gruppe 5 — audit snapshots (3):** `audit-before.json`, `audit-prod-before.json`

**Gruppe 6 — exec/debug (7):** `exec_*`, `dev-smoke.*`, `diff-stat.txt`, `apply_payload*`, `invoke_apply_migration.json`, `admin-agreement-page.txt`, `agreement-status-full.txt`

**Gruppe 7 — zip (2):** `umbraco-clean.zip`, `umbraco-robots-only.zip` (also `*.zip` gitignored)

**Ekstra scratch:** `.dc028-secret.tmp`, `.smoke-provision.*`, `migration_min.sql`, `.tmp_public_schema.sql`, `.tmp_remote_types.ts`, `_proof_*.log` (3), `journal.txt` (**CUT** — Thomas 2026-05-25), `.vercel-trigger.txt` (**CUT** Gruppe 14 — tracked, siste commit `3bbd035a` 2026-01-20, 0 code refs)

**Tracked legacy på root:** `audit-v4.cjs` → **REFACTOR** til `scripts/audit/audit-v4.cjs` (Thomas 2026-05-25)

Alle scratch: **0 code consumers** verifisert via git grep.

### 9.7 .env-varianter (SECURITY-audit)

| Fil | Gitignored? | Committed? | Secrets? | Action |
|-----|-------------|------------|----------|--------|
| `.env.example` | nei | **ja** | nei (template) | **KEEP** |
| `.env.postdeploy.example` | nei | **ja** | nei (template) | **KEEP** |
| `.env.local` | ja | nei | ja (lokal) | **KEEP** lokal |
| `.env.vercel.local` | ja | nei | mulig | **KEEP** lokal |
| `.env.k6-staging-verify.tmp` | nei | nei | ukjent | **CUT** lokal + `.gitignore` |
| `.env.local.prod-backup` | nei | nei | **sannsynlig ja** | **CUT** lokal + `.gitignore` |
| `.env.preview-cron.tmp` | nei | nei | ukjent | **CUT** + `.gitignore` |
| `.env.prod-k6.tmp` | nei | nei | ukjent | **CUT** + `.gitignore` |
| `.env.sentry-diag-check` | nei | nei | mulig token | **CUT** + `.gitignore` |
| `.env.sentry-diag-preview` | nei | nei | mulig token | **CUT** + `.gitignore` |
| `.env.sentry-staging-check` | nei | nei | mulig token | **CUT** + `.gitignore` |
| `.env.staging-check` | nei | nei | mulig | **CUT** + `.gitignore` |
| `.env.staging-check.tmp` | nei | nei | mulig | **CUT** + `.gitignore` |
| `.env.staging-pull.tmp` | nei | nei | mulig | **CUT** + `.gitignore` |
| `.env.vercel.pull.checkpoint` | nei | nei | metadata | **CUT** + `.gitignore` |

**STOP-PUNKT 2:** **Ikke utløst** — ingen secrets committed. Anbefaling: utvid `.gitignore` med `.env.*.tmp`, `.env.*-check`, `.env.*-backup` mønstre i Sprint AB.

### 9.8 Build-artifact-filer

| Fil | Gitignored? | Committed? | Action |
|-----|-------------|------------|--------|
| `tsconfig.tsbuildinfo` | ja | nei | OK |
| `*.log` (root) | ja | nei | OK — `_proof_*.log`, `dev-smoke.*` CUT lokalt |

### 9.9 Ukjent — RESOLVED

| Fil | Beslutning (Thomas 2026-05-25) |
|-----|--------------------------------|
| `journal.txt` | **CUT** (lokal) |
| `queue.json` | **CUT** lokal (gitignored) |
| `.vercel-trigger.txt` | **CUT** — Gruppe 14; git: `3bbd035a` 2026-01-20, 0 code refs |
| `audit-v4.cjs` | **REFACTOR** → `scripts/audit/audit-v4.cjs` |

---

## CUT-grupperinger for Sprint AB (atomisk sletting)

| Gruppe | Innhold | Filer | LOC | Blast radius | Smoke etter merge |
|--------|---------|------:|----:|--------------|-------------------|
| **1 stale-scratch-root** | `.commit_msg_*`, `_proof_*.log`, debug txt | ~45 | 0 | null | `npm test` (2389) |
| **2 p3m3-artifacts** | `.p3m3-*`, `.audit-full.json`, `.dc011-*` | ~27 | 0 | null | none |
| **3 mcp-patch-artifacts** | `mcp_*`, `.mcp_*` | ~7 | 0 | null | none |
| **4 tpt-artifacts** | `.tpt_*`, `.migration_*` | ~10 | 0 | null | none |
| **5 audit-snapshot-stale** | `audit-before.json`, `audit-prod-before.json` | 2 | 0 | null | none |
| **6 exec-debug** | `exec_*`, `dev-smoke.*`, `apply_payload*`, `diff-stat.txt` | ~12 | 0 | null | none |
| **7 zip-artifacts** | `umbraco-*.zip` | 2 | 0 | null | none |
| **8 env-cleanup** | `.env.*.tmp`, `.env.*-check`, backups (lokal) | ~12 | 0 | null | `smoke:uptime` |
| **9 dead-folders-local** | `evidence/`, `artifacts/`, `.screenshots/` (lokal disk) | ~440 | 0 | null | none |
| **10 duplicate-utils** | `utils/` etter migrering imports | 5 | ~200 | medium | `npm test` + week smoke |
| **10.5 src-shim** | `src/` → `components/` (egen runde) | 20 | ~983 | medium | `npm test` + header/week UI |
| **11 archive-cleanup** | hele `archive/` (32 filer) | 32 | ~2849 | lav | `npm test` + build:enterprise |
| **12a k8s-cut** | `k8s/` (2 filer) | 2 | 0 | null | none |
| **12b infra-cut** | `infra/` (2 filer) | 2 | 0 | null | none |
| **13 workers-cut** | `workers/worker.ts` + `worker:queue` script | 1+pkg | ~50 | lav | cron smoke |
| **14 tracked-root-cut** | `.vercel-trigger.txt` | 1 | 0 | null | none |
| **15 audit-v4-refactor** | `audit-v4.cjs` → `scripts/audit/` | 1 | ~ | lav | `npm test` |
| **16 design-brief-refactor** | `design/DESIGN_BRIEF.md` → `docs/engineering/` | 1 | 0 | null | none |
| **17 repo-intel-ci** | weekly `npm run repo:scan` → `.github/workflows/repo-intelligence-refresh.yml` (søn 03:00 UTC) | workflow | — | lav | `/api/superadmin/system-graph/data` |
| **18 lib-repo-query-cut** | `lib/repo/query.ts` (0 TS consumers — PRE-AB verifisert) | 1 | ~ | null | `npm test` |
| **19 backoffice-governance** | Z.5 → `docs/governance/backoffice-policy-2026-05-26.md` (1 doc-PR) | 1 | 0 | null | agents:check |
| **20 lib-ai-keep-closure** | Z.7 → verifiser/fix determinisme `scripts/audit/lib-ai-keep-closure.json` | 1 | ~ | lav | `npm test` |

**Estimert Sprint AB:** 28–38 PR-er · **22–32 timer** (Fase B baseline: 7 PR / 6t for 34 filer).

---

## REFACTOR-plan for Sprint AB

### Docs-flytting
70 root `.md` → `docs/{governance,strategy,security,compliance,sales,engineering}/` per tabell §9.5.  
Oppdater eventuelle hardkodede lenker i CI/agents etter flytt.

### Duplikat-dedup og REFACTOR (Thomas 2026-05-25)

1. **`src/` → `components/`** (Gruppe **10.5**) — 20 filer, ~983 LOC, 8 re-exports · egen runde
2. **`utils/` → `lib/supabase/`** (Gruppe **10**) — 5 filer, ~18 import sites
3. **`repo-intelligence/`** (Gruppe **17**) — **KEEP + weekly CI** `npm run repo:scan`  
   Verifisert live: `lib/repo-intelligence/buildSystemGraph.ts` → `/api/superadmin/system-graph/data` · **ikke CUT**  
   **`lib/repo/query.ts`** → **CUT** Gruppe **18** (0 consumers, PRE-AB verifisert)
4. **`audit-v4.cjs`** (Gruppe **15**) → `scripts/audit/audit-v4.cjs`
5. **`design/DESIGN_BRIEF.md`** (Gruppe **16**) → `docs/engineering/design-brief.md`
6. **`audit/` forensic** — vurder merge inn i `docs/audit/forensic-2026-04-05/` (uendret, lavere prio)
7. **Z.5 backoffice policy** (Gruppe **19**) → `docs/governance/backoffice-policy-2026-05-26.md`
8. **Z.7 lib-ai-keep-closure** (Gruppe **20**) → determinisme-fix for `scripts/audit/lib-ai-keep-closure.json`

---

## INVESTIGATE — RESOLVED (Thomas 2026-05-25)

| # | Enhet | Beslutning | Sprint AB |
|---|-------|------------|-----------|
| 1 | `archive/` (32 filer, 0 consumers) | **CUT** hele mappen | Gruppe **11** |
| 2a | `k8s/` | **CUT** | Gruppe **12a** |
| 2b | `infra/` | **CUT** | Gruppe **12b** |
| 3 | `workers/worker.ts` | **CUT** (+ fjern `worker:queue` fra package.json) | Gruppe **13** |
| 4 | `src/` shim | **REFACTOR** → `components/` | Gruppe **10.5** (egen runde) |
| 5 | `repo-intelligence/` | **REFACTOR** weekly `repo:scan` CI — **ikke CUT** (live consumer verifisert) | Gruppe **17** |
| 6 | `journal.txt` | **CUT** lokal | Gruppe **1** (scratch) |
| 7 | `.vercel-trigger.txt` | **CUT** — git `3bbd035a` 2026-01-20, 0 refs | Gruppe **14** |
| 8 | `audit-v4.cjs` | **REFACTOR** → `scripts/audit/` | Gruppe **15** |
| 9 | `design/DESIGN_BRIEF.md` | **REFACTOR** → `docs/engineering/design-brief.md` | Gruppe **16** |
| 10 | `.tmp/` content | **CUT lokalt** (mappe beholdes gitignored) | Gruppe **9** (lokal disk) |
| 11 | `main_lunchportalen-umbraco.yml` | **KEEP** (Azure marketing aktiv — Z.3 deploy OK) | — |

### repo-intelligence verifikasjon (punkt 5 — PRE-AB 2026-05-25)

| Consumer | Path | Status |
|----------|------|--------|
| System graph API | `app/api/superadmin/system-graph/data/route.ts` → `buildSystemGraph()` | **LIVE prod** |
| System graph UI | `app/superadmin/system-graph/page.tsx` + `SystemGraphClient.tsx` | **LIVE prod** (superadmin) |
| Generator | `scripts/scanRepo.ts` (`npm run repo:scan`) | **KEEP** — ikke i scheduled CI i dag |
| Query engine | `lib/repo/query.ts` | **0 consumers** → CUT Gruppe **18** |
| Autonomous tooling | `scripts/runAutonomous.ts`, `scripts/autoFix.ts`, `scripts/generateAudit.ts` | Dev/CI-adhoc (auditReport, ikke graf-JSON) |

**Konklusjon:** `buildSystemGraph.ts` + graf-JSON **KEEP**. Stale data (2026-03-26) — Gruppe **17** introduserer weekly `repo-intelligence-refresh.yml`. `lib/repo/query.ts` er dead — CUT separat.

---

## INVESTIGATE — original (arkiv)

<details>
<summary>Original ja/nei-liste (løst 2026-05-25)</summary>

1. `k8s/` + `infra/` → **CUT** (12a/12b)  
2. `workers/worker.ts` → **CUT** (13)  
3. `archive/` → **CUT** (11)  
4. `src/` → **REFACTOR** (10.5)  
5. `repo-intelligence/` → **REFACTOR** weekly CI (17)  
6. `journal.txt` → **CUT**  
7. `.vercel-trigger.txt` → **CUT** (14)  
8. `audit-v4.cjs` → **REFACTOR** (15)  
9. `design/DESIGN_BRIEF.md` → **REFACTOR** (16)  
10. `main_lunchportalen-umbraco.yml` → **KEEP**

</details>

---

## Konflikt-funn (kritisk)

| Konflikt | Status | Anbefaling |
|----------|--------|------------|
| `src/` vs `app/` | **Begge finnes** · `src/app/` **NEI** | **REFACTOR** Gruppe 10.5 → `components/` |
| `k8s/` vs Vercel | K8s unused | **CUT** Gruppe 12a (Thomas OK) |
| `infra/` vs Vercel | ECS unused | **CUT** Gruppe 12b (Thomas OK) |
| `utils/` vs `lib/utils/` | 18 vs 2 imports | REFACTOR dedup |
| `evidence/` vs `reports/` vs `audit/` vs `artifacts/` | Overlappende DD/formål | KEEP tracked `audit/` · CUT gitignored rest |
| `public/brand/` logo navn | Mulig drift vs AGENTS.md | Verifiser i egen UI-fix |

---

## Security-funn

**Ingen committed secrets.** Kun template `.env` i git.

**Gap:** 12+ lokale `.env.*`-varianter **ikke** dekket av `.gitignore` (untracked men risiko ved `git add -A`). Sprint AB: utvid ignore-mønstre.

**`.vercel/` on disk:** Inneholder `.env.production.local` — korrekt gitignored; verifiser aldri staged.

---

## Anbefalt Sprint AB-rekkefølge

1. **Scratch-cleanup** (Grupper 1–7, 14) — null risiko · ~9 PR  
2. **`.gitignore` hardening** (Gruppe 8) — 1 PR  
3. **Docs-refactor** (70 filer flytt) — ~8 PR  
4. **`utils/` dedup** (Gruppe 10) — 1–2 PR  
5. **`src/` konsolidering** (Gruppe **10.5**) — 2 PR · egen runde  
6. **`archive/` CUT** (Gruppe 11) — 1 PR  
7. **`k8s/` CUT** (12a) + **`infra/` CUT** (12b) + **`workers/` CUT** (13) — 3 PR  
8. **REFACTOR** audit-v4 (15), design-brief (16), repo-intel CI (17) — 3 PR  
9. **CUT** `lib/repo/query.ts` (18) — 1 PR  
10. **Z.5 governance doc** (19) + **Z.7 closure determinisme** (20) — 2 PR  
11. **Lokal disk** (`evidence/`, `artifacts/`, `.tmp/`, `journal.txt`) — manuelt

**Estimert effort:** **22–32 timer** over 28–38 PR-er.

---

## Cleanup-sprint Z → Sprint AB absorpsjon

| Z-item | Status | Sprint AB |
|--------|--------|-----------|
| **Z.1–Z.3** | ✅ Merged (`7e34bcbd`, `1d41f1b5`, `702ce987`) | — |
| **Z.4** Contact hero backoffice-verifikasjon | Thomas-action (re-save blokk) | Rapport-doc ved behov — ikke direkte AB |
| **Z.5** backoffice-governance policy | Absorbert | **Gruppe 19** |
| **Z.6** 5 stale untracked-filer | Absorbert | **Gruppe 1–7** (samme filer) |
| **Z.7** lib-ai-keep-closure determinisme | Absorbert | **Gruppe 20** |

**Z paused** etter Z.3 · videre arbeid via Sprint AB.

---

## Verifikasjons-checklist (Del 8)

- [x] Alle vanlige mapper inventoried + deep-dive'd
- [x] Alle dot-folders inventoried + deep-dive'd
- [x] Alle top-level filer klassifisert
- [x] Build-artifacts ekskludert med gitignore-verifikasjon
- [x] `src/` vs `app/` konflikt sjekket
- [x] `cua/` akronym forklart (Chrome Unified Aggregation)
- [x] `utils/` vs `lib/utils/` deduplisering-status
- [x] `k8s/` vs Vercel-stack vurdert
- [x] evidence/reports/audit/artifacts overlapp vurdert
- [x] Alle `.env`-filer security-auditert
- [x] Ingen committed secrets — STOP-PUNKT 2 ikke utløst
- [x] Total counts levert
- [x] CUT-grupperinger for Sprint AB
- [x] REFACTOR-liste med mål-stier
- [x] INVESTIGATE-liste — **12/12 RESOLVED** (Thomas 2026-05-25)

---

*Generert Sprint AA 2026-05-25 · INVESTIGATE resolution + PRE-AB repo-intel verifikasjon 2026-05-25 · 0 INVESTIGATE remaining · Klar for Sprint AB Gruppe 1.*
