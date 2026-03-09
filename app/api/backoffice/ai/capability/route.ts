import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, makeRid } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hasNonEmpty(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim() !== "";
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin", "company_admin"]);
  if (deny) return deny;

  const hasAiProvider = hasNonEmpty("AI_PROVIDER");
  const hasAiApiKey = hasNonEmpty("AI_API_KEY");
  const hasOpenaiApiKey = hasNonEmpty("OPENAI_API_KEY");
  const enabled = isAIEnabled();

  if (process.env.NODE_ENV === "development") {
    console.log("[EDITOR_AI_CAPABILITY] route", {
      hasAiProvider,
      hasAiApiKey,
      hasOpenaiApiKey,
      enabled,
      hint: !enabled && !hasAiApiKey && !hasOpenaiApiKey
        ? "No API key in process.env. Restart dev server after setting .env / OPENAI_API_KEY or AI_API_KEY."
        : undefined,
    });
  }

  return jsonOk(rid, { ok: true, enabled }, 200);
}
