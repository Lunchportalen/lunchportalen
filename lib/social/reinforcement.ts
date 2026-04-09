/**
 * Forsterkningssløyfe: klassifiser publiserte poster, foreslå skalering / demping (ingen kjøring her).
 */

import type { CalendarPost } from "@/lib/social/calendar";
import { createDecision, type Decision } from "@/lib/social/decisionEngine";
import { classifyPostInBatch } from "@/lib/social/classifier";
import { scorePostPerformance } from "@/lib/social/scoring";
import { scaleWinner, type ReinforcementProposal } from "@/lib/social/scaling";
import { suppressLoser } from "@/lib/social/suppression";

/** Sammendrag fra én autonom syklus (trygt å importere i klient). */
export type ReinforcementCycleSummary = {
  winnersCount: number;
  losersCount: number;
  winnerIds: string[];
  loserIds: string[];
  scalingProposed: number;
  suppressionProposed: number;
  scalingExecuted: number;
  suppressionExecuted: number;
};

export type ReinforcementBuildResult = {
  decisions: Decision[];
  winnersCount: number;
  losersCount: number;
  winnerIds: string[];
  loserIds: string[];
};

function firstPlannedSameProduct(posts: CalendarPost[], productId: string): string | null {
  const pid = String(productId ?? "").trim();
  if (!pid) return null;
  const planned = posts.filter((p) => p.status === "planned" && p.productId === pid);
  return planned[0]?.id ?? null;
}

/**
 * Bygger beslutninger fra forsterkningsregler. Filtrerer mot eksisterende flagg og produktkatalog.
 */
/**
 * Selvforsterkende runde — returnerer beslutningskandidater (samme som {@link buildReinforcementDecisions}).
 */
export function reinforcementCycle(
  posts: CalendarPost[],
  validProductIds: ReadonlySet<string>,
): Decision[] {
  return buildReinforcementDecisions(posts, validProductIds).decisions;
}

export function buildReinforcementDecisions(
  posts: CalendarPost[],
  validProductIds: ReadonlySet<string>,
): ReinforcementBuildResult {
  const published = posts.filter((p) => p.status === "published" && p.performance);
  if (published.length === 0) {
    return { decisions: [], winnersCount: 0, losersCount: 0, winnerIds: [], loserIds: [] };
  }

  const linearScores = published.map((p) => scorePostPerformance(p).score);
  const minL = Math.min(...linearScores);
  const maxL = Math.max(...linearScores);

  const winnerIds: string[] = [];
  const loserIds: string[] = [];
  const proposals: ReinforcementProposal[] = [];

  for (const post of published) {
    const kind = classifyPostInBatch(post, minL, maxL);
    if (kind === "winner") {
      winnerIds.push(post.id);
      if (!validProductIds.has(String(post.productId ?? "").trim())) continue;
      const boostId = firstPlannedSameProduct(posts, post.productId);
      proposals.push(...scaleWinner(post, boostId));
    } else if (kind === "loser") {
      loserIds.push(post.id);
      if (post.reinforcementDeprioritized === true) continue;
      proposals.push(...suppressLoser(post));
    }
  }

  const decisions: Decision[] = [];
  for (const pr of proposals) {
    const riskLevel = pr.type === "deprioritize" ? ("low" as const) : ("low" as const);
    const expectedImpact =
      pr.type === "boost_existing"
        ? 0.78
        : pr.type === "generate_post"
          ? 0.76
          : 0.55;
    decisions.push(
      createDecision({
        type: pr.type as Decision["type"],
        reason: pr.reason,
        confidence: pr.confidence,
        expectedImpact,
        riskLevel,
        data: pr.data,
      }),
    );
  }

  return {
    decisions,
    winnersCount: winnerIds.length,
    losersCount: loserIds.length,
    winnerIds,
    loserIds,
  };
}
