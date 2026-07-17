/**
 * DC-011 / Fase 3 — explicit API auth allowlist (no wildcards in Set).
 * Dynamic App Router segments are matched via ALLOWLIST_DYNAMIC (documented exceptions).
 *
 * Total: 90 routes (83 path + 2 GET-only + 5 dynamic). Includes 16NO.2 Norway legal docs list + [type].
 */

/** Exact paths only — verified fail-closed / anon (a)–(d) / api-key in route files. */
export const API_AUTH_ALLOWLIST: ReadonlySet<string> = new Set([
  // Fase 3: /api/accept-invite/complete, /api/admin/accept-invite/complete and
  // /api/admin/invites/register removed (duplicate invite completion routes
  // consolidated into /api/auth/accept-invite).
  "/api/address/resolve",
  "/api/address/search",
  "/api/admin/auth/login",
  "/api/admin/invites/lookup",
  "/api/auth/accept-invite",
  "/api/auth/forgot-password",
  "/api/auth/login",
  "/api/auth/login-debug",
  "/api/auth/logout",
  "/api/auth/register-company-admin",
  "/api/auth/register-provider-admin",
  "/api/auth/session",
  "/api/company/create",
  "/api/contact",
  "/api/cron/ai-experiment-generator",
  "/api/cron/autopilot",
  "/api/cron/business",
  "/api/cron/check-deviations",
  "/api/cron/cleanup-invites",
  "/api/cron/commission-settlement",
  "/api/cron/daily-order-summary",
  "/api/cron/daily-sanity",
  "/api/cron/experiments",
  "/api/cron/forecast",
  "/api/cron/global-learning",
  "/api/cron/invoices/generate",
  "/api/cron/kitchen-print",
  "/api/cron/meal-learning",
  "/api/cron/menu-service-day-reconcile",
  "/api/cron/menu-week-rollout",
  "/api/cron/menu-week-opening-notify",
  "/api/cron/monitoring",
  "/api/cron/outbox",
  "/api/cron/pipeline",
  "/api/cron/preprod",
  "/api/cron/revenue",
  "/api/cron/social",
  "/api/cron/system-motor",
  "/api/cron/tripletex-agreements-daily",
  "/api/cron/tripletex-connection-health-daily",
  "/api/cron/tripletex-outbox",
  "/api/cron/tripletex-saas-monthly",
  "/api/cron/week-scheduler",
  "/api/cron/week-visibility",
  "/api/driver/confirm",
  "/api/experiments/assign",
  "/api/experiments/track",
  "/api/health",
  "/api/health/live",
  "/api/health/ready",
  "/api/integrations/execute",
  "/api/internal/production-operative-snapshot/materialize",
  "/api/internal/scheduler/run",
  "/api/onboarding/complete",
  "/api/onboarding/terms-pdf",
  "/api/order/set-choice",
  "/api/order/set-day",
  "/api/outbox/retry",
  "/api/pitch",
  "/api/public/ai-demo-cta/assign",
  "/api/public/analytics",
  "/api/public/coverage/check",
  "/api/public/demo-interest",
  "/api/public/leads/capture",
  "/api/public/onboarding/register",
  "/api/public/provider-registration",
  "/api/public/register",
  "/api/public/register-company",
  "/api/public/search",
  // 16NO.2 — public Norway document metadata for clickwrap (version + checksum).
  "/api/legal/norway/documents",
  "/api/register",
  "/api/social/redirect",
  "/api/social/track",
  "/api/something",
  "/api/superadmin/invoices/mapping",
  "/api/system/outbox/process",
  "/api/system/time",
  "/api/saas/billing/webhook",
  "/api/track/click",
  "/api/v1/public/orders",
  "/api/webhooks/sanity/menu-day",
  "/api/webhooks/stripe-billing-payments",
  "/api/webhooks/stripe-provider-setup",
  "/api/webhooks/tripletex",
]);

/**
 * Middleware session-bypass for GET only (POST must pass session gate + route superadmin guard).
 * Used for public marketing chrome reads while blocking anon writes at middleware layer.
 */
export const API_AUTH_ALLOWLIST_GET_ONLY: ReadonlySet<string> = new Set([
  "/api/content/global/footer",
  "/api/content/global/header",
]);

/** Dynamic allowlist entries from inventory A.2/A.3 — one segment, route-level auth verified. */
const ALLOWLIST_DYNAMIC: ReadonlyArray<(pathname: string) => boolean> = [
  (p) => /^\/api\/public\/forms\/[^/]+$/.test(p),
  (p) => /^\/api\/public\/forms\/[^/]+\/schema$/.test(p),
  (p) => /^\/api\/webhooks\/tripletex-provider\/[^/]+$/.test(p),
  // 16NO.2 — public document body by type (exact version linked from checkbox).
  (p) => /^\/api\/legal\/norway\/documents\/[^/]+$/.test(p),
];

export function isApiAuthAllowlisted(pathname: string, method?: string): boolean {
  const verb = safeHttpMethod(method);
  if (API_AUTH_ALLOWLIST_GET_ONLY.has(pathname)) {
    return verb === "GET";
  }
  if (API_AUTH_ALLOWLIST.has(pathname)) return true;
  return ALLOWLIST_DYNAMIC.some((fn) => fn(pathname));
}

function safeHttpMethod(method: string | undefined): string {
  const m = String(method ?? "GET").trim().toUpperCase();
  return m || "GET";
}

export const API_AUTH_ALLOWLIST_SIZE =
  API_AUTH_ALLOWLIST.size + API_AUTH_ALLOWLIST_GET_ONLY.size + ALLOWLIST_DYNAMIC.length;
