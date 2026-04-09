import "server-only";

import { makeRid } from "@/lib/http/respond";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

import { loadStrategyBoosts } from "@/lib/learning/boosts";

import { generateStrategy } from "./actions";
import { findBottlenecks } from "./bottlenecks";
import { collectSystemData } from "./collect";
import { analyzeFunnel } from "./funnel";
import { logStrategyRun } from "./log";
import { prioritize } from "./prioritize";
import { buildRoadmap } from "./roadmap";

export type StrategyRunOutput = {
  rid: string;
  funnel: ReturnType<typeof analyzeFunnel>;
  issues: ReturnType<typeof findBottlenecks>;
  roadmap: ReturnType<typeof buildRoadmap>;
  dataExplain: string;
  /** Omsetning i vindu (sum line_total på innlastede ordre). */
  totalRevenue: number;
};

export async function runStrategyEngine(opts: { windowDays: number }): Promise<
  | { ok: true; data: StrategyRunOutput }
  | { ok: false; reason: string }
> {
  if (!hasSupabaseAdminConfig()) {
    return { ok: false, reason: "no_supabase_admin" };
  }

  const rid = makeRid("strategy");
  const admin = supabaseAdmin();
  const windowDays = Math.min(90, Math.max(7, Math.floor(opts.windowDays)));

  const raw = await collectSystemData(admin, { windowDays });
  const funnel = analyzeFunnel(raw);
  const issues = findBottlenecks(funnel, raw);
  const actions = generateStrategy(issues, raw);
  const boosts = await loadStrategyBoosts(admin);
  const sorted = prioritize(actions, boosts);
  const roadmap = buildRoadmap(sorted);

  await logStrategyRun(admin, {
    rid,
    windowDays,
    issueCount: issues.length,
    roadmapCount: roadmap.length,
    dataExplain: raw.explain,
  });

  return {
    ok: true,
    data: {
      rid,
      funnel,
      issues,
      roadmap,
      dataExplain: raw.explain,
      totalRevenue: raw.totalRevenue,
    },
  };
}
