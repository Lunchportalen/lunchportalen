/**
 * Daglig sjekkliste (forslag — ingen automatiske handlinger).
 */

export type LeadLike = { status?: string | null };

export function getDailyPlaybook(leads: LeadLike[]): string[] {
  const list = Array.isArray(leads) ? leads : [];
  const tasks: string[] = [];

  const hot = list.filter((l) => String(l.status ?? "").trim() === "meeting");
  if (hot.length > 0) {
    tasks.push("Close varme leads");
  }

  const cold = list.filter((l) => String(l.status ?? "").trim() === "new");
  if (cold.length > 3) {
    tasks.push("Følg opp nye leads");
  }

  if (list.length < 5) {
    tasks.push("Generer mer trafikk");
  }

  return tasks;
}
