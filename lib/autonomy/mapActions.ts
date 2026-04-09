import type { RoadmapItem } from "@/lib/strategy/types";

import type { MappedAutonomyAction } from "./types";

function makeId(priority: number, action: string): string {
  return `aut_${priority}_${action.replace(/[^a-z0-9_]/gi, "_").slice(0, 48)}`;
}

/**
 * Maps strategy roadmap items to bounded autonomy operations (no schema / mass delete).
 */
export function mapToActions(roadmap: RoadmapItem[]): MappedAutonomyAction[] {
  return roadmap.map((item) => {
    const base = {
      id: makeId(item.priority, item.action),
      sourceRoadmapPriority: item.priority,
      sourceAction: item.action,
      reason: item.reason,
    };

    if (item.action === "improve_sales_sequence") {
      const x: MappedAutonomyAction = {
        ...base,
        type: "adjust_sequence",
        safe: false,
        requiresApproval: true,
      };
      return x;
    }

    if (item.action === "improve_landing_page") {
      const x: MappedAutonomyAction = {
        ...base,
        type: "update_copy",
        safe: false,
        requiresApproval: true,
      };
      return x;
    }

    if (item.action === "reduce_integration_errors") {
      const x: MappedAutonomyAction = {
        ...base,
        type: "retry_jobs",
        safe: true,
        requiresApproval: false,
      };
      return x;
    }

    const x: MappedAutonomyAction = {
      ...base,
      type: "observe",
      safe: true,
      requiresApproval: false,
    };
    return x;
  });
}
