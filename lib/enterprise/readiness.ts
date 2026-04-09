/**
 * Enterprise readiness — dokumentasjon av faktisk dekning i kodebasen (ingen runtime-sideeffekter).
 * Oppdater ved større sikkerhets-/infra-endringer.
 */

export const ENTERPRISE_READINESS = {
  score: 92,
  scale: "0–100 (subjektiv vurdering av implementert kontrollflate, ikke penetrasjonstest)",
  lastReviewed: "2026-03-25",
  coverage: {
    rbac: {
      status: "implemented",
      notes:
        "Server-side `scopeOr401` + `requireRoleOr403` (`lib/http/routeGuard.ts`), `assertRole` / `assertAuthedRole` (`lib/auth/requireRole.ts`), roller i `lib/auth/roles.ts` + `ROLES`-alias.",
    },
    rls: {
      status: "implemented",
      notes:
        "`lead_pipeline`, `orders`, `social_posts`, `ai_activity_log` har RLS aktivert i migreringer (bl.a. `20260324170000_lead_pipeline.sql`, `tenant_rls_hardening`, `social_posts_events`, `ai_activity_log`). Service role for API som krever det.",
    },
    audit: {
      status: "implemented",
      notes: "`lib/audit/log.ts`, `auditWrite`, `ai_activity_log` for AI/operasjonelle hendelser.",
    },
    observability: {
      status: "implemented",
      notes: "`/api/observability`, graph metrics, `lib/sre/metrics`, Redis L2 + `simpleCache` L1 der aktivert.",
    },
    queueWorkers: {
      status: "implemented",
      notes: "`lib/infra/queue.ts`, `lib/infra/redis.ts`, `workers/worker.ts`, outbox-fanout valgfri (`OUTBOX_QUEUE_FANOUT`).",
    },
    idempotency: {
      status: "implemented",
      notes: "`lib/core/idempotency.ts` + `public.idempotency` tabell.",
    },
    versioning: {
      status: "implemented",
      notes: "`page_versions` + RPC `lp_insert_page_version`; CMS preview/vekst bruker `lib/backoffice/content/pageVersionsRepo.ts`.",
    },
    experiments: {
      status: "implemented",
      notes: "`ai_experiments`, SoMe A/B (`socialAb.ts`), revenue loop (`lib/autonomy/runRevenue.ts`).",
    },
    gdpr: {
      status: "implemented",
      notes: "`/api/user/gdpr/export`, `/api/user/gdpr/delete`.",
    },
    rateLimiting: {
      status: "implemented",
      notes: "`lib/security/rateLimit.ts`, kontakt/AI/autonomi-ruter.",
    },
    autonomySafety: {
      status: "implemented",
      notes: "`lib/autonomy/guardrails.ts`, kill switch, dry-run, godkjenning av risikable handlinger.",
    },
  },
} as const;
