import type { AttributionRoiRow } from "@/lib/ai/attribution/roiEngine";

const LOSER_ROI_THRESHOLD = 0.7;

export function detectLosers(roiList: AttributionRoiRow[]): AttributionRoiRow[] {
  return roiList.filter((r) => Number.isFinite(r.roi) && r.roi < LOSER_ROI_THRESHOLD);
}
