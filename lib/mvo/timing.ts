import type { TimingId } from "./dimensions";

/**
 * Deterministisk timing-bøtte fra klokkeslett (lokal tid for `date`).
 */
export function assignTiming(date: Date = new Date()): TimingId {
  const hour = date.getHours();

  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
