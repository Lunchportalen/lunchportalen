# E0 — Evidence map

**Dato:** 2026-03-29

| Area | Claimed status | Code evidence | Doc evidence | Verification status |
|------|----------------|---------------|--------------|---------------------|
| Core orders/week | Runtime | `lib/week/*`, `app/api/order/**`, Vitest | `docs/live-ready/*`, hardening | **PROVED** (tester) |
| Middleware auth | Session on paths | `middleware.ts` | `OPEN_PLATFORM_RISKS` A1 | **PARTIAL** (ikke rolle) |
| API role gates | Mønster | `scopeOr401`, `requireRoleOr403` spredt | `LIVE_READY_AUTH_HARDENING.md` | **PARTIAL** (ikke full enumerering) |
| Cron Vercel | LIVE | `vercel.json`, `app/api/cron/**` | `LIVE_READY_CRON_WORKER_STATUS.md` | **PROVED** (sync + tester delvis) |
| Worker outbox retry | LIVE | `workers/worker.ts` `retry_outbox` | H2 docs | **PROVED** (kode + logikk) |
| Worker email/AI/experiment | STUB | `workers/worker.ts` `*_stub` | Denne fil | **PROVED** (eksplisitt stub) |
| Social publish external | DRY_RUN mulig | `lib/social/*`, API routes | Growth posture | **PARTIAL** |
| SEO | Review-first | CMS workspace | Publish docs | **PARTIAL** |
| ESG | DB-drevet | API routes | ESG docs | **PARTIAL** |
| Type safety | Non-strict | `tsconfig.json` `"strict": false` | OPEN_PLATFORM_RISKS A3 | **PROVED** |
| Scale | Ukjent | Ingen lasttest i repo | `PERFORMANCE_AND_SCALE_PLAN.md` | **NOT_PROVED** |
| Backup | Ukjent i repo | — | Runbooks | **DOC_ONLY** |
| Support response | Ukjent | — | `LIVE_READY_SUPPORT_MODEL.md` | **DOC_ONLY** |
| Build gate | OK | `package.json` scripts | CI | **PROVED** (kjør lokalt/CI) |

**Tolkning:** Der status er **NOT_PROVED**, **DOC_ONLY** eller **STUB** i kode, kan **ubetinget enterprise-live** ikke hevdes.
