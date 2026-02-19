// app/api/cron/cleanup-invites/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isoNow() {
  return new Date().toISOString();
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
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

export async function POST(req: Request) {
  const rid = makeRid();

  try {
    requireCronAuth(req);

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();

    const expired = await admin
      .from("employee_invites")
      .delete({ count: "exact" })
      .is("used_at", null)
      .lt("expires_at", isoNow());

    const keepUsedDays = clampInt(process.env.INVITES_KEEP_USED_DAYS, 1, 3650, 30);
    const usedCutoff = isoDaysAgo(keepUsedDays);

    const usedOld = await admin
      .from("employee_invites")
      .delete({ count: "exact" })
      .not("used_at", "is", null)
      .lt("used_at", usedCutoff);

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        now: isoNow(),
        usedCutoff,
        keepUsedDays,
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
      },
      200
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i env.", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret.", 403, "forbidden");
    }

    return jsonErr(rid, "Uventet feil.", 500, { code: "server_error", detail: msg });
  }
}
