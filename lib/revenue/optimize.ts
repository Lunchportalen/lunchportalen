import type { RevenueAction } from "@/lib/revenue/actions";

export type OptimizedRevenueAction = RevenueAction & { priority: number };

export function optimizeStrategy(actions: RevenueAction[]): OptimizedRevenueAction[] {
  const list = Array.isArray(actions) ? actions : [];
  return list.map((a) => {
    if (a.type === "scale_content") {
      return { ...a, priority: 1 };
    }
    if (a.type === "fix_content") {
      return { ...a, priority: 2 };
    }
    return { ...a, priority: 3 };
  });
}
