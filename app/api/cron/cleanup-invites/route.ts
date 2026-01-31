// app/api/cron/cleanup-invites/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

/* =========================================================
   Response helpers (no-store + consistent JSON)
========================================================= */
function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" } as const;
}

function json(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

/* =========================================================
   Cron secret guard (optional but recommended)
   - If CRON_SECRET is set, request must include:
     header: x-cron-secret: <CRON_SECRET>
========================================================= */
function requireCronSecret(req: Request) {
  const want = (process.env.CRON_SECRET ?? "").trim();
  if (!want) return; // guard disabled if env not set
  const got = (req.headers.get("x-cron-secret") ?? "").trim();
  if (got !== want) {
    const err = new Error("forbidden");
    (err as any).code = "forbidden";
    throw err;
  }
}

/* =========================================================
   Small helpers
========================================================= */
function isoNow() {
  return new Date().toISOString();
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeRid(prefix = "inv_cleanup") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function asDetailString(detail: unknown) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

/* =========================================================
   POST /api/cron/cleanup-invites
========================================================= */
export async function POST(req: Request) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    requireCronSecret(req);

    const admin = supabaseAdmin();

    // 1) Delete expired, unused invites
    //    - used_at IS NULL
    //    - expires_at < now
    const expired = await admin
      .from("employee_invites")
      .delete({ count: "exact" })
      .is("used_at", null)
      .lt("expires_at", isoNow());

    // 2) Delete used invites older than N days (default 30)
    const keepUsedDays = Number.parseInt(process.env.INVITES_KEEP_USED_DAYS ?? "30", 10);
    const usedCutoff = isoDaysAgo(Number.isFinite(keepUsedDays) && keepUsedDays > 0 ? keepUsedDays : 30);

    const usedOld = await admin
      .from("employee_invites")
      .delete({ count: "exact" })
      .not("used_at", "is", null)
      .lt("used_at", usedCutoff);

    return json({
      ok: true,
      rid,
      now: isoNow(),
      usedCutoff,
      expired: {
        ok: !expired.error,
        deletedCount: expired.count ?? 0,
        error: expired.error ? asDetailString(expired.error) : null,
      },
      usedOld: {
        ok: !usedOld.error,
        deletedCount: usedOld.count ?? 0,
        error: usedOld.error ? asDetailString(usedOld.error) : null,
      },
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "forbidden" || e?.code === "forbidden") {
      return json({ ok: false, rid, error: "forbidden" }, 403);
    }
    return json({ ok: false, rid, error: "server_error", detail: msg }, 500);
  }
}


