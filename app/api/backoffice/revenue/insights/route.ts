import type { NextRequest } from "next/server";

import { getSystemIntelligence, logEvent } from "@/lib/ai/intelligence";
import { IntelligenceSchemaValidationError } from "@/lib/ai/schema/errors";
import { loadPageRevenueEvents } from "@/lib/analytics/loadPageRevenueEvents";
import { aggregateBlockAttribution } from "@/lib/analytics/attribution";
import { analyzePerformance } from "@/lib/ai/revenue/analyzePerformance";
import { buildRevenueApplyPlan } from "@/lib/ai/revenue/applyRevenueActions";
import { decideRevenueActions } from "@/lib/ai/revenue/decisionEngine";
import {
  capRevenueActions,
  DEFAULT_REVENUE_CONFIG,
  filterActionsForAutoOptimize,
  type RevenueOptimizationConfig,
} from "@/lib/ai/revenue/policy";
import { parseDesignSettingsFromSettingsData } from "@/lib/cms/design/designContract";
import { loadGlobalSettingsDataForEditor } from "@/lib/cms/globalSettingsAdmin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseBlocks(raw: unknown): Array<{ id: string; type: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.id === "string" && typeof b.type === "string")
    .map((b) => ({ id: String(b.id), type: String(b.type) }));
}

export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;
    const ctx = gate.ctx;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
    }
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

    const pageId = typeof o.pageId === "string" ? o.pageId.trim() : "";
    if (!pageId) return jsonErr(ctx.rid, "Missing pageId.", 422, "MISSING_PAGE_ID");

    const blocks = parseBlocks(o.blocks);
    const hoursBack = typeof o.hoursBack === "number" && o.hoursBack > 0 ? Math.min(o.hoursBack, 720) : 168;
    const config: RevenueOptimizationConfig = {
      autoOptimize:
        o.autoOptimize === true ? true : o.autoOptimize === false ? false : DEFAULT_REVENUE_CONFIG.autoOptimize,
    };

    const loaded = await loadGlobalSettingsDataForEditor();
    const designSettings =
      loaded.ok === true ? parseDesignSettingsFromSettingsData(loaded.data) : parseDesignSettingsFromSettingsData({});

    const ev = await loadPageRevenueEvents(pageId, hoursBack);
    if (ev.ok === false) {
      return jsonErr(ctx.rid, ev.message, 500, "EVENTS_LOAD_FAILED");
    }

    const perf = analyzePerformance({
      events: ev.events,
      blocks,
      designSettings,
    });

    const rawActions = decideRevenueActions(perf.weakPoints);
    let actions = capRevenueActions(rawActions, 2);
    if (config.autoOptimize) {
      actions = filterActionsForAutoOptimize(actions);
      actions = capRevenueActions(actions, 2);
    }

    const applyPlan = buildRevenueApplyPlan(actions);
    const { byBlock, pageTotals } = aggregateBlockAttribution(ev.events);
    const best = byBlock.slice(0, 5);
    const worst = byBlock.length > 0 ? [...byBlock].reverse().slice(0, 5) : [];

    const ctaWp = perf.weakPoints.find(
      (w) =>
        w.blockId &&
        /cta|CTR|conversion|klikk|click/i.test(`${w.issue} ${w.evidence}`),
    );
    try {
      const logRes = await logEvent({
        type: "analytics",
        source: "revenue_insights_api",
        payload: {
          kind: "revenue_insights",
          pageId,
          sampleOk: perf.sampleOk,
          pageCtr: perf.pageCtr,
          topWeakIssues: perf.weakPoints.slice(0, 6).map((w) => w.issue),
          ctaFocus:
            ctaWp?.blockId != null
              ? `block:${ctaWp.blockId}:${ctaWp.issue}`
              : perf.pageCtr != null && perf.pageCtr < 0.012
                ? "low_page_ctr"
                : null,
          strongestCtaBlockId: ctaWp?.blockId ?? null,
        },
        page_id: pageId,
        company_id: null,
        source_rid: ctx.rid,
      });
      if (logRes.ok === false) {
        return jsonErr(ctx.rid, logRes.error, 500, "INTELLIGENCE_APPEND_FAILED");
      }
    } catch (e) {
      if (e instanceof IntelligenceSchemaValidationError) {
        return jsonErr(ctx.rid, e.message, 400, "INTELLIGENCE_VALIDATION_FAILED");
      }
      throw e;
    }

    const payload = {
      config,
      sampleOk: perf.sampleOk,
      sampleReason: perf.sampleReason,
      pageMetrics: {
        views: perf.pageViews,
        ctaClicks: perf.pageCta,
        conversions: perf.pageConversions,
        ctr: perf.pageCtr,
        avgScrollPct: perf.avgPageScrollPct,
      },
      blocksBest: best,
      blocksWorst: worst,
      pageTotals,
      weakPoints: perf.weakPoints,
      actions,
      applyPlan,
      dryRun: true,
      message:
        perf.sampleOk
          ? "Innsikt basert på faktiske hendelser. Utførelse skjer kun etter eksplisitt apply (eller autoOptimize med trygge designgrep)."
          : (perf.sampleReason ?? "Utilstrekkelig data."),
    };

    try {
      await supabaseAdmin().from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "revenue_insights_analyze",
          page_id: pageId,
          variant_id: null,
          actor_user_id: ctx.scope?.email ?? null,
          tool: "revenue_optimization",
          environment: "preview",
          locale: "nb",
          metadata: {
            weakPointCount: perf.weakPoints.length,
            actionCount: actions.length,
            sampleOk: perf.sampleOk,
            autoOptimize: config.autoOptimize,
          },
        }),
      );
    } catch {
      /* best-effort log */
    }

    let systemIntel: Awaited<ReturnType<typeof getSystemIntelligence>> | null = null;
    try {
      systemIntel = await getSystemIntelligence({ limit: 700, recentEventLimit: 35 });
    } catch {
      systemIntel = null;
    }

    return jsonOk(
      ctx.rid,
      {
        ...payload,
        systemIntelligence: systemIntel
          ? {
              signals: systemIntel.signals,
              trends: systemIntel.trends,
              generatedAt: systemIntel.generatedAt,
            }
          : null,
      },
      200,
    );
  });
}
