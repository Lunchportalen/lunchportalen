import { randomUUID } from "node:crypto";

export type PartnerType = "kitchen" | "supplier" | "logistics";

export type Partner = {
  id: string;
  name: string;
  type: PartnerType;
  createdAt: number;
};

export function createPartner(partner: { name: string; type: PartnerType }): Partner {
  return {
    id: randomUUID(),
    name: String(partner.name ?? "").trim() || "Partner",
    type: partner.type,
    createdAt: Date.now(),
  };
}
