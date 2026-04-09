/**
 * In-memory site-level growth actions (simulation / planning — optional persistence later).
 */

export type SiteGrowthEvent = {
  id: string;
  ts: number;
  kind: "simulation_batch" | "score_snapshot" | "open_editor";
  pageId?: string;
  detail: string;
  scoreBefore?: number;
  scoreAfter?: number;
};

const log: SiteGrowthEvent[] = [];
let seq = 0;

function nextId(): string {
  seq += 1;
  return `sg_${seq}_${Date.now().toString(36)}`;
}

export function logSiteGrowth(entry: Omit<SiteGrowthEvent, "id" | "ts">): string {
  const id = nextId();
  log.push({ ...entry, id, ts: Date.now() });
  return id;
}

export function getSiteGrowthLog(): SiteGrowthEvent[] {
  return [...log];
}
