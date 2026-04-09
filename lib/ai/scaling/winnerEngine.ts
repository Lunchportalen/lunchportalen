import type { AttributionRoiRow } from "@/lib/ai/attribution/roiEngine";

const WINNER_ROI_THRESHOLD = 1.5;

export function detectWinners(roiList: AttributionRoiRow[]): AttributionRoiRow[] {
  return roiList.filter((r) => Number.isFinite(r.roi) && r.roi >= WINNER_ROI_THRESHOLD);
}
