// lib/billing/period.ts
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";

export function defaultInvoiceWindowISO() {
  const today = osloTodayISODate(); // YYYY-MM-DD
  const to = today; // ekskluder i dag
  const from = addDaysISO(today, -14);
  return { from, to };
}

export function isIsoDate(v: any) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
