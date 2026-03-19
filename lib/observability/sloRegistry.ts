// lib/observability/sloRegistry.ts
// Canonical SLO definitions. Every SLO must have a measurable SLI (see sli.ts).

import type { SloDefinition, SloId } from "./types";

export const SLO_REGISTRY: Record<SloId, SloDefinition> = {
  system_health: {
    id: "system_health",
    serviceId: "core_system",
    name: "System health",
    description: "Core system health (runtime env, DB, Sanity, time) is OK.",
    sliKey: "system_health",
    targetPercent: 99.9,
    windowMinutes: 60,
    criticalThresholdPercent: 99,
    warnThresholdPercent: 99.5,
    measurementNote: "Percentage of system_health_snapshots in last 60 minutes with status=normal.",
    operatorHint: "Sjekk superadmin/system health for runtime/DB/Sanity-feil og følg flytdiagnostikk til feilende sjekk.",
  },
  cron_outbox: {
    id: "cron_outbox",
    serviceId: "cron",
    name: "Outbox processing",
    description: "Cron outbox job runs successfully.",
    sliKey: "cron_outbox",
    targetPercent: 99,
    windowMinutes: 1440, // 24h
    criticalThresholdPercent: 95,
    warnThresholdPercent: 98,
    measurementNote: "From cron_runs (job=outbox) when outbox persists runs; otherwise SLI is unknown.",
    operatorHint: "Verifiser at cron outbox kjører, sjekk CRON_SECRET og outbox-respons (processed/sent/failed) og persistering til cron_runs.",
  },
  cron_critical: {
    id: "cron_critical",
    serviceId: "cron",
    name: "Critical cron jobs",
    description: "Forecast and other critical cron jobs succeed.",
    sliKey: "cron_critical",
    targetPercent: 99,
    windowMinutes: 1440,
    criticalThresholdPercent: 95,
    warnThresholdPercent: 98,
    measurementNote: "Percentage of cron_runs in last 24h for jobs forecast, preprod, week-visibility with status=ok.",
    operatorHint: "Sjekk cron_runs for forecast/preprod/week-visibility, cron-auth (CRON_SECRET/SYSTEM_MOTOR_SECRET) og tilhørende system.incidents.",
  },
  order_write: {
    id: "order_write",
    serviceId: "orders",
    name: "Order write success",
    description: "Order placement (POST /api/orders/upsert) succeeds or fails deterministically without 5xx.",
    sliKey: "order_write",
    targetPercent: 99.9,
    windowMinutes: 60,
    criticalThresholdPercent: 99,
    warnThresholdPercent: 99.5,
    measurementNote: "Inferred from absence of open ORDER system_incidents (no persistent order-write failures). Future: ops_events order.upsert.success/failure.",
    operatorHint: "Undersøk åpne ORDER system_incidents, /api/orders/upsert-responser og ev. DB-logg for ordre som feiler eller avvises feilaktig.",
  },
  auth_protected_route: {
    id: "auth_protected_route",
    serviceId: "auth",
    name: "Auth / protected routes",
    description: "Protected routes are reachable; no auth-related system failures.",
    sliKey: "auth_protected_route",
    targetPercent: 99.9,
    windowMinutes: 60,
    criticalThresholdPercent: 99.5,
    warnThresholdPercent: 99.8,
    measurementNote: "Inferred from absence of open AUTH system_incidents (no persistent auth/role/redirect failures).",
    operatorHint: "Sjekk AUTH-system_incidents, /api/auth/post-login, middleware og rolle-gates for redirect-loops eller feil landingssider.",
  },
  content_publish: {
    id: "content_publish",
    serviceId: "cms",
    name: "Content / CMS workflow",
    description: "Content publish and scheduler run without persistent failure.",
    sliKey: "content_publish",
    targetPercent: 99,
    windowMinutes: 1440,
    criticalThresholdPercent: 95,
    warnThresholdPercent: 98,
    measurementNote: "Inferred from open system_incidents (SANITY/INTEGRATION) and scheduler/cron failures around content publish/release.",
    operatorHint: "Sjekk åpne SANITY/INTEGRATION-system_incidents og scheduler-/cron-ruter for content-publiserings- eller releasefeil.",
  },
};

export function getSloDefinition(id: SloId): SloDefinition {
  const def = SLO_REGISTRY[id];
  if (!def) throw new Error(`Unknown SLO id: ${id}`);
  return def;
}

export function getAllSloIds(): SloId[] {
  return Object.keys(SLO_REGISTRY) as SloId[];
}
