import type { TimingId } from "./dimensions";

export type LogWithTime = {
  created_at?: string | null;
};

/**
 * Typisk aktivitetstidspunkt fra historikk (gjennomsnittstime → morning/afternoon/evening).
 */
export function assignAdvancedTiming(logs: LogWithTime[]): TimingId {
  const hours: number[] = [];
  for (const l of logs) {
    const raw = l.created_at;
    if (!raw || typeof raw !== "string") continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    hours.push(d.getHours());
  }

  if (hours.length === 0) return "morning";

  const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
  if (avg < 12) return "morning";
  if (avg < 17) return "afternoon";
  return "evening";
}
