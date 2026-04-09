/**
 * POST /api/backoffice/sanity/menu-content/publish
 * Superadmin-only broker: publish Sanity draft `menuContent` for a date (same Actions API as Studio).
 * Body: { "date": "YYYY-MM-DD" }
 */
import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse, readJson } from "@/lib/http/routeGuard";
import { getSanityWriteToken } from "@/lib/config/env";
import { publishMenuContentDraftForDate } from "@/lib/sanity/menuContentPublishOps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  if (!getSanityWriteToken()) {
    return jsonErr(
      ctx.rid,
      "SANITY_WRITE_TOKEN mangler — server-side publish er blokkert (fail-closed).",
      503,
      "SANITY_WRITE_UNAVAILABLE"
    );
  }

  const body = await readJson(req);
  const date = typeof body?.date === "string" ? body.date.trim() : "";

  const result = await publishMenuContentDraftForDate(date);
  if (result.ok === false) {
    if (result.error === "invalid_date") {
      return jsonErr(ctx.rid, "Ugyldig dato (forventet YYYY-MM-DD).", 422, "INVALID_DATE");
    }
    if (result.error === "not_found") {
      return jsonErr(ctx.rid, "Fant ingen menuContent for denne datoen i Sanity.", 404, "NOT_FOUND");
    }
    return jsonErr(ctx.rid, "Sanity publish-handling feilet.", 502, "SANITY_PUBLISH_FAILED", result.detail ?? null);
  }

  if ("noop" in result && result.noop) {
    return jsonOk(ctx.rid, { published: false, reason: result.reason });
  }

  if ("publishedId" in result && "draftId" in result) {
    return jsonOk(ctx.rid, { published: true, publishedId: result.publishedId, draftId: result.draftId });
  }

  return jsonErr(ctx.rid, "Uventet svar fra publish.", 500, "INTERNAL");
}
