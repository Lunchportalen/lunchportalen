/**
 * Kontrollert autonom syklus — policy, kvoter, duplikater, prognose-hook, full logging.
 */

import "server-only";

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { parseCalendar, rollingDayKeys } from "@/lib/social/calendar";
import {
  createDecision,
  type AutonomyAggressiveness,
  type Decision,
} from "@/lib/social/decisionEngine";
import { preventDuplicates } from "@/lib/social/guard";
import { isAllowed, policy } from "@/lib/social/policyEngine";
import { executeDecision, type AutonomousExecutionContext } from "@/lib/social/executor";
import { predictiveSummaryFromCalendar } from "@/lib/predictive/fromCalendar";
import { automationHintsFromPosts, learningFeedbackForAutomation } from "@/lib/social/learning";
import { pickBestProductForGrowth } from "@/lib/social/selection";
import {
  buildReinforcementDecisions,
  type ReinforcementCycleSummary,
} from "@/lib/social/reinforcement";
import {
  logAutonomousCycle,
  logDecisionExecuted,
  logDecisionSkipped,
} from "@/lib/social/observability";
import type { Location } from "@/lib/social/location";
import type { CalendarPost } from "@/lib/social/calendar";
import { aggregateVideoConversionForAutomation } from "@/lib/social/videoConversionSignals";
import { detectDropOff } from "@/lib/video/dropoff";

export type AutonomousCycleInput = {
  postsJson: string;
  products: SocialProductRef[];
  location: Location;
  /** Klient / operatør pause — fail-closed (ingen utførelse). */
  paused?: boolean;
  actorUserId: string | null;
  aggressiveness?: AutonomyAggressiveness;
  /** 1–10; begrenses av `policy.maxActionsPerRun` som øvre tak i standard policy. */
  maxActionsPerRunOverride?: number;
};

export type { ReinforcementCycleSummary };

export type AutonomousCycleResult = {
  decisions: Decision[];
  executed: number;
  skipped: number;
  skippedReasons: string[];
  lowConfidenceSkips: number;
  duplicateSkips: number;
  cappedSkips: number;
  predictiveSkips: number;
  riskPolicySkips: number;
  reinforcementScalingCapSkips: number;
  reinforcementSuppressionCapSkips: number;
  postsJson: string;
  lastRunAt: string;
  /** Gjennomsnittlig tillit blant utførte beslutninger (null hvis ingen). */
  systemConfidence: number | null;
  /** Høyeste risiko blant utførte (null hvis ingen). */
  aggregateRisk: Decision["riskLevel"] | null;
  reinforcement: ReinforcementCycleSummary;
};

function effectiveMaxActions(override?: number): number {
  const raw =
    typeof override === "number" && Number.isFinite(override) ? Math.floor(override) : policy.maxActionsPerRun;
  return Math.min(10, Math.max(1, raw));
}

function predictiveThreshold(ag: AutonomyAggressiveness): number {
  if (ag === "low") return Math.max(policy.minExpectedImpact, 0.45);
  if (ag === "high") return Math.min(policy.minExpectedImpact, 0.28);
  return policy.minExpectedImpact;
}

function isReinforcementScalingDecision(d: Decision): boolean {
  if (d.data.reinforcement !== true) return false;
  if (d.type === "boost_existing") return true;
  if (d.type === "generate_post" && d.data.reinforcementKind === "replicate_winner") return true;
  return false;
}

function isReinforcementSuppressionDecision(d: Decision): boolean {
  return d.data.reinforcement === true && d.type === "deprioritize";
}

function aggregateRiskFrom(executed: Decision[]): Decision["riskLevel"] | null {
  if (executed.length === 0) return null;
  const rank: Record<Decision["riskLevel"], number> = { low: 0, medium: 1, high: 2 };
  let max: Decision["riskLevel"] = "low";
  for (const d of executed) {
    if (rank[d.riskLevel] > rank[max]) max = d.riskLevel;
  }
  return max;
}

/**
 * Genererer kandidatbeslutninger (ingen sideeffekter).
 */
