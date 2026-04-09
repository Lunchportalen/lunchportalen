export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { optimizeBlocks } from "@/lib/ai/optimizerEngine";
import { CMS_DRAFT_ENVIRONMENT } from "@/lib/cms/cmsDraftEnvironment";
import { parseBody } from "@/lib/cms/public/parseBody";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { trackUsage } from "@/lib/saas/billingTracker";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ENABLE_ENV_AI_OPTIMIZER = "AI_OPTIMIZER_ENABLED";
const ENABLE_ENV_LEGACY = "LP_AI_OPTIMIZER_CRON_ENABLED";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const rid = makeRid("cron_ai_opt");

    try {
      requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (msg === "system_motor_secret_missing" || code === "system_motor_secret_missing") {
        return jsonErr(rid, "SYSTEM_MOTOR_SECRET er ikke satt.", 500, "MISCONFIGURED");
      }
      if (msg === "forbidden" || code === "forbidden") {
        return jsonErr(rid, "Ugyldig cron-secret.", 403, "FORBIDDEN");
      }
      return jsonErr(rid, "Cron-gate feilet.", 500, "CRON_AUTH_ERROR");
    }

    const enabled =
      safeTrim(process.env[ENABLE_ENV_AI_OPTIMIZER]) === "true" ||
      safeTrim(process.env[ENABLE_ENV_LEGACY]) === "true";
    if (!enabled) {
      opsLog("ai_optimizer_skipped", {
        rid,
        reason: "cron_disabled",
        env: ENABLE_ENV_AI_OPTIMIZER,
        envLegacy: ENABLE_ENV_LEGACY,
      });
      return jsonOk(
        rid,
        {
          optimized: false,
          reason: "AI_OPTIMIZER_ENABLED or LP_AI_OPTIMIZER_CRON_ENABLED must be true",
        },
        200,
      );
    }

    const supabase = supabaseAdmin();
    const { data: pages, error: pErr } = await supabase.from("content_pages").select("id");
    if (pErr) {
      return jsonErr(rid, pErr.message, 500, "DB_ERROR");
    }

    let updated = 0;
    for (const row of pages ?? []) {
      const pageId = String((row as { id: string }).id ?? "");
      if (!pageId) continue;

      const { data: variants, error: vErr } = await supabase
        .from("content_page_variants")
        .select("id,body")
        .eq("page_id", pageId)
        .eq("environment", CMS_DRAFT_ENVIRONMENT)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (vErr || !variants?.length) continue;

      const variant = variants[0] as { id: string; body: unknown };
      const rawBody = variant.body;
      const blocksIn = parseBody(rawBody);
      if (blocksIn.length === 0) continue;

      const improved = optimizeBlocks(blocksIn);
      const base =
        rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
          ? ({ ...(rawBody as Record<string, unknown>) } as Record<string, unknown>)
          : { version: 1 };
      const nextBody = {
        ...base,
        version: typeof base.version === "number" ? base.version : 1,
        blocks: improved.blocks,
        meta:
          typeof base.meta === "object" && base.meta && !Array.isArray(base.meta)
            ? { ...(base.meta as Record<string, unknown>), aiOptimizer: { pass: "cron@v1", rid } }
            : { aiOptimizer: { pass: "cron@v1", rid } },
      };

      const { error: uErr } = await supabase
        .from("content_page_variants")
        .update({ body: nextBody, updated_at: new Date().toISOString() })
        .eq("id", variant.id);
      if (uErr) {
        opsLog("ai_optimizer_apply_failed", { rid, pageId, variantId: variant.id, message: uErr.message });
        continue;
      }
      updated += 1;
      opsLog("ai_optimizer_applied", { rid, pageId, variantId: variant.id, blockCount: improved.blocks.length });
    }

    trackUsage({
      kind: "ai_optimizer_cron",
      rid,
      pagesUpdated: updated,
      totalPages: (pages ?? []).length,
    });
    return jsonOk(rid, { optimized: true, pagesUpdated: updated, totalPages: (pages ?? []).length }, 200);
  });
}

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}
