// POST /api/webhooks/sanity/menu-day — Sanity Content Lake → menu_service_days (lag 6 core)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import {
  deleteMenuServiceDaysForMenuDay,
  syncMenuServiceDaysForPublishedMenuDay,
} from "@/lib/menu-publish/syncMenuServiceDaysFromMenuDay";
import {
  extractMenuDayFromSanityWebhookBody,
  menuDayIsPublishVisible,
} from "@/lib/menu-publish/sanityMenuDayWebhookBody";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { SANITY_WEBHOOK_SIGNATURE_HEADER, verifySanityWebhookSignature } from "@/lib/sanity/verifySanityWebhookSignature";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  const rid = makeRid("wh_menu");

  const secret = safeTrim(process.env.SANITY_WEBHOOK_SECRET);
  if (!secret) {
    return jsonErr(rid, "SANITY_WEBHOOK_SECRET er ikke konfigurert.", 500, "WEBHOOK_SECRET_MISSING");
  }

  const rawBody = await req.text();
  const sig = req.headers.get(SANITY_WEBHOOK_SIGNATURE_HEADER);
  const okSig = await verifySanityWebhookSignature({ rawBody, signatureHeader: sig, secret });

  if (!okSig) {
    return jsonErr(rid, "Ugyldig webhook-signatur.", 401, "INVALID_WEBHOOK_SIGNATURE");
  }

  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = null;
  }

  const doc = extractMenuDayFromSanityWebhookBody(parsed);
  if (!doc) {
    return jsonOk(
      rid,
      {
        skipped: true,
        reason: "NOT_MENU_DAY_PAYLOAD",
        inserted: 0,
        updated: 0,
        unchanged: 0,
        deleted: 0,
        locations: 0,
        msdiRowsUpserted: 0,
        msdiLocationsSkippedNoTier: 0,
      },
      200,
    );
  }

  const date = safeTrim(doc.date);
  const planTier = safeTrim(doc.planTier);

  if (!date || !planTier) {
    return jsonOk(
      rid,
      {
        skipped: true,
        reason: "MISSING_DATE_OR_PLAN_TIER",
        inserted: 0,
        updated: 0,
        unchanged: 0,
        deleted: 0,
        locations: 0,
        msdiRowsUpserted: 0,
        msdiLocationsSkippedNoTier: 0,
      },
      200,
    );
  }

  try {
    const admin = supabaseAdmin();

    if (!menuDayIsPublishVisible(doc)) {
      const { deleted } = await deleteMenuServiceDaysForMenuDay(admin, { date, planTier });
      return jsonOk(
        rid,
        { skipped: false, unpublished: true, deleted, inserted: 0, updated: 0, unchanged: 0, locations: 0, msdiRowsUpserted: 0, msdiLocationsSkippedNoTier: 0 },
        200,
      );
    }

    const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, { date, planTier });

    return jsonOk(
      rid,
      {
        skipped: stats.skipped,
        reason: stats.reason ?? null,
        inserted: stats.inserted,
        updated: stats.updated,
        unchanged: stats.unchanged,
        deleted: 0,
        locations: stats.locationCount,
        msdiRowsUpserted: stats.msdiRowsUpserted ?? 0,
        msdiLocationsSkippedNoTier: stats.msdiLocationsSkippedNoTier ?? 0,
      },
      200,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    // FORCE log full detail to Vercel logs (allowDetail skjuler det i body)
    console.error("[sanity-webhook] SYNC_FAILED", {
      rid,
      message: msg,
      stack,
      date,
      planTier,
      menuDayId: doc["_id"],
    });
    return jsonErr(rid, "Kunne ikke synkronisere menu_service_days.", 500, "SYNC_FAILED", { message: msg });
  }
}