export function generateDecisions(input: {
  products: SocialProductRef[];
  posts: CalendarPost[];
  aggressiveness: AutonomyAggressiveness;
}): Decision[] {
  const { products, posts, aggressiveness } = input;
  const hints = automationHintsFromPosts(posts);
  const best = pickBestProductForGrowth(products, posts);
  const decisions: Decision[] = [];
  const rolling = rollingDayKeys();
  const planned = posts.filter((p) => p.status === "planned");

  if (products.length > 0 && best) {
    decisions.push(
      createDecision({
        type: "generate_post",
        reason: `Utkast for prioritert produkt (${best.id}) basert på vektsignal og historikk.`,
        confidence: 0.85,
        expectedImpact: 0.72,
        riskLevel: "low",
        data: { productId: best.id, slotDay: rolling[0] ?? "" },
      }),
    );
  }

  decisions.push(
    createDecision({
      type: "schedule_post",
      reason: hints.bestTimeSlot
        ? `Planlegg med tidsinnsikt (${hints.bestTimeSlot}).`
        : "Planlegg forfalte poster til «klar» (standard).",
      confidence: hints.bestTimeSlot ? 0.78 : 0.76,
      expectedImpact: hints.bestTimeSlot ? 0.55 : 0.48,
      riskLevel: "medium",
      data: {},
    }),
  );

  if (aggressiveness === "high") {
    decisions.push(
      createDecision({
        type: "adjust_timing",
        reason: "Finjuster vinduer basert på læring (samme planlegger, egen sporbarhet).",
        confidence: 0.76,
        expectedImpact: 0.4,
        riskLevel: "medium",
        data: { mode: "aggressive_timing" },
      }),
    );
  }

  const firstPlanned = planned[0];
  if (firstPlanned) {
    decisions.push(
      createDecision({
        type: "promote_product",
        reason: `Marker planlagt post ${firstPlanned.id} som prioritet (ikke publisering).`,
        confidence: 0.76,
        expectedImpact: 0.5,
        riskLevel: "low",
        data: { postId: firstPlanned.id },
      }),
    );
  }

  if ((aggressiveness === "medium" || aggressiveness === "high") && planned[1]) {
    decisions.push(
      createDecision({
        type: "boost_existing",
        reason: `Ekstra løft for planlagt post ${planned[1].id} (sekundær kandidat).`,
        confidence: 0.75,
        expectedImpact: 0.42,
        riskLevel: "low",
        data: { postId: planned[1].id },
      }),
    );
  }

  decisions.push(
    createDecision({
      type: "publish",
      reason: "Ekstern publisering er låst av policy — beslutning logges for sporbarhet.",
      confidence: 0.99,
      expectedImpact: 0,
      riskLevel: "high",
      data: { policyProbe: true },
    }),
  );

  const videoAgg = aggregateVideoConversionForAutomation(posts);
  if (videoAgg && videoAgg.sampleSize >= 2) {
    const diag = detectDropOff({
      hookRetention: videoAgg.hookRetention,
      completionRate: videoAgg.completionRate,
    });
    if (diag === "weak_hook") {
      decisions.push(
        createDecision({
          type: "generate_post",
          reason:
            "Video-konvertering: svak hook-retention i snitt — generer nye hook-varianter (konverteringsmotor).",
          confidence: 0.72,
          expectedImpact: 0.55,
          riskLevel: "low",
          data: {
            videoOptimization: "regenerate_hooks",
            avgHookRetentionPct: videoAgg.hookRetention,
            sampleSize: videoAgg.sampleSize,
          },
        }),
      );
    } else if (diag === "weak_story") {
      decisions.push(
        createDecision({
          type: "adjust_timing",
          reason:
            "Video-konvertering: lav fullføringsrate — stram historie / kortere midtdel (konverteringsmotor).",
          confidence: 0.68,
          expectedImpact: 0.48,
          riskLevel: "medium",
          data: {
            videoOptimization: "shorten_story",
            avgCompletionRatePct: videoAgg.completionRate,
            sampleSize: videoAgg.sampleSize,
          },
        }),
      );
    } else if (videoAgg.hookRetention >= 55 && videoAgg.completionRate >= 35) {
      decisions.push(
        createDecision({
          type: "boost_existing",
          reason:
            "Video-konvertering: sterke hook- og fullføringssignaler — skaler linjer som allerede fungerer.",
          confidence: 0.74,
          expectedImpact: 0.52,
          riskLevel: "low",
          data: {
            videoOptimization: "scale_strong_video",
            avgHookRetentionPct: videoAgg.hookRetention,
            avgCompletionRatePct: videoAgg.completionRate,
            sampleSize: videoAgg.sampleSize,
          },
        }),
      );
    }
  }

  return decisions;
}

