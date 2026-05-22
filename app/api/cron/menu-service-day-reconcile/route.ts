// GET /api/cron/menu-service-day-reconcile — backup sync Sanity menuDay → menu_service_days
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { syncMenuServiceDaysForPublishedMenuDay } from "@/lib/menu-publish/syncMenuServiceDaysFromMenuDay";
import { sanityServer } from "@/lib/sanity/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type MenuDayRow = { date?: string | null; planTier?: string | null };

export async function GET(req: NextRequest) {
  const rid = makeRid("cron_msd");

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

  const today = osloTodayISODate();
  const toInclusive = addDaysISO(today, 21);

  let docs: MenuDayRow[] = [];
  try {
    docs = await sanityServer.fetch<MenuDayRow[]>(
      `*[
          _type == "menuDay" &&
          date >= $from &&
          date <= $to &&
          customerVisible == true &&
          approvedForPublish == true &&
          !(_id in path("drafts.**"))
        ]{ date, planTier }`,
      { from: today, to: toInclusive },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, "Sanity GROQ feilet under reconcile.", 500, "sanity_fetch_failed", { message: msg });
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    console.log(`[menu-service-day-reconcile] Reconcile: 0 nye, 0 oppdaterte, 0 uendret (0 docs)`);
    return jsonOk(
      rid,
      {
        menuDays: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        from: today,
        to: toInclusive,
      },
      200,
    );
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  try {
    const admin = supabaseAdmin();

    const seen = new Set<string>();
    for (const d of docs) {
      const date = String(d?.date ?? "").trim();
      const planTier = String(d?.planTier ?? "").trim();
      if (!date || !planTier) continue;
      const k = `${date}|${planTier}`;
      if (seen.has(k)) continue;
      seen.add(k);

      const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, { date, planTier });
      if (!stats.skipped) {
        inserted += stats.inserted;
        updated += stats.updated;
        unchanged += stats.unchanged;
      }
    }

    console.log(`[menu-service-day-reconcile] Reconcile: ${inserted} nye, ${updated} oppdaterte, ${unchanged} uendret`);

    return jsonOk(
      rid,
      {
        menuDays: seen.size,
        inserted,
        updated,
        unchanged,
        from: today,
        to: toInclusive,
      },
      200,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    captureCronHandlerError("/api/cron/menu-service-day-reconcile", rid, e);
    return jsonErr(rid, "Reconcile sync feilet.", 500, "sync_failed", { message: msg });
  }
}
