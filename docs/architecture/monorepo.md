# Monorepo Architecture

**Status:** Canonical architecture reference (Sprint AB Fase F.2)  
**Audience:** Due diligence reviewers, new developers, future maintainers  
**Scope:** Repository layout, deploy targets, data stores, CI/CD — not product marketing

---

## Overview

Two systems coexist in this Git repository (`Lunchportalen/lunchportalen`). They deploy to separate targets and serve distinct surfaces:

| System | URL | Stack | Deploy target |
|--------|-----|-------|---------------|
| Marketing site | `lunchportalen.no` | Umbraco 17 (.NET 10) | Azure App Service + Azure SQL |
| Application | `app.lunchportalen.no` | Next.js App Router + Supabase + Sanity | Vercel |

This is a **logical monorepo** (one Git repository, multiple deployable systems). It is **not** an npm/pnpm workspace monorepo: there is a single root `package.json` for the Next.js application; the Umbraco project lives under `umbraco17/lunchportalen/` with its own `.csproj`.

Public marketing HTML in production is intended to be served from **Umbraco on Azure**. The Next.js app owns the operational product (login, week view, orders, admin roles, API routes, cron). See [PUBLIC_SITE_AND_APP_BOUNDARIES.md](./PUBLIC_SITE_AND_APP_BOUNDARIES.md) for public-vs-app routing detail.

---

## Repository layout

```mermaid
graph TD
    root["lunchportalen/"]
    root --> app["app/"]
    root --> umbraco["umbraco17/lunchportalen/"]
    root --> lib["lib/"]
    root --> components["components/"]
    root --> studio["studio/"]
    root --> supabase["supabase/"]
    root --> scripts["scripts/"]
    root --> github[".github/workflows/"]
    root --> docs["docs/"]
    root --> ri["repo-intelligence/"]

    app -.-> nextDeploy["Next.js — Vercel"]
    umbraco -.-> azureDeploy["Umbraco — Azure App Service"]
```

### Top-level directories

| Path | System | Purpose |
|------|--------|---------|
| `app/` | Next.js | App Router pages, layouts, `app/api/` routes |
| `umbraco17/lunchportalen/` | Umbraco | .NET 10 Umbraco 17 CMS project (`lunchportalen.csproj`) |
| `lib/` | Next.js | Domain logic, auth guards, Supabase clients, HTTP helpers |
| `components/` | Next.js | Shared React UI (includes canonical header primitives) |
| `studio/` | Next.js (Sanity) | Sanity Studio config and schema (`sanity.config.ts`) |
| `supabase/` | Next.js | Postgres migrations (`supabase/migrations/`), local config |
| `scripts/` | Both | CI, audit, scan, and maintenance scripts |
| `tests/`, `e2e/` | Next.js | Vitest and Playwright test suites |
| `.github/workflows/` | Both | 16 GitHub Actions workflows (see CI/CD below) |
| `docs/` | Both | Documentation hub |
| `repo-intelligence/` | Next.js | Generated JSON artifacts from `npm run repo:scan` |
| `cua/` | Neither (tooling) | Chrome policy merge utility (Python); CI via `policy-merge.yml` |

For historical detail on monorepo evolution and per-folder audit notes, see:

- [docs/audit/enterprise-v2-2026-05-25/02-monorepo-anatomi.md](../audit/enterprise-v2-2026-05-25/02-monorepo-anatomi.md)
- [docs/audit/05-top-level-directories.md](../audit/05-top-level-directories.md)

These audit records are **immutable** historical context; this document is the maintained canonical reference.

---

## Data architecture

Hard rule: **one source of truth per data domain**. Operational data, menu editorial data, and marketing content live in separate stores.

```mermaid
graph LR
    nextjs["Next.js app"]
    umbraco["Umbraco CMS"]

    nextjs --> supabase[("Supabase Postgres")]
    nextjs --> sanity[("Sanity")]
    umbraco --> azuresql[("Azure SQL")]

    supabase -.-> ops["orders, profiles, companies, deliveries"]
    sanity -.-> menu["week menus, dishes"]
    azuresql -.-> content["marketing pages, media, navigation"]
```

| Data domain | Store | Location in repo | Notes |
|-------------|-------|------------------|-------|
| Operational (orders, users, roles, agreements) | Supabase Postgres | `supabase/migrations/` (265+ SQL files), `lib/supabase/` | RLS-enforced; RPC-only writes for orders |
| Menu / week plans | Sanity | `studio/sanity.config.ts`, `studio/schemaTypes/` | Editorial workflow for lunch menus |
| Marketing content | Umbraco / Azure SQL | `umbraco17/lunchportalen/` (code only) | DB connection string **not in repo** — Azure App Service config `umbracoDbDSN` |

Data does not duplicate across these stores. Next.js may read Umbraco Delivery API for development or mapping; production public HTML is documented as Umbraco-hosted (see boundaries doc above).

---

## Deploy pipelines

```mermaid
graph LR
    push["git push to main"]
    push --> vercel["Vercel auto-deploy"]
    push --> umbracoWF["main_lunchportalen-umbraco.yml"]
    umbracoWF -.->|"if umbraco17/** changed"| azure["Azure App Service"]

    vercel -.-> appUrl["app.lunchportalen.no"]
    azure -.-> publicUrl["lunchportalen.no"]
```

### Next.js (Vercel)

| Item | Value |
|------|-------|
| Trigger | Git integration on push to `main` (no dedicated deploy workflow in `.github/workflows/`) |
| Config | `vercel.json` (cron schedules for `/api/cron/*`) |
| Production URL | `app.lunchportalen.no` |
| Preview | Vercel preview deployments for pull requests (project setting) |
| Path filter | None at GitHub level — Vercel receives repository pushes |

