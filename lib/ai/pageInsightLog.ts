/**
 * In-memory log for editor page insights (client-safe; no server-only imports).
 */

export type FeedbackResult = "positive" | "neutral" | "negative" | "pending";

export type PageInsightFeedback = {
  id: string;
  pageId: string;
  action: string;
  result: FeedbackResult;
  ts: number;
};

export type AiActionLogEntry = {
  id: string;
  pageId: string;
  action: string;
  source: "manual_apply" | "auto_safe" | "undo";
  ts: number;
};

const feedbackLog: PageInsightFeedback[] = [];
const aiActionLog: AiActionLogEntry[] = [];

let feedbackSeq = 0;
let actionSeq = 0;

function nextFeedbackId(): string {
  feedbackSeq += 1;
  return `fb_${feedbackSeq}_${Date.now().toString(36)}`;
}

function nextActionId(): string {
  actionSeq += 1;
  return `ai_${actionSeq}_${Date.now().toString(36)}`;
}

export function logFeedback(entry: Omit<PageInsightFeedback, "id" | "ts"> & { id?: string; ts?: number }): string {
  const id = entry.id ?? nextFeedbackId();
  const row: PageInsightFeedback = {
    id,
    pageId: entry.pageId,
    action: entry.action,
    result: entry.result,
    ts: entry.ts ?? Date.now(),
  };
  feedbackLog.push(row);
  return id;
}

export function updateFeedbackResult(feedbackId: string, result: Exclude<FeedbackResult, "pending">): boolean {
  const row = feedbackLog.find((f) => f.id === feedbackId);
  if (!row) return false;
  row.result = result;
  return true;
}

export function getInsights(): PageInsightFeedback[] {
  return [...feedbackLog];
}

export function logAiAction(entry: Omit<AiActionLogEntry, "id" | "ts">): string {
  const id = nextActionId();
  aiActionLog.push({ ...entry, id, ts: Date.now() });
  return id;
}

export function getAiActionLog(): AiActionLogEntry[] {
  return [...aiActionLog];
}
