/**
 * POST /api/backoffice/ai/screenshot-builder
 * Request: { screenshotUrl?, description?, locale? } — at least one of screenshotUrl or description required.
 * Response: { blocks, screenshotUrl, message }. Blocks are deterministic (hero, richText, image, cta); apply path must normalize via normalizePageBuilderBlocks before writing.
 */
import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { buildScreenshotBootstrapBlocks } from "@/lib/ai/tools/blockBuilder";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;
  if (!isAIEnabled()) return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

  const screenshotUrl = typeof o.screenshotUrl === "string" ? o.screenshotUrl.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  if (!screenshotUrl && !description) {
    return jsonErr(ctx.rid, "Missing both screenshotUrl and description; at least one required.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const { blocks, message } = buildScreenshotBootstrapBlocks({
    screenshotUrl: screenshotUrl || undefined,
    description: description || undefined,
    locale,
  });

  return jsonOk(ctx.rid, { blocks, screenshotUrl: screenshotUrl || "(none)", message }, 200);
}
