// app/api/superadmin/outbox/run/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { processOutboxBatch } from "@/lib/orderBackup/outbox";
import { outboxCounts } from "@/lib/orderBackup/admin";
import { sendOutboxAlert } from "@/lib/orderBackup/alert";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.outbox.run.POST", ["superadmin"]);
  if (deny) return deny;

  try {
    const before = await outboxCounts();
    const res = await processOutboxBatch(25);
    const after = await outboxCounts();

    // Varsling hvis FAILED > 0 etter run (best-effort)
    if (Number((after as any)?.FAILED ?? 0) > 0) {
      const subject = `Outbox varsel: ${after.FAILED} FAILED (etter run)`;
      const text =
        `Outbox varsel\n\n` +
        `RID: ${ctx.rid}\n` +
        `Before: PENDING=${before.PENDING} FAILED=${before.FAILED} SENT=${before.SENT}\n` +
        `After:  PENDING=${after.PENDING} FAILED=${after.FAILED} SENT=${after.SENT}\n` +
        `Run: processed=${res.processed} sent=${res.sent} failed=${res.failed}\n`;

      try {
        await sendOutboxAlert({ subject, text });
      } catch {
        // best effort – ikke stopp run
      }
    }

    return jsonOk(ctx.rid, {
        ok: true,
        rid: ctx.rid,
        run: res,
        before,
        after,
      }, 200);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Kunne ikke kjøre outbox.", 500, { code: "OUTBOX_RUN_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}

