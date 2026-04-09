/**
 * Lukket sløyfe: innhold → lead → ordre → læring (kun lesing + forslag + logg).
 */
import "server-only";

import { collectRevenueData } from "@/lib/revenue/collect";
import { buildRevenueModel } from "@/lib/revenue/model";
import { generateRevenueActions } from "@/lib/revenue/actions";
import { findLosers } from "@/lib/revenue/losers";
import { findWinners } from "@/lib/revenue/winners";
import type { RevenuePostModel } from "@/lib/revenue/model";
import { optimizeStrategy, type OptimizedRevenueAction } from "@/lib/revenue/optimize";
import { logRevenueAutopilotRun } from "@/lib/revenue/revenueAutopilotLog";

export type RunRevenueAutopilotResult = {
  ok: boolean;
  posts: number;
  orders: number;
  leads: number;
  winners: number;
  losers: number;
  actions: OptimizedRevenueAction[];
  topRevenueSum: number;
  topPerformingPosts: RevenuePostModel[];
  worstPerformingPosts: RevenuePostModel[];
  error?: string;
};

export async function runRevenueAutopilot(rid: string, opts?: { skipLog?: boolean }): Promise<RunRevenueAutopilotResult> {
  const skipLog = opts?.skipLog === true;
  try {
    const data = await collectRevenueData();
    const posts = data.posts.length;
    const orders = data.orders.length;
    const leads = data.leads.length;

    if (posts === 0) {
      if (!skipLog) {
        await logRevenueAutopilotRun(rid, { winners: 0, losers: 0, actions: 0, topRevenueSum: 0 });
      }
      return {
        ok: true,
        posts: 0,
        orders,
        leads,
        winners: 0,
        losers: 0,
        actions: [],
        topRevenueSum: 0,
        topPerformingPosts: [],
        worstPerformingPosts: [],
      };
    }

    const model = buildRevenueModel(data);
    const w = findWinners(model);
    const l = findLosers(model);

    const topRevenueSum = w.slice(0, 3).reduce((s, x) => s + x.revenue, 0);
    const topPerformingPosts = w.slice(0, 8);
    const worstPerformingPosts = l.slice(0, 8);

    const rawActions = generateRevenueActions(w, l);
    const actions = optimizeStrategy(rawActions);

    if (!skipLog) {
      await logRevenueAutopilotRun(rid, {
        winners: w.length,
        losers: l.length,
        actions: actions.length,
        topRevenueSum,
      });
    }

    return {
      ok: true,
      posts,
      orders,
      leads,
      winners: w.length,
      losers: l.length,
      actions,
      topRevenueSum,
      topPerformingPosts,
      worstPerformingPosts,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[runRevenueAutopilot]", msg);
    return {
      ok: false,
      posts: 0,
      orders: 0,
      leads: 0,
      winners: 0,
      losers: 0,
      actions: [],
      topRevenueSum: 0,
      topPerformingPosts: [],
      worstPerformingPosts: [],
      error: msg,
    };
  }
}
