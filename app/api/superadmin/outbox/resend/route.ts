// app/api/superadmin/outbox/resend/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.outbox.resend.POST", ["superadmin"]);
  if (deny) return deny;

  const body = await readJson(req);
  const id = safeStr(body?.id);
  if (!id) return jsonErr(ctx.rid, "Mangler outbox-id.", 400, "BAD_REQUEST");

  try {
    const admin = supabaseAdmin();
    const { data: row, error: readError } = await admin.from("outbox").select("id").eq("id", id).maybeSingle();

    if (readError) {
      return jsonErr(ctx.rid, "Kunne ikke hente outbox-rad.", 500, "OUTBOX_RESEND_READ_FAILED");
    }
    if (!row?.id) {
      return jsonErr(ctx.rid, "Outbox-rad finnes ikke.", 404, "OUTBOX_NOT_FOUND");
    }

    const { error: updateError } = await admin
      .from("outbox")
      .update({
        status: "PENDING",
        attempts: 0,
        last_error: null,
        delivered_at: null,
      })
      .eq("id", id);

    if (updateError) {
      return jsonErr(ctx.rid, "Kunne ikke klargjøre resend.", 500, "OUTBOX_RESEND_UPDATE_FAILED");
    }

    return jsonOk(ctx.rid, { id, reset: true }, 200);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Kunne ikke resende outbox-rad.", 500, {
      code: "OUTBOX_RESEND_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