### Umbraco (Azure App Service)

| Item | Value |
|------|-------|
| Trigger | Push to `main` when paths under `umbraco17/lunchportalen/**` change; `workflow_dispatch` |
| Workflow | [.github/workflows/main_lunchportalen-umbraco.yml](../../.github/workflows/main_lunchportalen-umbraco.yml) |
| Target | Azure Web App `lunchportalen-umbraco` |
| Production URL | `https://lunchportalen.no` (`appsettings.Production.json`) |
| Database | Azure SQL — credentials in Azure App Service configuration, not committed |
| Schema versioning | uSync activation planned (Sprint AB Fase F.4) |

---

## CI/CD

The repository contains **16** GitHub Actions workflows under `.github/workflows/`.

| Category | Workflows | Path-selective? |
|----------|-----------|-----------------|
| Next.js CI gates | `ci.yml`, `ci-agents.yml`, `ci-e2e.yml`, `ci-enterprise.yml` | No — run on all PRs / main pushes |
| Database | `supabase-migrate.yml` | No — runs on all PRs and main push |
| Umbraco deploy | `main_lunchportalen-umbraco.yml` | **Yes** — `umbraco17/lunchportalen/**` |
| Tooling | `policy-merge.yml` | **Yes** — `cua/**` only |
| Scheduled / dispatch | `security-audit`, `rls-drift-check`, `deps-weekly`, `codex-*`, `weekly-repo-intelligence-refresh`, `auto-engineer`, `postdeploy`, `automerge-lowrisk` | No (trigger-based, not path-filtered) |

**DD note:** Currently **2 of 16** workflows are path-selective (`main_lunchportalen-umbraco.yml`, `policy-merge.yml`). The remaining **14** run on all pull requests regardless of which system is modified (or trigger on schedule/dispatch without path filters). This is documented as a known optimization opportunity (Sprint AB Fase F.3 — selective CI verification).

Full workflow inventory: [.github/workflows/](../../.github/workflows/).

| Workflow file | Primary purpose |
|---------------|-----------------|
| `ci.yml` | Main CI gate (typecheck, lint, test, build) |
| `ci-agents.yml` | AGENTS.md policy gate |
| `ci-e2e.yml` | Playwright E2E |
| `ci-enterprise.yml` | Release gate (`ci:critical` sequence) |
| `supabase-migrate.yml` | DB migrations staging/prod |
| `main_lunchportalen-umbraco.yml` | Umbraco build + Azure deploy |
| `postdeploy.yml` | Post-merge production smoke |
| `security-audit.yml` | Scheduled npm audit |
| `rls-drift-check.yml` | RLS golden snapshot drift |
| `deps-weekly.yml` | Weekly dependency PR bot |
| `codex-design-system.yml` | Codex design patch bot |
| `codex-audit-autofix.yml` | Codex autofix bot |
| `auto-engineer.yml` | Autonomous audit pipeline |
| `weekly-repo-intelligence-refresh.yml` | Repo scan + auto-PR |
| `policy-merge.yml` | CUA Chrome policy merge (`cua/**`) |
| `automerge-lowrisk.yml` | Auto-merge labeled low-risk PRs |

---

## Cross-system concerns

| Concern | Behavior |
|---------|----------|
| **Authentication** | Next.js: Supabase Auth (session cookies). Umbraco: Umbraco Identity. No shared session. |
| **Public vs app traffic** | When `UMBRACO_PUBLIC_SITE_URL` is set, Next middleware redirects marketing paths to Umbraco public origin. See [PUBLIC_SITE_AND_APP_BOUNDARIES.md](./PUBLIC_SITE_AND_APP_BOUNDARIES.md). |
| **`/umbraco` in Next** | Rewritten to Umbraco CMS origin (`UMBRACO_CMS_ORIGIN` / Delivery API base); not the Next `/backoffice` shell. |
| **Shared repo tooling** | `scripts/audit/`, `npm run repo:scan`, and `weekly-repo-intelligence-refresh.yml` scan both Next.js and Umbraco paths for inventory artifacts. |
| **Third-party data flow** | No direct database replication between Supabase and Azure SQL. Integration is at HTTP/API and editorial process level, not shared DB. |

---

## Development workflow

### Next.js (application)

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:run
npm run build:enterprise
```

Required env vars are documented in `.env.example` and `AGENTS.md`. Secrets are never committed.

### Umbraco (marketing CMS)

```bash
cd umbraco17/lunchportalen
dotnet restore
dotnet run           # local HTTPS (see launchSettings.json)
dotnet build
```

Local Umbraco requires Azure SQL or local SQL connection configured outside the repo (App Service `umbracoDbDSN` in production).

### Sanity Studio (menu editorial)

```bash
# From repo root — see package.json scripts and studio/README if present
npm run dev          # Next dev may proxy studio routes depending on config
```

Studio source: `studio/sanity.config.ts`.

---

## Related documentation

| Document | Purpose |
|----------|---------|
| [PUBLIC_SITE_AND_APP_BOUNDARIES.md](./PUBLIC_SITE_AND_APP_BOUNDARIES.md) | Public Umbraco vs Next app routing |
| [CONVENTIONS.md](../CONVENTIONS.md) | Documentation naming and hub structure |
| [governance/backoffice-policy.md](../governance/backoffice-policy.md) | Admin surface access (Next + Umbraco + cloud consoles) |
| [security/security-architecture.md](../security/security-architecture.md) | Security controls and tenant isolation |
| [enterprise/README.md](../enterprise/README.md) | Enterprise DD document pack entry point |
| [compliance/iso27001-alignment-matrix.md](../compliance/iso27001-alignment-matrix.md) | ISO 27001 alignment |
