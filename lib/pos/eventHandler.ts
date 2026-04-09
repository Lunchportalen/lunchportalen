import "server-only";

import type { ExperimentResults } from "@/lib/experiments/types";

import type { PosCycleContext } from "@/lib/pos/orchestrator";
import type { PosEvent, PosEventType } from "@/lib/pos/events";
import { orderSurfacesForPriority, type PosSignalPriority } from "@/lib/pos/posStabilizer";
import type { ProductSurface } from "@/lib/pos/surfaceRegistry";

type Accumulator = {
  event_types: Set<PosEventType>;
  last_company_id?: string;
  last_tool?: string;
  last_experiment_id?: string;
  last_cms_body?: unknown;
  /** True if any variant event came from public analytics. */
  had_content_analytics: boolean;
};

function emptyAccumulator(): Accumulator {
  return {
    event_types: new Set(),
    had_content_analytics: false,
  };
}

let pending: Accumulator | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function debounceMs(): number {
  const raw = String(process.env.POS_EVENT_DEBOUNCE_MS ?? "").trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 500 && n <= 300_000) return Math.floor(n);
  }
  return 10_000;
}

function takeAccumulator(): Accumulator | null {
  const p = pending;
  pending = null;
  return p;
}

function mergeEvent(acc: Accumulator, event: PosEvent): void {
  acc.event_types.add(event.type);
  switch (event.type) {
    case "ai_usage_updated":
      if (event.company_id?.trim()) acc.last_company_id = event.company_id.trim();
      if (event.tool?.trim()) acc.last_tool = event.tool.trim();
      break;
    case "variant_performance_updated":
      if (event.experiment_id?.trim()) acc.last_experiment_id = event.experiment_id.trim();
      if (event.analytics_event_type != null || event.page_id != null || event.variant_id_analytics != null) {
        acc.had_content_analytics = true;
      }
      break;
    case "cms_content_changed":
      if (event.body_sample !== undefined) acc.last_cms_body = event.body_sample;
      break;
    case "signup_completed":
      if (event.company_id?.trim()) acc.last_company_id = event.company_id.trim();
      break;
    default:
      break;
  }
}

function surfacesForAccumulator(acc: Accumulator): ProductSurface[] | undefined {
  if (acc.event_types.size === 0) return undefined;
  const out = new Set<ProductSurface>();
  if (acc.event_types.has("ai_usage_updated")) {
    out.add("superadmin_dashboard");
    out.add("backoffice_editor");
    out.add("company_admin");
  }
  if (acc.event_types.has("variant_performance_updated")) {
    out.add("public_demo");
    out.add("backoffice_editor");
    out.add("superadmin_dashboard");
    out.add("employee");
    out.add("week");
  }
  if (acc.event_types.has("cms_content_changed")) {
    out.add("backoffice_editor");
    out.add("public_demo");
  }
  if (acc.event_types.has("signup_completed")) {
    out.add("onboarding");
    out.add("company_admin");
  }
  return out.size > 0 ? [...out] : undefined;
}

/** Signal queue priority: cms_update > ai_usage > growth (variant / analytics / signup). */
function dominantSignalPriority(acc: Accumulator): PosSignalPriority {
  if (acc.event_types.has("cms_content_changed")) return "cms_update";
  if (acc.event_types.has("ai_usage_updated")) return "ai_usage";
  return "growth";
}

function windowDaysForAccumulator(acc: Accumulator): number | undefined {
  if (acc.event_types.has("cms_content_changed")) return 14;
  if (acc.event_types.has("ai_usage_updated")) return 14;
  if (acc.had_content_analytics) return 7;
  return 14;
}

function liftsFromExperimentResults(results: ExperimentResults): Array<{ id: string; lift: number }> {
  const variants = Array.isArray(results.variants) ? results.variants : [];
  if (variants.length === 0) return [];
  const best = Math.max(...variants.map((v) => v.conversionRate), 0);
  return variants.map((v) => ({
    id: v.variantId,
    lift: v.conversionRate - best,
  }));
}

async function buildCycleContext(acc: Accumulator): Promise<PosCycleContext> {
  const signal_priority = dominantSignalPriority(acc);
  const rawSurfaces = surfacesForAccumulator(acc);
  const surfaces =
    rawSurfaces && rawSurfaces.length > 0 ? orderSurfacesForPriority(rawSurfaces, signal_priority) : undefined;
  const window_days = windowDaysForAccumulator(acc);
  let variant_performance_override: Array<{ id: string; lift: number }> | undefined;

  if (acc.last_experiment_id) {
    const { calculateResults } = await import("@/lib/experiments/evaluator");
    const calc = await calculateResults(acc.last_experiment_id);
    if (calc.ok) {
      variant_performance_override = liftsFromExperimentResults(calc.results);
    }
  }

  return {
    window_days,
    surfaces,
    cms_content_sample: acc.last_cms_body,
    variant_performance_override,
    source: [...acc.event_types].sort().join("+"),
    signal_priority,
    trigger_hints: {
      had_cms: acc.event_types.has("cms_content_changed"),
      had_ai_usage: acc.event_types.has("ai_usage_updated"),
      had_growth:
        acc.event_types.has("variant_performance_updated") || acc.event_types.has("signup_completed"),
    },
  };
}

async function flushPosCycle(): Promise<void> {
  const acc = takeAccumulator();
  if (!acc || acc.event_types.size === 0) return;

  try {
    const ctx = await buildCycleContext(acc);
    const { runPOSCycle } = await import("@/lib/pos/orchestrator");
    await runPOSCycle(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[pos] debounced_cycle_failed", msg);
  }
}

function scheduleFlush(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPosCycle();
  }, debounceMs());
}

/**
 * Enqueue a POS domain event; {@link runPOSCycle} runs once after debounce (merged context).
 * Never throws; safe after DB commits.
 */
export function onEvent(event: PosEvent): void {
  try {
    if (!pending) pending = emptyAccumulator();
    mergeEvent(pending, event);
    scheduleFlush();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[pos] onEvent_failed", msg);
  }
}

/** @internal Tests — reset debounce state. */
export function __resetPosEventHandlerForTests(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pending = null;
}
