export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { readJson } from "@/lib/http/routeGuard";
import { materializeProductionOperativeSnapshot } from "@/lib/server/kitchen/materializeProductionOperativeSnapshot";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * POST — samme materialisering som superadmin; kun CRON_SECRET (samme gate som øvrig internal scheduler).
 * Body: { "date": "YYYY-MM-DD", "companyId": "uuid" }
 */
export async function POST(req: NextRequest) {
  const rid = makeRid("snap");
  try {
    requireCronAuth(req);
  } catch (e: any) {
    const code = String(e?.code ?? "").trim();
    if (code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET er ikke satt.", 500, "misconfigured");
    }
    return jsonErr(rid, "Forbidden.", 403, "forbidden");
  }

  const body = await readJson(req);
  const dateISO = safeStr(body?.date);
  const companyId = safeStr(body?.companyId);
  if (!dateISO || !companyId) {
    return jsonErr(rid, "Mangler date eller companyId.", 400, "BAD_REQUEST", { detail: { date: dateISO, companyId } });
  }

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: unknown) {
    return jsonErr(rid, "Service role mangler.", 500, "CONFIG_ERROR", {
      detail: safeStr(e instanceof Error ? e.message : e),
    });
  }

  const result = await materializeProductionOperativeSnapshot(admin as any, { dateISO, companyId });
  if (result.ok === false) {
    return jsonErr(rid, result.message, 400, "MATERIALIZE_FAILED");
  }

  return jsonOk(rid, result, 200);
}
