/**
 * In-process lead queue (single Node instance). Not durable across serverless cold starts — use for staging / controlled runs only.
 */

export type SdrLead = {
  company: string;
  pain: string;
  idempotencyKey?: string;
};

const queue: SdrLead[] = [];

export function addLead(lead: SdrLead) {
  const company = String(lead.company ?? "").trim().slice(0, 200);
  const pain = String(lead.pain ?? "").trim().slice(0, 800);
  queue.push({ ...lead, company, pain });
}

export function getQueue(): SdrLead[] {
  return [...queue];
}

export function clearQueue() {
  queue.length = 0;
}
