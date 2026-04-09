import { ATTRIBUTION_CONFIDENCE_THRESHOLD, scoreAttribution } from "@/lib/revenue/confidence";
import type { RevenueEvent } from "@/lib/revenue/unified";

export function filterReliableEvents(events: RevenueEvent[]): RevenueEvent[] {
  const list = Array.isArray(events) ? events : [];
  return list.filter((e) => scoreAttribution(e) > ATTRIBUTION_CONFIDENCE_THRESHOLD);
}
