// GET /api/cron/menu-service-day-reconcile — backup sync Sanity menuDay → menu_service_days
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";
import { resolveMenuDayProviderScope } from "@/lib/menu-publish/resolveMenuDayProvider";
import { syncMenuServiceDaysForPublishedMenuDay } from "@/lib/menu-publish/syncMenuServiceDaysFromMenuDay";
import { sanityServer } from "@/lib/sanity/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type MenuDayRow = { date?: string | null; planTier?: string | null; providerRef?: string | null };

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
        ]{ date, planTier, "providerRef": provider._ref }`,
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
  let failed = 0;
  let skippedNoProvider = 0;
  let skippedUnknownProvider = 0;

  const admin = supabaseAdmin();

  // Provider-isolation: hver menuDay reconciles kun innenfor egen provider.
  // Fail-closed: dokument uten provider-ref, eller ukjent provider, skippes
  // kontrollert — aldri global sync. Mapping caches per kjøring.
  const providerIdByRef = new Map<string, string | null>();
  async function providerIdForRef(ref: string): Promise<string | null> {
    if (providerIdByRef.has(ref)) return providerIdByRef.get(ref) ?? null;
    const result = await resolveMenuDayProviderScope(admin, ref);
    if (result.ok === false && result.reason === "LOOKUP_FAILED") {
      // Transient infra-feil → telles som failed (retry neste kjøring), ikke skip.
      throw new Error(`provider lookup: ${result.detail ?? "LOOKUP_FAILED"}`);
    }
    const id = result.ok === true ? result.scope.providerId : null;
    providerIdByRef.set(ref, id);
    return id;
  }

  const seen = new Set<string>();
  for (const d of docs) {
    const date = String(d?.date ?? "").trim();
    const planTier = String(d?.planTier ?? "").trim();
    const providerRef = String(d?.providerRef ?? "").trim();
    if (!date || !planTier) continue;

    if (!providerRef) {
      skippedNoProvider += 1;
      continue;
    }

    const k = `${providerRef}|${date}|${planTier}`;
    if (seen.has(k)) continue;
    seen.add(k);

    try {
      const providerId = await providerIdForRef(providerRef);
      if (!providerId) {
        skippedUnknownProvider += 1;
        continue;
      }

      const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, { date, planTier, providerId });
      if (!stats.skipped) {
        inserted += stats.inserted;
        updated += stats.updated;
        unchanged += stats.unchanged;
      }
    } catch (e: unknown) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      const pgCodeMatch = msg.match(/\b(23\d{3})\b/);
      const locationMatch = msg.match(/location_id=([0-9a-f-]{36})/i);
      opsLog("cron.menu_service_day_reconcile.sync_failed", {
        rid,
        level: "error",
        date,
        plan_tier: planTier,
        location_id: locationMatch?.[1] ?? null,
        error_code: pgCodeMatch?.[1] ?? "sync_failed",
        message: msg,
      });
      captureCronHandlerError("/api/cron/menu-service-day-reconcile", rid, e, {
        date,
        error_code: pgCodeMatch?.[1] ?? "sync_failed",
        location_id: locationMatch?.[1] ?? null,
      });
    }
  }

  if (skippedNoProvider > 0) {
    opsLog("menu_day_sync.skipped", {
      rid,
      level: "warn",
      reason: "missing_provider_scope",
      source: "reconcile",
      skipped_docs: skippedNoProvider,
      from: today,
      to: toInclusive,
    });
  }
  if (skippedUnknownProvider > 0) {
    opsLog("menu_day_sync.skipped", {
      rid,
      level: "warn",
      reason: "provider_not_found",
      source: "reconcile",
      skipped_docs: skippedUnknownProvider,
      from: today,
      to: toInclusive,
    });
  }

  const skippedProviderTotal = skippedNoProvider + skippedUnknownProvider;
  console.log(
    `[menu-service-day-reconcile] Reconcile: ${inserted} nye, ${updated} oppdaterte, ${unchanged} uendret, ${failed} feilet, ${skippedProviderTotal} uten provider-scope`,
  );

  if (failed > 0 && inserted === 0 && updated === 0 && unchanged === 0) {
    return jsonErr(rid, "Reconcile sync feilet for alle menuDay.", 500, "sync_failed", { failed });
  }

  return jsonOk(
    rid,
    {
      menuDays: seen.size,
      inserted,
      updated,
      unchanged,
      failed,
      skippedNoProvider: skippedProviderTotal,
      from: today,
      to: toInclusive,
    },
    200,
  );
}
