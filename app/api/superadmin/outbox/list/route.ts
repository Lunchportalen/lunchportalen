// app/api/superadmin/outbox/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { listOutbox, outboxCounts } from "@/lib/orderBackup/admin";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function clampInt(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function GET(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.outbox.list.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const statusRaw = safeStr(url.searchParams.get("status") || "ALL").toUpperCase();
  const q = safeStr(url.searchParams.get("q") || "");
  const limit = clampInt(Number(url.searchParams.get("limit") || "50"), 1, 200, 50);

  const allowed = new Set(["ALL", "PENDING", "PROCESSING", "FAILED", "FAILED_PERMANENT", "SENT"]);
  if (!allowed.has(statusRaw)) {
    return jsonErr(ctx.rid, "Ugyldig status.", 400, { code: "BAD_REQUEST", detail: { status: statusRaw } });
  }

  try {
    const rows = await listOutbox({ status: statusRaw as any, q, limit });
    const counts = await outboxCounts();

    return jsonOk(ctx.rid, {
        ok: true,
        rid: ctx.rid,
        counts,
        rows,
      }, 200);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Kunne ikke hente outbox.", 500, { code: "OUTBOX_LIST_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}