export async function runAutonomousCycle(ctx: AutonomousCycleInput): Promise<AutonomousCycleResult> {
  const lastRunAt = new Date().toISOString();
  const skippedReasons: string[] = [];
  let lowConfidenceSkips = 0;
  let duplicateSkips = 0;
  let cappedSkips = 0;
  let predictiveSkips = 0;
  let riskPolicySkips = 0;
  let reinforcementScalingCapSkips = 0;
  let reinforcementSuppressionCapSkips = 0;
  let executed = 0;
  let skipped = 0;

  const aggressiveness: AutonomyAggressiveness = ctx.aggressiveness ?? "medium";
  const maxRun = effectiveMaxActions(ctx.maxActionsPerRunOverride);
  const impactThreshold = predictiveThreshold(aggressiveness);

  if (ctx.paused === true) {
    logAutonomousCycle(ctx.actorUserId, { event: "cycle_skipped_paused", lastRunAt });
    return {
      decisions: [],
      executed: 0,
      skipped: 0,
      skippedReasons: ["paused"],
      lowConfidenceSkips: 0,
      duplicateSkips: 0,
      cappedSkips: 0,
      predictiveSkips: 0,
      riskPolicySkips: 0,
      reinforcementScalingCapSkips: 0,
      reinforcementSuppressionCapSkips: 0,
      postsJson: ctx.postsJson,
      lastRunAt,
      systemConfidence: null,
      aggregateRisk: null,
      reinforcement: {
        winnersCount: 0,
        losersCount: 0,
        winnerIds: [],
        loserIds: [],
        scalingProposed: 0,
        suppressionProposed: 0,
        scalingExecuted: 0,
        suppressionExecuted: 0,
      },
    };
  }

  const posts = parseCalendar(ctx.postsJson);
  const productIdSet = new Set(ctx.products.map((p) => String(p.id ?? "").trim()).filter(Boolean));
  const reinforcementBuild = buildReinforcementDecisions(posts, productIdSet);
  const scalingProposed = reinforcementBuild.decisions.filter(isReinforcementScalingDecision).length;
  const suppressionProposed = reinforcementBuild.decisions.filter(isReinforcementSuppressionDecision).length;

  const rawDecisions = [
    ...reinforcementBuild.decisions,
    ...generateDecisions({
      products: ctx.products,
      posts,
      aggressiveness,
    }),
  ];

  const beforeDedupe = rawDecisions.length;
  const decisions = preventDuplicates(rawDecisions);
  duplicateSkips += beforeDedupe - decisions.length;

  let postsJson = ctx.postsJson;
  let executedThisRun = 0;
  const executedDecisions: Decision[] = [];
  let reinforcementScalingUsed = 0;
  let reinforcementSuppressionUsed = 0;
  let scalingExecuted = 0;
  let suppressionExecuted = 0;

  for (const d of decisions) {
    if (isReinforcementScalingDecision(d) && reinforcementScalingUsed >= policy.maxScalingPerRun) {
      d.skipReason = "reinforcement_scaling_cap";
      reinforcementScalingCapSkips += 1;
      skipped += 1;
      skippedReasons.push(`${d.type}:reinforcement_scaling_cap`);
      logDecisionSkipped(ctx.actorUserId, d, "reinforcement_scaling_cap");
      continue;
    }
    if (isReinforcementSuppressionDecision(d) && reinforcementSuppressionUsed >= policy.maxSuppressionPerRun) {
      d.skipReason = "reinforcement_suppression_cap";
      reinforcementSuppressionCapSkips += 1;
      skipped += 1;
      skippedReasons.push(`${d.type}:reinforcement_suppression_cap`);
      logDecisionSkipped(ctx.actorUserId, d, "reinforcement_suppression_cap");
      continue;
    }

    if (
      typeof d.expectedImpact === "number" &&
      Number.isFinite(d.expectedImpact) &&
      d.expectedImpact < impactThreshold
    ) {
      d.skipReason = "predictive_below_threshold";
      predictiveSkips += 1;
      skipped += 1;
      skippedReasons.push(`${d.type}:predictive_below_threshold`);
      logDecisionSkipped(ctx.actorUserId, d, "predictive_below_threshold");
      continue;
    }

    if (!isAllowed(d)) {
      const reason =
        d.confidence < policy.minConfidence
          ? "low_confidence"
          : d.riskLevel === "high" || d.type === "publish"
            ? "risk_or_publish_policy"
            : "policy_blocked";
      if (reason === "low_confidence") lowConfidenceSkips += 1;
      if (reason === "risk_or_publish_policy") riskPolicySkips += 1;
      d.skipReason = reason;
      skipped += 1;
      skippedReasons.push(`${d.type}:${reason}`);
      logDecisionSkipped(ctx.actorUserId, d, reason);
      continue;
    }

    if (executedThisRun >= maxRun) {
      d.skipReason = "max_actions_per_run";
      cappedSkips += 1;
      skipped += 1;
      skippedReasons.push(`${d.type}:max_actions_per_run`);
      logDecisionSkipped(ctx.actorUserId, d, "max_actions_per_run");
      continue;
    }

    d.approved = true;
    const execCtx: AutonomousExecutionContext = {
      postsJson,
      products: ctx.products,
      location: ctx.location,
    };

    try {
      const res = await executeDecision(d, execCtx);
      if (res.ok) {
        d.executed = true;
        executed += 1;
        executedThisRun += 1;
        executedDecisions.push(d);
        if (isReinforcementScalingDecision(d)) {
          reinforcementScalingUsed += 1;
          scalingExecuted += 1;
        }
        if (isReinforcementSuppressionDecision(d)) {
          reinforcementSuppressionUsed += 1;
          suppressionExecuted += 1;
        }
        if (res.postsJson) postsJson = res.postsJson;
        logDecisionExecuted(ctx.actorUserId, d, res.metadata);
      } else {
        d.skipReason = res.error ?? "execution_failed";
        skipped += 1;
        skippedReasons.push(`${d.type}:${d.skipReason}`);
        logDecisionSkipped(ctx.actorUserId, d, d.skipReason ?? "execution_failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      d.skipReason = "execution_error";
      skipped += 1;
      skippedReasons.push(`${d.type}:execution_error`);
      logDecisionSkipped(ctx.actorUserId, d, msg);
    }
  }

  const systemConfidence =
    executedDecisions.length > 0
      ? executedDecisions.reduce((a, x) => a + x.confidence, 0) / executedDecisions.length
      : null;

  logAutonomousCycle(ctx.actorUserId, {
    event: "cycle_complete",
    lastRunAt,
    executed,
    skipped,
    lowConfidenceSkips,
    duplicateSkips,
    cappedSkips,
    predictiveSkips,
    riskPolicySkips,
    reinforcementScalingCapSkips,
    reinforcementSuppressionCapSkips,
    aggressiveness,
    maxActionsPerRun: maxRun,
    systemConfidence,
    aggregateRisk: aggregateRiskFrom(executedDecisions),
    reinforcementWinners: reinforcementBuild.winnersCount,
    reinforcementLosers: reinforcementBuild.losersCount,
    reinforcementScalingExecuted: scalingExecuted,
    reinforcementSuppressionExecuted: suppressionExecuted,
    learningFeedback: learningFeedbackForAutomation(parseCalendar(postsJson)),
    predictiveCalendarHint: predictiveSummaryFromCalendar(parseCalendar(postsJson)),
  });

  return {
    decisions,
    executed,
    skipped,
    skippedReasons,
    lowConfidenceSkips,
    duplicateSkips,
    cappedSkips,
    predictiveSkips,
    riskPolicySkips,
    reinforcementScalingCapSkips,
    reinforcementSuppressionCapSkips,
    postsJson,
    lastRunAt,
    systemConfidence,
    aggregateRisk: aggregateRiskFrom(executedDecisions),
    reinforcement: {
      winnersCount: reinforcementBuild.winnersCount,
      losersCount: reinforcementBuild.losersCount,
      winnerIds: reinforcementBuild.winnerIds,
      loserIds: reinforcementBuild.loserIds,
      scalingProposed,
      suppressionProposed,
      scalingExecuted,
      suppressionExecuted,
    },
  };
}
