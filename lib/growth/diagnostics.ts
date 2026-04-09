import type { RoiMap } from "@/lib/growth/roi";

/** Terskel (NOK) — kun heuristikk for «lav effektivitet»; kan overstyres manuelt i UI. */
export const LOW_EFFICIENCY_THRESHOLD_NOK = 100;

export type ChannelIssue = {
  channel: string;
  problem: string;
};

export function detectIssues(roiData: RoiMap): ChannelIssue[] {
  const issues: ChannelIssue[] = [];
  for (const [channel, data] of Object.entries(roiData)) {
    if (data.efficiency === 0 && data.posts > 0) {
      issues.push({ channel, problem: "Ingen omsetning knyttet til kanal (post finnes, 0 kr)." });
    }
    if (data.efficiency > 0 && data.efficiency < LOW_EFFICIENCY_THRESHOLD_NOK) {
      issues.push({
        channel,
        problem: `Lav effektivitet (under ${LOW_EFFICIENCY_THRESHOLD_NOK} kr/post) — vurder innhold eller kvalitet.`,
      });
    }
  }
  return issues;
}
