export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sanityServer } from "@/lib/sanity/server";
import { nowISO, osloTodayISODate } from "@/lib/date/oslo";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return !!secret && !!got && got === secret;
}

/**
 * Lås alle publiserte ukeplaner som inkluderer "i dag" og ikke allerede er låst.
 * (Vi låser ukeplanen på doc-nivå, ikke per dag.)
 */
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
  const rid = `lock_weekplans_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  if (!isAuthorized(req)) {
    return jsonError(401, "unauthorized", "Mangler/ugyldig cron secret", { rid });
  }

  const today = osloTodayISODate();
  const ts = nowISO();

  try {
    const toLock: { _id: string; weekStart?: string }[] = await sanityServer.fetch(FIND_TO_LOCK_GROQ, { today });

    if (!toLock?.length) {
      return NextResponse.json({ ok: true, rid, today, locked: 0, ids: [] }, { status: 200 });
    }

    // Patch i transaksjon
    let tx = sanityServer.transaction();
    for (const d of toLock) {
      tx = tx.patch(d._id, (p) => p.set({ lockedAt: ts }));
    }
    await tx.commit();

    return NextResponse.json(
      { ok: true, rid, today, lockedAt: ts, locked: toLock.length, ids: toLock.map((d) => d._id) },
      { status: 200 }
    );
  } catch (e: any) {
    return jsonError(500, "sanity_error", "Kunne ikke låse ukeplaner", { rid, today, message: e?.message ?? String(e) });
  }
}
