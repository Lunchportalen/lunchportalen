import type { NextRequest } from "next/server";

import { applyDesignChanges } from "@/lib/ai/design/applyDesignChanges";
import { buildApplyMetrics } from "@/lib/ai/design/designMetrics";
import {
  assertMaxPatchKeys,
  assertNoRapidToggle,
  DESIGN_POLICY_MAX_CHANGES_PER_RUN,
  designPatchAffectedKeys,
} from "@/lib/ai/design/designPolicy";
import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";
import {
  mergeDesignOptimizerPatches,
  sanitizeDesignSettingsPatch,
} from "@/lib/ai/design/designSettingsOptimizer";
import { fetchLastDesignOptimizerApply } from "@/lib/ai/design/lastDesignApply";
import { getSystemIntelligence, logEvent, recordLearningOutcome } from "@/lib/ai/intelligence";
import { IntelligenceSchemaValidationError } from "@/lib/ai/schema/errors";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { recordSuggestionApplied } from "@/lib/ai/memory/recordOutcome";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
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

    const action = o.action === "publish" ? "publish" : "save";
    const autoApply = o.autoApply === true;
    const suggestionIds = Array.isArray(o.suggestionIds)
      ? o.suggestionIds.filter((x): x is string => typeof x === "string" && x.trim() !== "")
      : null;

    let patchRaw: unknown = o.patch;
    if (suggestionIds != null && suggestionIds.length > 0) {
      const patches = o.patches;
      if (!isPlainObject(patches)) {
        return jsonErr(ctx.rid, "When suggestionIds is set, patches map is required.", 422, "MISSING_PATCHES");
      }
      const merged: DesignSettingsDocument[] = [];
      for (const id of suggestionIds) {
        const sanitized = sanitizeDesignSettingsPatch(patches[id]);
        if (sanitized) merged.push(sanitized);
      }
      if (merged.length === 0) {
        return jsonErr(ctx.rid, "No valid patches for given suggestionIds.", 422, "INVALID_PATCHES");
      }
      patchRaw = mergeDesignOptimizerPatches(merged);
    }

    const patch = sanitizeDesignSettingsPatch(patchRaw);
    if (!patch) {
      return jsonErr(ctx.rid, "Missing or invalid design patch.", 422, "INVALID_PATCH");
    }

    const maxCheck = assertMaxPatchKeys(patch, DESIGN_POLICY_MAX_CHANGES_PER_RUN);
    if (maxCheck.ok === false) {
      return jsonErr(ctx.rid, maxCheck.message, 422, "POLICY_MAX_CHANGES");
    }

    const lastApply = await fetchLastDesignOptimizerApply();
    const affectedKeys = designPatchAffectedKeys(patch);
    const toggle = assertNoRapidToggle(affectedKeys, lastApply);
    if (toggle.ok === false) {
      return jsonErr(ctx.rid, toggle.message, 422, "POLICY_RAPID_TOGGLE");
    }

    const applyRes = await applyDesignChanges({ patch, action });
    if (applyRes.ok === false) {
      return jsonErr(ctx.rid, applyRes.message, 500, "APPLY_FAILED");
    }

    const metrics = buildApplyMetrics({
      suggestionKeys: affectedKeys,
      beforeDesignSettings: applyRes.revertDesignSettings,
      afterDesignSettings: applyRes.afterDesignSettings,
      appliedPatch: patch,
      autoApply,
    });

    try {
      const supabase = supabaseAdmin();
      await supabase.from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "design_optimizer_apply",
          page_id: typeof o.pageId === "string" ? o.pageId : null,
          variant_id: null,
          actor_user_id: ctx.scope?.email ?? null,
          tool: "design_optimizer",
          environment: action === "publish" ? "prod" : "preview",
          locale: o.locale === "en" ? "en" : "nb",
          metadata: {
            action,
            suggestionIds: suggestionIds ?? undefined,
            revertDesignSettings: applyRes.revertDesignSettings,
            afterDesignSettings: applyRes.afterDesignSettings,
            appliedPatch: patch,
            metrics,
            autoApply,
          },
        }),
      );
      await recordSuggestionApplied(supabase, {
        pageId: typeof o.pageId === "string" ? o.pageId : null,
        variantId: null,
        tool: "design_optimizer",
        appliedKeys: suggestionIds ?? affectedKeys,
        sourceRid: ctx.rid,
      });
      await logEvent({
        type: "design_change",
        source: "design_optimizer_apply",
        payload: {
          kind: "design_optimizer_apply",
          metrics,
          pageId: typeof o.pageId === "string" ? o.pageId : null,
          action,
          appliedKeys: suggestionIds ?? affectedKeys,
        },
        page_id: typeof o.pageId === "string" ? o.pageId : null,
        company_id: null,
        source_rid: ctx.rid,
      });
      const keys = (suggestionIds ?? affectedKeys).slice(0, 16);
      await recordLearningOutcome({
        change: `DesignSettings ${action}: ${keys.join(", ") || "(patch)"}`,
        result: action === "publish" ? "Publisert (policy-sikker apply)" : "Lagret utkast",
        explain: autoApply ? "autoApply=true" : undefined,
        source: "design_optimizer_apply",
        page_id: typeof o.pageId === "string" ? o.pageId : null,
        company_id: null,
        source_rid: ctx.rid,
      });
    } catch (e) {
      if (e instanceof IntelligenceSchemaValidationError) throw e;
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("design_optimizer.apply_log_failed", { error: e instanceof Error ? e.message : String(e) });
    }

    let systemIntel: Awaited<ReturnType<typeof getSystemIntelligence>> | null = null;
    try {
      systemIntel = await getSystemIntelligence({ limit: 500, recentEventLimit: 25 });
    } catch {
      systemIntel = null;
    }

    return jsonOk(
      ctx.rid,
      {
        action,
        revertDesignSettings: applyRes.revertDesignSettings,
        afterDesignSettings: applyRes.afterDesignSettings,
        appliedPatch: patch,
        draft: action === "save" ? applyRes.draft : undefined,
        published: action === "publish" ? true : undefined,
        metrics,
        systemIntelligence: systemIntel
          ? { signals: systemIntel.signals, trends: systemIntel.trends, generatedAt: systemIntel.generatedAt }
          : null,
        message:
          action === "publish"
            ? "DesignSettings er publisert. Behold revertDesignSettings for å rulle tilbake."
            : "Utkast oppdatert med DesignSettings-patch.",
      },
      200,
    );
  });
}
