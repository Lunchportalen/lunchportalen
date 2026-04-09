/**
 * Deterministisk lead-prioritering (forklarbar score — ingen auto-handling).
 */

export type PrioritizedLead<T extends Record<string, unknown>> = T & { priority: number };

export function prioritizeLeads<T extends Record<string, unknown>>(leads: T[]): PrioritizedLead<T>[] {
  const list = Array.isArray(leads) ? leads : [];
  const withP = list.map((l) => {
    const status = String(l.status ?? "");
    const ve = Number(l.value_estimate ?? 0) || 0;
    const priority =
      (status === "meeting" ? 100 : 0) + (status === "contacted" ? 50 : 0) + ve;
    return { ...l, priority };
  });
  return withP.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}
