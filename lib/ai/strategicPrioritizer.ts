import type { RoadmapStep } from "@/lib/ai/roadmapEngine";

/** Tie-break when weeks match: experiment → optimize → variant → pricing (manual-only). */
const ACTION_ORDER: Record<string, number> = {
  experiment: 0,
  optimize: 1,
  create_variant: 2,
  pricing_review: 3,
};

export function prioritizeRoadmap(roadmap: RoadmapStep[]): RoadmapStep[] {
  return [...roadmap].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const oa = ACTION_ORDER[a.action] ?? 99;
    const ob = ACTION_ORDER[b.action] ?? 99;
    if (oa !== ob) return oa - ob;
    return String(a.focus).localeCompare(String(b.focus));
  });
}
