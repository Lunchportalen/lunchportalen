import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/runner";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hasNonEmpty(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim() !== "";
}

/** GET: AI capability (enabled flag). Auth: scopeOr401 then requireRoleOr403(superadmin). Missing/broken auth fails closed (401 from scopeOr401). */
export async function GET(req: NextRequest) {
  return withApiAiEntrypoint(req, "GET", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const rid = gate.ctx.rid ?? makeRid();
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const hasAiProvider = hasNonEmpty("AI_PROVIDER");
  const hasAiApiKey = hasNonEmpty("AI_API_KEY");
  const hasOpenaiApiKey = hasNonEmpty("OPENAI_API_KEY");
  const enabled = isAIEnabled();
  const runtime = getCmsRuntimeStatus();

  if (process.env.NODE_ENV === "development") {
    console.log("[EDITOR_AI_CAPABILITY] route", {
      hasAiProvider,
      hasAiApiKey,
      hasOpenaiApiKey,
      enabled,
      runtime,
      hint: !enabled && !hasAiApiKey && !hasOpenaiApiKey
        ? "No API key in process.env. Restart dev server after setting .env / OPENAI_API_KEY or AI_API_KEY."
        : undefined,
    });
  }

  return jsonOk(rid, { ok: true, enabled, runtime }, 200);
  });
}

