// app/api/cron/cleanup-invites/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function json(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

// Enkel “secret” for cron (valgfritt men anbefalt)
function requireCronSecret(req: Request) {
  const want = process.env.CRON_SECRET;
  if (!want) return;
  const got = req.headers.get("x-cron-secret") || "";
  if (got !== want) throw new Error("forbidden");
}

export async function POST(req: Request) {
  const rid = `inv_cleanup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    requireCronSecret(req);

    const admin = supabaseAdmin();

    // 1) Slett utløpte, ikke-brukte
    const expired = await admin
      .from("employee_invites")
      .delete()
      .is("used_at", null)
      .lt("expires_at", new Date().toISOString());

    // 2) (Valgfritt) Slett brukte som er eldre enn 30 dager
    const usedCutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    const usedOld = await admin
      .from("employee_invites")
      .delete()
      .not("used_at", "is", null)
      .lt("used_at", usedCutoff);

    return json({
      ok: true,
      rid,
      expiredDeleted: expired.error ? null : true,
      expiredError: expired.error ?? null,
      usedOldDeleted: usedOld.error ? null : true,
      usedOldError: usedOld.error ?? null,
    });
  } catch (e: any) {
    if (String(e?.message ?? "") === "forbidden") return json({ ok: false, rid, error: "forbidden" }, 403);
    return json({ ok: false, rid, error: "server_error", detail: String(e?.message ?? e) }, 500);
  }
}
