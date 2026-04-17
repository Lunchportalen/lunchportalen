/** Ren presentasjonsgruppering av egne ordrehistorikk-rader per Oslo-uke (mandag-start). Ingen ny ordre-sannhet. */
import { startOfWeekISO } from "@/lib/date/oslo";
import type { EmployeeOwnLunchHistoryItem } from "@/lib/employee/employeeOwnLunchHistoryTypes";

export type EmployeePastLunchWeekGroup = {
  weekStartIso: string;
  items: EmployeeOwnLunchHistoryItem[];
};

/**
 * Forutsetter at `items` allerede er sortert (typisk leveringsdato synkende).
 * Bevarer rekkefølge: nyeste uke først, deretter eldre uker.
 */
export function groupEmployeePastLunchByWeekDescending(
  items: EmployeeOwnLunchHistoryItem[],
): EmployeePastLunchWeekGroup[] {
  const groups: EmployeePastLunchWeekGroup[] = [];
  let currentWeek: string | null = null;

  for (const it of items) {
    const wk = startOfWeekISO(it.delivery_date_iso);
    if (wk !== currentWeek) {
      currentWeek = wk;
      groups.push({ weekStartIso: wk, items: [it] });
    } else {
      const last = groups[groups.length - 1];
      if (last) last.items.push(it);
    }
  }

  return groups;
}
