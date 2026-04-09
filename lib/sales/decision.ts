import "server-only";

import { scoreLead } from "@/lib/sales/score";

export type SalesNextAction = "book_meeting" | "send_followup" | "nurture";

export function decideAction(lead: unknown): SalesNextAction {
  const score = scoreLead(lead);
  if (score > 80) return "book_meeting";
  if (score > 50) return "send_followup";
  return "nurture";
}
