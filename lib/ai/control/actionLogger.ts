/**
 * Ring buffer of action log lines (in-memory).
 */

const MAX_ENTRIES = 200;

export type ActionLogEntry = {
  action: string;
  surface: string;
  status: string;
  timestamp: number;
};

const entries: ActionLogEntry[] = [];

export function logAction(entry: ActionLogEntry): void {
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
}
