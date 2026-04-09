// app/api/cron/lock-weekplans/route.ts
// Låser Sanity weekPlan-dokumenter (redaksjonelt spor — ikke employee order/window).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { nowISO, osloTodayISODate } from "@/lib/date/oslo";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

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

export async function GET(req: Request) {
  const rid = makeRid();
  const { sanityServer } = await import("@/lib/cms/sanityWriteClient");

  try {
    requireCronAuth(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i miljovariabler", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
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

    let tx = sanityServer.transaction();
    for (const d of toLock) {
      tx = tx.patch(d._id, (p: any) => p.set({ lockedAt: ts }));
    }
    await tx.commit();

    return jsonOk(
      rid,
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
    return jsonErr(rid, "Kunne ikke lase ukeplaner", 500, {
      code: "sanity_error",
      detail: { today, message: String(e?.message ?? e) },
    });
  }
}
