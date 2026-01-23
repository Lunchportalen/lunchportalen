export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sanityServer } from "@/lib/sanity/server";
import { isPublishWindowOslo, nowISO } from "@/lib/date/oslo";
import { supabaseServer } from "@/lib/supabase/server";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isSanityId(v: any) {
  return typeof v === "string" && v.trim().length > 10;
}

export async function POST(req: Request) {
  const rid = `publish_weekplan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // 1) Auth + role
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonError(401, "unauthorized", "Ikke innlogget", { rid });

  const role = String(userData.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return jsonError(403, "forbidden", "Kun superadmin kan publisere", { rid });

  // 2) Parse payload
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Ugyldig JSON", { rid });
  }

  const weekPlanId = String(body?.weekPlanId ?? "");
  if (!isSanityId(weekPlanId)) return jsonError(400, "bad_request", "weekPlanId mangler/ugyldig", { rid });

  // 3) Publish window
  if (!isPublishWindowOslo()) {
    return jsonError(409, "publish_window", "Publisering er kun tillatt torsdag–søndag (Oslo-tid)", { rid });
  }

  // 4) Fetch current doc (locked check)
  const doc = await sanityServer.getDocument(weekPlanId);
  if (!doc) return jsonError(404, "not_found", "Fant ikke ukeplan", { rid, weekPlanId });

  const lockedAt = (doc as any)?.lockedAt ?? null;
  if (lockedAt) {
    return jsonError(409, "locked", "Ukeplan er låst og kan ikke publiseres", { rid, lockedAt });
  }

  // 5) Patch: approved + visible + publishedAt
  const ts = nowISO();

  try {
    await sanityServer
      .patch(weekPlanId)
      .set({
        approvedForPublish: true,
        customerVisible: true,
        publishedAt: ts,
      })
      .commit({ autoGenerateArrayKeys: true });

    return NextResponse.json(
      { ok: true, rid, weekPlanId, publishedAt: ts, approvedForPublish: true, customerVisible: true },
      { status: 200 }
    );
  } catch (e: any) {
    return jsonError(500, "sanity_error", "Kunne ikke publisere ukeplan", { rid, message: e?.message ?? String(e) });
  }
}
