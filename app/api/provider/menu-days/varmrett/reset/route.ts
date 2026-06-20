export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  deleteMenuServiceDaysForMenuDay,
  syncMenuServiceDaysForPublishedMenuDay,
} from "@/lib/menu-publish/syncMenuServiceDaysFromMenuDay";
import { VARMRETT_SHARED_TIERS } from "@/lib/provider-menu/varmrettSharedWrite";
import { resetSharedVarmrettToBaseline } from "@/lib/provider-menu/varmrettSharedWrite";
import type { MenuDayStatus } from "@/lib/provider-menu/menuDayPayload";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSanityWrite } from "@/lib/sanity/client";

const WRITE_ROLE = "provider_kitchen" as const;

async function syncPublishedTiers(
  providerId: string,
  date: string,
  status: MenuDayStatus,
): Promise<string> {
  if (status !== "published") {
    try {
      const admin = supabaseAdmin();
      for (const tier of VARMRETT_SHARED_TIERS) {
        await deleteMenuServiceDaysForMenuDay(admin, {
          date,
          planTier: tier,
          providerId,
        });
      }
    } catch {
      /* non-blocking */
    }
    return "skipped_draft";
  }

  try {
    const admin = supabaseAdmin();
    let anySynced = false;
    for (const tier of VARMRETT_SHARED_TIERS) {
      const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, {
        date,
        planTier: tier,
        providerId,
      });
      if (!stats.skipped) anySynced = true;
    }
    return anySynced ? "synced" : "pending_webhook_or_reconcile";
  } catch {
    return "pending_webhook_or_reconcile";
  }
}

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_varm_rst");

  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
  }

  const userId = String(auth.user.id).trim();
  const ctx = await getProviderAdminContext(userId);
  const provider = ctx.primaryProvider;
  if (!provider) {
    return jsonErr(rid, "Ingen leverandørtilgang.", 403, "FORBIDDEN");
  }

  const canWrite = await hasProviderRole(userId, provider.id, WRITE_ROLE);
  if (!canWrite) {
    return jsonErr(rid, "Du har ikke tilgang til å redigere meny.", 403, "FORBIDDEN");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  const date =
    body != null && typeof body === "object" && !Array.isArray(body)
      ? String((body as Record<string, unknown>).date ?? "").trim()
      : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonErr(rid, "Ugyldig dato.", 422, "VALIDATION_ERROR");
  }

  let client;
  try {
    client = requireSanityWrite();
  } catch {
    return jsonErr(rid, "Menypublisering er ikke tilgjengelig akkurat nå.", 503, "SANITY_WRITE_DISABLED");
  }

  const result = await resetSharedVarmrettToBaseline(client, provider.id, date, {
    providerSlug: provider.slug,
  });

  if (result.ok === false) {
    return jsonErr(rid, result.error, 422, "VALIDATION_ERROR");
  }

  const syncStatus = await syncPublishedTiers(provider.id, result.date, result.status);

  return jsonOk(
    rid,
    {
      date: result.date,
      status: result.status,
      syncStatus,
      warnings: result.warnings ?? [],
    },
    200,
  );
}
