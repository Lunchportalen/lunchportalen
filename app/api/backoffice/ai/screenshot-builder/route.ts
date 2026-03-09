import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { buildScreenshotBootstrapBlocks } from "@/lib/ai/tools/blockBuilder";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const rid = makeRid();
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin", "company_admin"]);
  if (deny) return deny;
  if (!isAIEnabled()) return jsonErr(rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(rid, "Body must be an object.", 400, "BAD_REQUEST");

  const screenshotUrl = typeof o.screenshotUrl === "string" ? o.screenshotUrl.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  if (!screenshotUrl && !description) {
    return jsonErr(rid, "Missing both screenshotUrl and description; at least one required.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const { blocks, message } = buildScreenshotBootstrapBlocks({
    screenshotUrl: screenshotUrl || undefined,
    description: description || undefined,
    locale,
  });

  return jsonOk(rid, { blocks, screenshotUrl: screenshotUrl || "(none)", message }, 200);
}
