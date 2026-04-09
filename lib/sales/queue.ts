import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { SalesOutreachQueueItem } from "@/lib/sales/outreachQueueTypes";

export type { SalesChannel, SalesOutreachQueueItem, SalesQueueStatus, OutreachQueueItem } from "@/lib/sales/outreachQueueTypes";

function stableId(prefix: string, dealId: string, index: number): string {
  const h = createHash("sha256").update(`${prefix}|${dealId}|${index}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function buildOutreachQueue(
  leads: Array<{ id: string; company_name: string }>,
  messages: string[],
  opts?: { idempotencyPrefix?: string },
): SalesOutreachQueueItem[] {
  const prefix = opts?.idempotencyPrefix?.trim() ?? "";
  return leads.map((lead, i) => ({
    id: prefix ? stableId(prefix, lead.id, i) : randomUUID(),
    dealId: lead.id,
    company: lead.company_name,
    message: messages[i] ?? "",
    channel: "email" as const,
    email: null,
    status: "draft",
    approvedAt: null,
    sentAt: null,
    createdAt: Date.now(),
  }));
}
