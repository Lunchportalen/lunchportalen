import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { buildBlockFromDescription } from "@/lib/ai/tools/blockBuilder";
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

  const description = typeof o.description === "string" ? o.description.trim() : "";
  if (!description) return jsonErr(rid, "Missing or empty description.", 400, "MISSING_DESCRIPTION");

  const preferredType = typeof o.preferredType === "string" ? o.preferredType.trim() : undefined;
  const locale = o.locale === "en" ? "en" : "nb";
  const pageId = typeof o.pageId === "string" ? o.pageId : undefined;
  const variantId = typeof o.variantId === "string" ? o.variantId : undefined;
  const context = o.context && typeof o.context === "object" && !Array.isArray(o.context) ? (o.context as Record<string, unknown>) : undefined;

  const input = {
    description,
    preferredType: preferredType || undefined,
    locale,
  };
  const { block, message } = buildBlockFromDescription(input);

  return jsonOk(rid, { block, message }, 200);
}
