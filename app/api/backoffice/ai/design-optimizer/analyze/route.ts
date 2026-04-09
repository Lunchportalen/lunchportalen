import type { NextRequest } from "next/server";

import { applyDesignChanges } from "@/lib/ai/design/applyDesignChanges";
import { buildAnalyzeMetrics } from "@/lib/ai/design/designMetrics";
import {
  analyzeDesignSettingsOptimizer,
  extractDesignSettingsForStorage,
  mergeDesignOptimizerPatches,
} from "@/lib/ai/design/designSettingsOptimizer";
import { loadGlobalSettingsDataForEditor } from "@/lib/cms/globalSettingsAdmin";
import { mergeDesignSettingsIntoGlobalContentData } from "@/lib/cms/design/designContract";
import { getSystemIntelligence } from "@/lib/ai/intelligence";
import { prepareAiResponseForClient } from "@/lib/ai/responseSafety";
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

    const blocks = parseBlocks(o.blocks);
    const locale = o.locale === "en" ? "en" : "nb";
    const autoApply = o.autoApply === true;

    const loaded = await loadGlobalSettingsDataForEditor();
    if (loaded.ok === false) {
      return jsonErr(ctx.rid, loaded.message, 500, "SETTINGS_LOAD_FAILED");
    }

    const settingsRoot =
      o.settingsData != null && typeof o.settingsData === "object" && !Array.isArray(o.settingsData)
        ? o.settingsData
        : loaded.data;

    const analyzed = analyzeDesignSettingsOptimizer({
      blocks,
      settingsDataRoot: settingsRoot,
      locale,
      autoApplyMode: autoApply,
    });

    const combinedPatch =
      analyzed.suggestions.length > 0
        ? mergeDesignOptimizerPatches(analyzed.suggestions.map((s) => s.patch))
        : {};

    const baseForPreview =
      typeof settingsRoot === "object" && settingsRoot !== null && !Array.isArray(settingsRoot)
        ? (settingsRoot as Record<string, unknown>)
        : { ...loaded.data };

    const previewMerged =
      analyzed.suggestions.length > 0
        ? mergeDesignSettingsIntoGlobalContentData(baseForPreview, combinedPatch).designSettings
        : null;

    const beforeDesignSettings = extractDesignSettingsForStorage(baseForPreview.designSettings);

    let autoApplied = false;
    let autoApplyError: string | null = null;
    const patchNonEmpty = JSON.stringify(combinedPatch) !== "{}";
    if (autoApply && analyzed.suggestions.length > 0 && patchNonEmpty) {
      const applyRes = await applyDesignChanges({ patch: combinedPatch, action: "save" });
      if (applyRes.ok === true) {
        autoApplied = true;
      } else {
        autoApplyError = applyRes.message;
      }
    }

    const metrics = buildAnalyzeMetrics({
      issueCodes: analyzed.issues.map((i) => i.code),
      suggestionKeys: analyzed.suggestions.map((s) => s.target ?? s.id),
      beforeDesignSettings,
      autoApply,
    });

    const payload = {
      issues: analyzed.issues.map((i) => ({
        code: i.code,
        type: i.type,
        severity: i.severity,
        message: i.message,
        current: i.current,
      })),
      suggestions: analyzed.suggestions.map((s) => ({
        id: s.id,
        type: s.type,
        change: s.change,
        reason: s.reason,
        target: s.target,
        patch: s.patch,
        signals: s.signals,
      })),
      context: {
        blockCount: analyzed.context.blockCount,
        blockTypes: analyzed.context.blockTypes,
        hasHero: analyzed.context.hasHero,
        hasCta: analyzed.context.hasCta,
        hasPricing: analyzed.context.hasPricing,
        richTextCount: analyzed.context.richTextCount,
        cardsBlockCount: analyzed.context.cardsBlockCount,
        designSettings: analyzed.context.designSettings,
      },
      combinedPatch,
      previewDesignSettings: previewMerged,
      dryRun: !autoApplied,
      autoApply,
      autoApplied,
      autoApplyError,
      droppedForAuto: analyzed.droppedForAuto,
      settingsSource: loaded.source,
      message: analyzed.message,
      policy: {
        maxSuggestionsPerResponse: 3,
        note: "Apply er manuell med mindre autoApply=true (kun lav risiko etter policy).",
      },
      metrics,
    };

    const prepared = prepareAiResponseForClient(payload);
    if (!prepared.ok) {
      return jsonErr(ctx.rid, prepared.message ?? "Response rejected by safety filter.", 400, "AI_SAFETY_REJECTED");
    }

    let systemIntel: Awaited<ReturnType<typeof getSystemIntelligence>> | null = null;
    try {
      systemIntel = await getSystemIntelligence({ limit: 600, recentEventLimit: 40 });
    } catch {
      systemIntel = null;
    }

    try {
      const { error } = await supabaseAdmin().from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "design_optimizer_analyze",
          page_id: typeof o.pageId === "string" ? o.pageId : null,
          variant_id: null,
          actor_user_id: ctx.scope?.email ?? null,
          tool: "design_optimizer",
          environment: "preview",
          locale,
          metadata: {
            ...metrics,
            suggestionCount: analyzed.suggestions.length,
            issueCount: analyzed.issues.length,
            blockCount: blocks.length,
            settingsSource: loaded.source,
            autoApply,
            autoApplied,
          },
        }),
      );
      if (error) {
        const { opsLog } = await import("@/lib/ops/log");
        opsLog("ai_activity_log.insert_failed", {
          route: "design-optimizer/analyze",
          error: error.message,
        });
      }
    } catch (e) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", {
        route: "design-optimizer/analyze",
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return jsonOk(
      ctx.rid,
      {
        ...(prepared.data as Record<string, unknown>),
        ...(systemIntel
          ? {
              unifiedSignals: systemIntel.signals,
              intelligenceTrends: systemIntel.trends,
              systemIntelligence: {
                generatedAt: systemIntel.generatedAt,
                learningHistory: systemIntel.learningHistory.slice(0, 12),
              },
            }
          : {}),
      },
      200,
    );
  });
}
