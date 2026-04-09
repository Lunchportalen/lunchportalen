import "server-only";

import type { DecisionResult } from "@/lib/ai/decisionEngine";

import type { PosAdaptiveKnobsLoaded } from "@/lib/pos/posAdaptiveKnobs";
import { rememberPosAction, posActionKey, wasPosActionRecent } from "@/lib/pos/posActionMemory";
import type { PosActionVerb, PosRoutedDecision } from "@/lib/pos/decisionRouter";
import type { ProductSurface } from "@/lib/pos/surfaceRegistry";

export type PosSignalPriority = "cms_update" | "ai_usage" | "growth";

export type PosStabilizeStats = {
  signal_priority: PosSignalPriority;
  skipped_low_confidence: number;
  suppressed_duplicate_actions: number;
  capped_inactive_surfaces: number;
  active_non_observe_surfaces: number;
  effective_min_confidence: number;
  effective_max_active_surfaces: number;
  surfaces_globally_capped: ProductSurface[];
  active_high_confidence_surfaces: ProductSurface[];
};

const CMS_ORDER: readonly ProductSurface[] = ["backoffice_editor", "public_demo"];
const AI_ORDER: readonly ProductSurface[] = ["superadmin_dashboard", "backoffice_editor", "company_admin"];
const GROWTH_ORDER: readonly ProductSurface[] = [
  "public_demo",
  "week",
  "employee",
  "superadmin_dashboard",
  "backoffice_editor",
  "onboarding",
  "company_admin",
  "kitchen",
  "driver",
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function envMinConfidence(): number {
  const raw = String(process.env.POS_MIN_CONFIDENCE ?? "").trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return 0.12;
}

function envMaxActiveSurfaces(): number {
  const raw = String(process.env.POS_MAX_ACTIVE_SURFACES ?? "").trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 32) return Math.floor(n);
  }
  return 4;
}

function surfaceRank(surface: ProductSurface, priority: PosSignalPriority): number {
  const order =
    priority === "cms_update" ? CMS_ORDER : priority === "ai_usage" ? AI_ORDER : GROWTH_ORDER;
  const i = order.indexOf(surface);
  return i === -1 ? 999 : i;
}

/** Surface ordering for merged POS context: cms_update > ai_usage > growth. */
export function orderSurfacesForPriority(surfaces: ProductSurface[], priority: PosSignalPriority): ProductSurface[] {
  return [...surfaces].sort((a, b) => {
    const ra = surfaceRank(a, priority);
    const rb = surfaceRank(b, priority);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

function toObserveDecision(d: PosRoutedDecision, suffix: string): PosRoutedDecision {
  const noActionBase: DecisionResult = {
    ...d.base_decision,
    decisionType: "no_action",
    confidence: Math.min(d.base_decision.confidence, 0.2),
    reason: `${d.base_decision.reason} ${suffix}`.trim(),
  };
  return {
    surface: d.surface,
    action: "observe_platform_health",
    confidence: 0,
    reason: `${d.reason} ${suffix}`.trim(),
    base_decision: noActionBase,
  };
}

function isNonObserve(d: PosRoutedDecision): boolean {
  return d.action !== "observe_platform_health";
}

function resolveKnobs(knobs?: PosAdaptiveKnobsLoaded): { minC: number; maxA: number; mult: Partial<Record<ProductSurface, number>> } {
  const minC = knobs?.minConfidence ?? envMinConfidence();
  const maxA = knobs?.maxActiveSurfaces ?? envMaxActiveSurfaces();
  const mult = knobs?.surfaceMultiplier ?? {};
  return {
    minC: clamp01(minC),
    maxA: Math.max(1, Math.min(32, Math.floor(maxA))),
    mult,
  };
}

/**
 * Priority-aware ordering, per-surface confidence multipliers, adaptive confidence floor,
 * duplicate action memory, and global cap on active surfaces per cycle.
 */
export function stabilizePosDecisions(
  decisions: PosRoutedDecision[],
  signal_priority: PosSignalPriority,
  knobs?: PosAdaptiveKnobsLoaded,
): { decisions: PosRoutedDecision[]; stats: PosStabilizeStats } {
  const { minC, maxA, mult } = resolveKnobs(knobs);
  const stats: PosStabilizeStats = {
    signal_priority,
    skipped_low_confidence: 0,
    suppressed_duplicate_actions: 0,
    capped_inactive_surfaces: 0,
    active_non_observe_surfaces: 0,
    effective_min_confidence: minC,
    effective_max_active_surfaces: maxA,
    surfaces_globally_capped: [],
    active_high_confidence_surfaces: [],
  };

  const effFor = (d: PosRoutedDecision): number => {
    const m = mult[d.surface] ?? 1;
    return clamp01(d.confidence * m);
  };

  const sorted = [...decisions].sort((a, b) => {
    const ra = surfaceRank(a.surface, signal_priority);
    const rb = surfaceRank(b.surface, signal_priority);
    if (ra !== rb) return ra - rb;
    return effFor(b) - effFor(a);
  });

  const out: PosRoutedDecision[] = sorted.map((d) => {
    if (!isNonObserve(d)) return d;
    const eff = effFor(d);
    if (eff < minC) {
      stats.skipped_low_confidence += 1;
      return toObserveDecision(d, "[Under POS-konfidenssterskel.]");
    }
    const key = posActionKey(d.surface, d.action, d.base_decision.decisionType);
    if (wasPosActionRecent(key)) {
      stats.suppressed_duplicate_actions += 1;
      return toObserveDecision(d, "[Duplikat-handling undertrykt — nylig identisk signal.]");
    }
    return d;
  });

  const activeIdx: number[] = [];
  for (let i = 0; i < out.length; i++) {
    if (isNonObserve(out[i]!)) activeIdx.push(i);
  }

  if (activeIdx.length > maxA) {
    const byEff = [...activeIdx].sort((i, j) => effFor(out[j]!) - effFor(out[i]!));
    const keep = new Set(byEff.slice(0, maxA));
    for (const i of activeIdx) {
      if (!keep.has(i)) {
        stats.capped_inactive_surfaces += 1;
        stats.surfaces_globally_capped.push(out[i]!.surface);
        out[i] = toObserveDecision(out[i]!, "[Global POS-tak — flate deaktivert denne syklusen.]");
      }
    }
  }

  for (const d of out) {
    if (!isNonObserve(d)) continue;
    rememberPosAction(posActionKey(d.surface, d.action, d.base_decision.decisionType));
    stats.active_non_observe_surfaces += 1;
    if (effFor(d) >= 0.24) stats.active_high_confidence_surfaces.push(d.surface);
  }

  return { decisions: out, stats };
}
