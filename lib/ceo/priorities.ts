export type CeoPriorityInput = {
  revenue?: number;
  leads?: number;
  actions?: unknown[];
  forecast?: number;
};

/** Deterministiske prioriteringsforslag (ingen auto-utførelse). */
export function getTopPriorities(data: CeoPriorityInput): string[] {
  const priorities: string[] = [];
  const revenue = typeof data.revenue === "number" ? data.revenue : 0;
  const leads = typeof data.leads === "number" ? data.leads : 0;
  const actionCount = Array.isArray(data.actions) ? data.actions.length : 0;

  if (revenue < 10000) {
    priorities.push("Øk lead-generering");
  }
  if (leads < 5) {
    priorities.push("Få flere leads");
  }
  if (actionCount > 5) {
    priorities.push("For mange åpne oppgaver – fokusér");
  }
  return priorities;
}
