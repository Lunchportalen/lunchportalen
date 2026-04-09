import "server-only";

import { randomUUID } from "node:crypto";

import { opsLog } from "@/lib/ops/log";

export type ApprovalItem = {
  id: string;
  type: "email" | "social";
  payload: unknown;
  approved: boolean;
  createdAt: number;
};

const MAX = 500;
let queue: ApprovalItem[] = [];

export function addToApproval(item: Omit<ApprovalItem, "approved" | "createdAt" | "id"> & { id?: string }): ApprovalItem {
  const id = item.id ?? randomUUID();
  const row: ApprovalItem = {
    id,
    type: item.type,
    payload: item.payload,
    approved: false,
    createdAt: Date.now(),
  };
  opsLog("approval_queued", { id: row.id, type: row.type });
  queue = [...queue, row].slice(-MAX);
  return row;
}

export function getPending(): ApprovalItem[] {
  return queue.filter((i) => !i.approved);
}

/** Kun godkjent sosialt innhold — brukt av auto-post (Scale Mode). */
export function getApprovedSocialContent(): ApprovalItem[] {
  return queue.filter((i) => i.type === "social" && i.approved);
}

export function getQueueSnapshot(): ApprovalItem[] {
  return [...queue];
}

export function approve(id: string): ApprovalItem | null {
  const idx = queue.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const item = queue[idx];
  if (!item) return null;
  const next = { ...item, approved: true };
  queue = queue.slice();
  queue[idx] = next;
  opsLog("approval_granted", { id, type: next.type });
  return next;
}

/** Tester / rollback av prosess-kø. */
export function resetApprovalQueueForTests(): void {
  queue = [];
}
