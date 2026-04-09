import type { OutboundObjectionSnapshot } from "@/lib/outbound/objectionMetrics";
import { getOutboundObjectionSnapshot } from "@/lib/outbound/objectionMetrics";
import { aggregateOutboundReplySignals } from "@/lib/outbound/replies";

export type OutboundGrowthAugment = {
  outboundIndustriesByReply: string[];
  outboundRolesByReply: string[];
  outboundMessageTypesByReply: string[];
  /** 0–100: andel analyser med kantine-innvending */
  outboundCanteenSharePct: number;
  /** 0–100: andel av kantine-treff med loggført catering-interesse */
  outboundCateringAfterCanteenPct: number;
  /** Pivot bekreftet per innvendings-id (forklarbar telling) */
  outboundPivotByObjection: Record<string, number>;
  /**
   * Rangert læring: innvending → antall pivot, pluss samlet catering per pivot der data finnes.
   */
  bestObjectionPivot: string[];
};

function bestObjectionPivotLines(snap: OutboundObjectionSnapshot | null): string[] {
  if (!snap) return [];
  const piv = Object.entries(snap.pivotByObjectionId).sort((a, b) => b[1] - a[1]);
  const out = piv.map(([id, n]) => `${id}:${n}`);
  if (snap.pivotAppliedCount > 0 && snap.cateringConversions > 0) {
    const r = snap.cateringConversions / snap.pivotAppliedCount;
    out.push(`catering_wins_per_pivot:${r.toFixed(3)}`);
  }
  return out;
}

export function mergeOutboundLearningSlice(): OutboundGrowthAugment {
  const snap = typeof window !== "undefined" ? getOutboundObjectionSnapshot() : null;
  const base = aggregateOutboundReplySignals();
  return {
    ...base,
    outboundCanteenSharePct: snap?.pctCanteenOfAnalyses ?? 0,
    outboundCateringAfterCanteenPct: snap?.pctCateringOfCanteen ?? 0,
    outboundPivotByObjection: snap?.pivotByObjectionId ? { ...snap.pivotByObjectionId } : {},
    bestObjectionPivot: bestObjectionPivotLines(snap),
  };
}
