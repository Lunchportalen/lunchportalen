import type { NextRequest } from "next/server";

import { improveBlocks } from "@/lib/ai/autoImprove";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { rid } from "@/lib/http/rid";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const runtime = "nodejs";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  return jsonErr(rid(), "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function POST(request: NextRequest) {
  return withApiAiEntrypoint(request, "POST", async () => {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o || !("blocks" in o) || !Array.isArray(o.blocks)) {
    return jsonErr(ctx.rid, "Mangler blocks (array).", 400, "BAD_REQUEST");
  }

  const improved = improveBlocks(o.blocks);
  return jsonOk(ctx.rid, { blocks: improved.blocks, body: improved }, 200);
  });
}
