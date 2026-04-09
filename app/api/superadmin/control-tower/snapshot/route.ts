// Aggregert snapshot for Superadmin Control Tower (additive, fail-safe).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * GET: parallel read-only fetch of eksisterende API-er (ingen endring i underliggende routes).
 * Forwarder cookies slik at superadmin-session gjelder. Kaster aldri — alltid JSON med partial data.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("control_tower_snapshot");

  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const origin = req.nextUrl.origin;
    const cookie = req.headers.get("cookie") ?? "";

    async function safeFetch(path: string): Promise<unknown | null> {
      try {
        const res = await fetch(`${origin}${path}`, {
          headers: {
            cookie,
            "Cache-Control": "no-store",
          },
          cache: "no-store",
        });
        const text = await res.text();
        if (!text) return null;
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return null;
        }
      } catch {
        return null;
      }
    }

    try {
      const [control, ceo, revenue, growth] = await Promise.all([
        safeFetch("/api/superadmin/control-tower/data"),
        safeFetch("/api/ceo/brain"),
        safeFetch("/api/revenue/brain"),
        safeFetch("/api/social/ai"),
      ]);

      return jsonOk(
        rid,
        {
          control,
          ceo,
          revenue,
          growth,
          generatedAt: new Date().toISOString(),
        },
        200
      );
    } catch {
      return jsonOk(
        rid,
        {
          control: null,
          ceo: null,
          revenue: null,
          growth: null,
          generatedAt: new Date().toISOString(),
          partial: true,
        },
        200
      );
    }
  } catch (e) {
    return jsonErr(rid, "Kunne ikke bygge snapshot.", 500, "SNAPSHOT_FAILED", e);
  }
}
