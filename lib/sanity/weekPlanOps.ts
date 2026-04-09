// STATUS: KEEP

// lib/sanity/weekPlanOps.ts
import { requireSanityWrite } from "./client";

export type WeekPlanStatus = "draft" | "open" | "current" | "archived";

export async function setWeekPlanStatusByWeekKey(weekKey: string, status: WeekPlanStatus, patch: any = {}) {
  const sanityWrite = requireSanityWrite();
  const doc = await sanityWrite.fetch(
    `*[_type=="weekPlan" && weekKey==$weekKey][0]{_id, status, locked}`,
    { weekKey }
  );
  if (!doc?._id) return { ok: false, error: "not_found", weekKey };

  // idempotent: if already in status, no-op
  if (doc.status === status) return { ok: true, noop: true, weekKey, status };

  await sanityWrite
    .patch(doc._id)
    .set({ status, ...patch })
    .commit({ autoGenerateArrayKeys: true });

  return { ok: true, weekKey, status };
}
