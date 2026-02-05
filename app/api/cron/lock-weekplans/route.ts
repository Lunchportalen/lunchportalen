// app/api/cron/lock-weekplans/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { nowISO, osloTodayISODate } from "@/lib/date/oslo";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

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
  const { sanityServer } = await import("@/lib/sanity/server");
  const rid = makeRid();

  // Gate FIRST (no side effects before secret validated)
  try {
    requireCronSecret(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i miljøvariabler", 500, "misconfigured");
    }
    if (msg === "forbidden" || e?.code === "forbidden") {
      return jsonErr(rid, "Mangler/ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
  }

  const today = osloTodayISODate();
  const ts = nowISO();

  try {
    const toLock = (await sanityServer.fetch(FIND_TO_LOCK_GROQ, { today })) as { _id: string; weekStart?: string }[];

    if (!toLock?.length) {
      return jsonOk(rid, { ok: true, rid, today, lockedAt: ts, locked: 0, ids: [] }, 200);
    }

    // Idempotent: query excludes lockedAt; repeated runs => locked:0 after first successful commit
    let tx = sanityServer.transaction();
    for (const d of toLock) {
      tx = tx.patch(d._id, (p: any) => p.set({ lockedAt: ts }));
    }
    await tx.commit();

    return jsonOk(rid, {
      ok: true,
      rid,
      today,
      lockedAt: ts,
      locked: toLock.length,
      ids: toLock.map((d) => d._id),
    }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke låse ukeplaner", 500, { code: "sanity_error", detail: {
      today,
      message: String(e?.message ?? e),
    } });
  }
}

