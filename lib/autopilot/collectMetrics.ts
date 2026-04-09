import "server-only";

import type { AutopilotMetrics } from "@/lib/autopilot/types";
import { collectRevenueData } from "@/lib/revenue/collect";

export type CollectMetricsResult = { ok: true; metrics: AutopilotMetrics } | { ok: false; error: string };

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function viewsFromPostContent(content: unknown): number {
  if (!content || typeof content !== "object" || Array.isArray(content)) return 1;
  const m = (content as Record<string, unknown>).metrics;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const v = (m as Record<string, unknown>).views;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.max(1, v);
  }
  return 1;
}

/**
 * Real metrics from orders + social posts (sessions proxy = sum of views).
 */
export async function collectAutopilotMetrics(): Promise<CollectMetricsResult> {
  try {
    const data = await collectRevenueData();
    const posts = data.posts.length;
    const orders = data.orders.length;
    const leads = data.leads.length;
    let sessions = 0;
    let revenue = 0;

    for (const p of data.posts) {
      if (!p || typeof p !== "object") continue;
      sessions += viewsFromPostContent((p as Record<string, unknown>).content);
    }

    for (const o of data.orders) {
      if (!o || typeof o !== "object") continue;
      revenue += num((o as Record<string, unknown>).line_total);
    }

    const conversionRate = orders / Math.max(sessions, 1);
    const bounceRate = Math.min(1, Math.max(0, 1 - Math.min(1, orders / Math.max(sessions * 0.002, 1))));

    return {
      ok: true,
      metrics: {
        schemaVersion: 1,
        posts,
        orders,
        leads,
        sessions: Math.max(sessions, posts || 1),
        revenue,
        conversionRate,
        bounceRate,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
