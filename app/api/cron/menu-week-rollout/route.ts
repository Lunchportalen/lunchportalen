// GET /api/cron/menu-week-rollout — auto-fill + auto-publish menuDay for week N+3 (Thu cron)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runMenuWeekRollout } from "@/lib/menu-publish/runMenuWeekRollout";
import { requireSanityWrite } from "@/lib/sanity/client";
import { sanityServer } from "@/lib/sanity/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const rid = makeRid("cron_mwr");

  try {
    requireCronAuth(req);
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    const code = String((e as { code?: string })?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET er ikke satt i environment.", 500, "cron_secret_missing");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig eller manglende cron secret.", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate.", 500, "server_error");
  }

  try {
    requireSanityWrite();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, "Sanity write token mangler — rollout kan ikke kjøre.", 500, "sanity_write_missing", {
      message: msg,
    });
  }

  try {
    const data = await runMenuWeekRollout({
      supabaseAdmin,
      sanityRead: sanityServer,
      getSanityWrite: requireSanityWrite,
    });
    return jsonOk(rid, data, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, "Menu week rollout feilet.", 500, "rollout_failed", { message: msg });
  }
}
