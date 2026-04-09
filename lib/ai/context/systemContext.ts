import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

/**
 * Shared snapshot for all autonomy agents (deterministic DB reads — no LLM).
 * Used by CEO / CMO / CTO / COO agent runners and the merged decision engine.
 */
export type SystemContext = {
  rid: string;
  collectedAt: string;
  analytics: {
    events24h: number;
    pageViews24h: number;
    ctaClicks24h: number;
  };
  cms: { draftPages: number };
  experiments: { running: number };
  aiScores: { contentHealthHint: number | null };
  errors: { recentCount24h: number };
  health: { status: "ok" | "degraded" | "unknown"; detail: string };
};

function isoSinceHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function loadSystemContext(rid: string): Promise<SystemContext> {
  const since = isoSinceHoursAgo(24);
  const empty: SystemContext = {
    rid,
    collectedAt: new Date().toISOString(),
    analytics: { events24h: 0, pageViews24h: 0, ctaClicks24h: 0 },
    cms: { draftPages: 0 },
    experiments: { running: 0 },
    aiScores: { contentHealthHint: null },
    errors: { recentCount24h: 0 },
    health: { status: "unknown", detail: "snapshot_unavailable" },
  };

  const sb = supabaseAdmin();
  try {
    const { count: evCount } = await sb
      .from("content_analytics_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    const { count: pvCount } = await sb
      .from("content_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "page_view")
      .gte("created_at", since);
    const { count: ctaCount } = await sb
      .from("content_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "cta_click")
      .gte("created_at", since);
    const { count: expCount } = await sb
      .from("experiments")
      .select("id", { count: "exact", head: true })
      .eq("status", "running");
    const { count: draftCount } = await sb
      .from("content_pages")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft");

    const pv = pvCount ?? 0;
    const cta = ctaCount ?? 0;
    const ctrHint = pv > 0 ? cta / pv : null;
    const healthHint =
      ctrHint == null ? null : ctrHint < 0.01 ? 0.55 : ctrHint < 0.03 ? 0.72 : 0.88;

    return {
      rid,
      collectedAt: new Date().toISOString(),
      analytics: {
        events24h: evCount ?? 0,
        pageViews24h: pv,
        ctaClicks24h: cta,
      },
      cms: { draftPages: draftCount ?? 0 },
      experiments: { running: expCount ?? 0 },
      aiScores: { contentHealthHint: healthHint },
      errors: { recentCount24h: 0 },
      health: { status: "ok", detail: "deterministic_snapshot" },
    };
  } catch (e) {
    opsLog("autonomy.system_context_failed", { rid, message: e instanceof Error ? e.message : String(e) });
    return { ...empty, health: { status: "degraded", detail: "load_failed" } };
  }
}
