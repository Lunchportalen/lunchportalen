import { randomUUID } from "node:crypto";

export type GtmDeal = {
  id: string;
  leadId: string;
  stage: "new" | "contacted" | "meeting" | "proposal" | "closed";
  value: number;
  createdAt: number;
};

export type GtmLeadRef = { id?: string };

export function createDeal(lead: GtmLeadRef): GtmDeal {
  return {
    id: randomUUID(),
    leadId: String(lead.id ?? "").trim() || "unknown",
    stage: "new",
    value: 0,
    createdAt: Date.now(),
  };
}
