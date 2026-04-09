export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { readSystemSettingsBaseline } from "@/lib/system/settings";

export { PUT } from "@/app/api/superadmin/system/route";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const rid = ctx.rid;

  const deny = requireRoleOr403(ctx, "api.backoffice.settings.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const baselineRead = await readSystemSettingsBaseline();
    return jsonOk(
      rid,
      {
        settings: baselineRead.settings,
        baseline: baselineRead.baseline,
      },
      200,
    );
  } catch (error: unknown) {
    return jsonErr(
      rid,
      "Kunne ikke hente systeminnstillinger.",
      500,
      "SETTINGS_FATAL",
      error instanceof Error ? { message: error.message } : { detail: String(error ?? "Unknown error") },
    );
  }
}
