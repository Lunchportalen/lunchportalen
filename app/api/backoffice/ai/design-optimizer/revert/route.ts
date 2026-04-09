import type { NextRequest } from "next/server";

import { extractDesignSettingsForStorage } from "@/lib/ai/design/designSettingsOptimizer";
import { loadGlobalSettingsDataForEditor } from "@/lib/cms/globalSettingsAdmin";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEY = "settings" as const;

function cloneDeep<T>(v: T): T {
  try {
    return JSON.parse(JSON.stringify(v)) as T;
  } catch {
    return v;
  }
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
    const revertDs = extractDesignSettingsForStorage(o.revertDesignSettings);

    const loaded = await loadGlobalSettingsDataForEditor();
    if (loaded.ok === false) {
      return jsonErr(ctx.rid, loaded.message, 500, "SETTINGS_LOAD_FAILED");
    }

    const baseData = cloneDeep(loaded.data);
    const beforeRevert = extractDesignSettingsForStorage(baseData.designSettings);
    const nextData = { ...baseData, designSettings: revertDs };

    const saved = await saveGlobalDraft(KEY, nextData);
    if (saved.ok === false) {
      return jsonErr(ctx.rid, saved.message, 500, "SAVE_FAILED");
    }

    if (action === "publish") {
      const published = await publishGlobal(KEY);
      if (published.ok === false) {
        return jsonErr(ctx.rid, published.message, 422, "PUBLISH_FAILED");
      }
    }

    try {
      await supabaseAdmin().from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "design_optimizer_revert",
          page_id: typeof o.pageId === "string" ? o.pageId : null,
          variant_id: null,
          actor_user_id: ctx.scope?.email ?? null,
          tool: "design_optimizer",
          environment: action === "publish" ? "prod" : "preview",
          locale: o.locale === "en" ? "en" : "nb",
          metadata: {
            action,
            beforeRevert,
            restoredDesignSettings: revertDs,
          },
        }),
      );
    } catch (e) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("design_optimizer.revert_log_failed", { error: e instanceof Error ? e.message : String(e) });
    }

    return jsonOk(
      ctx.rid,
      {
        action,
        restoredDesignSettings: revertDs,
        message:
          action === "publish"
            ? "DesignSettings er tilbakestilt og publisert."
            : "DesignSettings er tilbakestilt i utkast.",
      },
      200,
    );
  });
}
