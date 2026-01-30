// app/api/superadmin/outbox/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { listOutbox, outboxCounts } from "@/lib/orderBackup/admin";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function clampInt(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.outbox.list.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const statusRaw = safeStr(url.searchParams.get("status") || "ALL").toUpperCase();
  const q = safeStr(url.searchParams.get("q") || "");
  const limit = clampInt(Number(url.searchParams.get("limit") || "50"), 1, 200, 50);

  const allowed = new Set(["ALL", "PENDING", "FAILED", "SENT"]);
  if (!allowed.has(statusRaw)) {
    return jsonErr(400, ctx, "BAD_REQUEST", "Ugyldig status.", { status: statusRaw });
  }

  try {
    const rows = await listOutbox({ status: statusRaw as any, q, limit });
    const counts = await outboxCounts();

    return jsonOk(
      ctx,
      {
        ok: true,
        rid: ctx.rid,
        counts,
        rows,
      },
      200
    );
  } catch (e: any) {
    return jsonErr(500, ctx, "OUTBOX_LIST_FAILED", "Kunne ikke hente outbox.", {
      message: String(e?.message ?? e),
    });
  }
}
