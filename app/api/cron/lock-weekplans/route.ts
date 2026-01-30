// app/api/cron/lock-weekplans/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { sanityServer } from "@/lib/sanity/server";
import { nowISO, osloTodayISODate } from "@/lib/date/oslo";

/* =========================================================
   Dag-10: no-store + consistent JSON
========================================================= */
function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" } as const;
}
function json(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return json({ ok: false, rid, error, message, detail: detail ?? undefined }, status);
}

/* =========================================================
   Cron secret gate (NO cookies / NO scope)
   - Header: x-cron-secret: <CRON_SECRET>
   - (Optional fallback) Authorization: Bearer <CRON_SECRET>
========================================================= */
function requireCronSecret(req: Request) {
  const want = (process.env.CRON_SECRET ?? "").trim();
  if (!want) throw new Error("cron_secret_missing"); // fail-closed for cron endpoints

  const gotHeader = (req.headers.get("x-cron-secret") ?? "").trim();
  const gotBearer = (req.headers.get("authorization") ?? "").trim().replace(/^Bearer\s+/i, "");
  const got = gotHeader || gotBearer;

  if (!got || got !== want) {
    const err = new Error("forbidden");
    (err as any).code = "forbidden";
    throw err;
  }
}

/* =========================================================
   Query
   - Lock all published weekPlans that include "today" and are not locked yet.
   - Lock is on document level (lockedAt), not per day.
========================================================= */
const FIND_TO_LOCK_GROQ = /* groq */ `
*[_type=="weekPlan"
  && defined(publishedAt)
  && approvedForPublish==true
  && customerVisible==true
  && !defined(lockedAt)
  && count(days[date==$today]) > 0
]{
  _id,
  weekStart
}
`;

/* =========================================================
   GET /api/cron/lock-weekplans
========================================================= */
export async function GET(req: Request) {
  const rid = `lock_weekplans_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Gate FIRST (no side effects before secret validated)
  try {
    requireCronSecret(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "cron_secret_missing") {
      return jsonErr(500, rid, "misconfigured", "CRON_SECRET mangler i miljøvariabler");
    }
    if (msg === "forbidden" || e?.code === "forbidden") {
      return jsonErr(403, rid, "forbidden", "Mangler/ugyldig cron secret");
    }
    return jsonErr(500, rid, "server_error", "Uventet feil i cron-gate", { message: msg });
  }

  const today = osloTodayISODate();
  const ts = nowISO();

  try {
    const toLock = (await sanityServer.fetch(FIND_TO_LOCK_GROQ, { today })) as { _id: string; weekStart?: string }[];

    if (!toLock?.length) {
      return json({ ok: true, rid, today, lockedAt: ts, locked: 0, ids: [] }, 200);
    }

    // Idempotent: query excludes lockedAt; repeated runs => locked:0 after first successful commit
    let tx = sanityServer.transaction();
    for (const d of toLock) {
      tx = tx.patch(d._id, (p: any) => p.set({ lockedAt: ts }));
    }
    await tx.commit();

    return json(
      {
        ok: true,
        rid,
        today,
        lockedAt: ts,
        locked: toLock.length,
        ids: toLock.map((d) => d._id),
      },
      200
    );
  } catch (e: any) {
    return jsonErr(500, rid, "sanity_error", "Kunne ikke låse ukeplaner", {
      today,
      message: String(e?.message ?? e),
    });
  }
}
