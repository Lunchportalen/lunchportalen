/**
 * Performance-basert budsjett-forskyvning mellom markeder — trygt begrenset (10–40 % per marked, total 100 %).
 * Logger før/etter/årsak via {@link logAutopilot}. Endrer ikke kanal-budsjetter (kun markedsandeler).
 */
import "server-only";

import { logAutopilot } from "@/lib/autopilot/log";
import {
  BUDGET_MAX_SHARE,
  BUDGET_MIN_SHARE,
  allocateBudget,
  commitBudgetSnapshot,
  computeMarketBudgetScore,
  getLastBudgetSnapshot,
} from "@/lib/scale/budget";
import { DEFAULT_MARKETS, getMarketPerformance, type Market } from "@/lib/scale/markets";
import { loadTrackedChannels, pickBestChannel, type ScaleChannelId } from "@/lib/scale/channels";

const SHIFT_MIN = 0.1;
const SHIFT_MAX = 0.2;

function makeRid(): string {
  return `realloc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function clampShiftPct(raw: number | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 0.15;
  return Math.min(SHIFT_MAX, Math.max(SHIFT_MIN, raw));
}

/**
 * Leser standard skifte (10–20 % av total pott): `LP_REALLOCATE_SHIFT_PCT` (0.10–0.20), ellers 0.15.
 */
export function readDefaultShiftPctFromEnv(): number {
  const s = String(process.env.LP_REALLOCATE_SHIFT_PCT ?? "").trim();
  if (!s) return 0.15;
  const n = Number(s);
  return clampShiftPct(n);
}

export type ReallocateByPerformanceResult =
  | {
      ok: true;
      rid: string;
      bestMarketId: string;
      worstMarketId: string;
      bestChannelId: ScaleChannelId | null;
      shiftPct: number;
      /** Faktisk flyttet andel av total pott (kan være 0 ved bindinger). */
      transferAmount: number;
      before: Record<string, number>;
      after: Record<string, number>;
      reason: string;
    }
  | { ok: false; error: string };

/**
 * 1) Finner beste/svakeste marked (score som {@link computeMarketBudgetScore}) og beste kanal ({@link pickBestChannel}).
 * 2) Forskyver 10–20 % av pott fra svakeste → beste marked (respekterer gulv/tak per marked).
 * 3) Logger før/etter/årsak.
 */
export async function reallocateByPerformance(opts?: {
  shiftPct?: number;
  rid?: string;
}): Promise<ReallocateByPerformanceResult> {
  const rid = opts?.rid ?? makeRid();
  const shiftPct = clampShiftPct(opts?.shiftPct ?? readDefaultShiftPctFromEnv());

  const marketIds = DEFAULT_MARKETS.map((m) => m.id);
  const perfResults = await Promise.all(marketIds.map((id) => getMarketPerformance(id)));

  const marketsForScore: { id: string; performance: Market["performance"] }[] = [];
  for (let i = 0; i < marketIds.length; i++) {
    const id = marketIds[i]!;
    const r = perfResults[i]!;
    if (r.ok === false) {
      return { ok: false, error: `market_perf:${id}:${r.error}` };
    }
    marketsForScore.push({ id, performance: r.performance });
  }

  const scores: Record<string, number> = {};
  for (const m of marketsForScore) {
    scores[m.id] = computeMarketBudgetScore(m.performance);
  }

  const sorted = [...marketIds].sort((a, b) => {
    const d = scores[b]! - scores[a]!;
    if (d !== 0) return d;
    return a.localeCompare(b);
  });
  const bestMarketId = sorted[0]!;
  const worstMarketId = sorted[sorted.length - 1]!;

  const ch = await loadTrackedChannels();
  const bestChannelId = ch.ok === true ? pickBestChannel(ch.channels).best : null;

  let before: Record<string, number>;
  const snap = getLastBudgetSnapshot();
  if (snap && marketIds.every((id) => typeof snap[id] === "number")) {
    before = { ...snap };
  } else {
    const alloc = allocateBudget(marketsForScore);
    if (alloc.ok === false) {
      return { ok: false, error: alloc.error };
    }
    before = { ...alloc.budgetPerMarket };
  }

  let transferAmount = shiftPct;
  const maxFromWorst = Math.max(0, before[worstMarketId]! - BUDGET_MIN_SHARE);
  const maxToBest = Math.max(0, BUDGET_MAX_SHARE - before[bestMarketId]!);
  transferAmount = Math.min(transferAmount, maxFromWorst, maxToBest);

  const after: Record<string, number> = { ...before };
  if (bestMarketId !== worstMarketId && transferAmount > 1e-9) {
    after[worstMarketId] = before[worstMarketId]! - transferAmount;
    after[bestMarketId] = before[bestMarketId]! + transferAmount;
  }

  const sumAfter = marketIds.reduce((a, id) => a + after[id]!, 0);
  if (Math.abs(sumAfter - 1) > 1e-5) {
    for (const id of marketIds) after[id] = after[id]! / sumAfter;
  }

  const committed = commitBudgetSnapshot(after);
  if (committed.ok === false) {
    return { ok: false, error: committed.error };
  }

  const reason =
    `Vinner-marked: ${bestMarketId} (score ${scores[bestMarketId]!.toFixed(4)}). ` +
    `Svakeste: ${worstMarketId} (score ${scores[worstMarketId]!.toFixed(4)}). ` +
    `Vinner-kanal: ${bestChannelId ?? "ingen (ingen sporet effekt)"}. ` +
    `Forskyvning: inntil ${(shiftPct * 100).toFixed(1)} % av pott; faktisk flyttet ${(transferAmount * 100).toFixed(2)} pp ` +
    `(${worstMarketId} → ${bestMarketId}). ` +
    `Bindinger: min ${(BUDGET_MIN_SHARE * 100).toFixed(0)} % / maks ${(BUDGET_MAX_SHARE * 100).toFixed(0)} % per marked.`;

  await logAutopilot({
    kind: "scale_reallocate",
    rid,
    payload: {
      before,
      after,
      reason,
      bestMarketId,
      worstMarketId,
      bestChannelId,
      shiftPctRequested: shiftPct,
      transferAmount,
      marketScores: scores,
    },
  });

  return {
    ok: true,
    rid,
    bestMarketId,
    worstMarketId,
    bestChannelId,
    shiftPct,
    transferAmount,
    before,
    after,
    reason,
  };
}
