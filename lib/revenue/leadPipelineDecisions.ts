/**
 * Forslag til oppfølging (ingen auto-close, ingen prisendring).
 */

export type PipelineRevenueAction = {
  type: "follow_up" | "close" | string;
  message: string;
};

export function getPipelineRevenueActions(leads: Array<{ status?: string | null }>): PipelineRevenueAction[] {
  const list = Array.isArray(leads) ? leads : [];
  const sorted = [...list].sort((a, b) => String(a.status ?? "").localeCompare(String(b.status ?? "")));
  const actions: PipelineRevenueAction[] = [];

  const cold = sorted.filter((l) => String(l.status ?? "").trim() === "new");
  if (cold.length > 3) {
    actions.push({
      type: "follow_up",
      message: "Du har mange leads uten oppfølging",
    });
  }

  const meetings = sorted.filter((l) => String(l.status ?? "").trim() === "meeting");
  if (meetings.length > 0) {
    actions.push({
      type: "close",
      message: "Du har leads klare for closing",
    });
  }

  return actions;
}
