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
import {
  buildMenuDayPayload,
  parseMenuDayRequestBody,
  type MenuDayStatus,
} from "@/lib/provider-menu/menuDayPayload";
import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { canonicalMenuCategory } from "@/lib/provider-menu/menuCategoryCanonical";
import { loadProviderMenuDaysForDates, loadProviderMenuDaySlot } from "@/lib/provider-menu/loadProviderMenuDays";
import { osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { fetchLunchCategoryRowsForProvider } from "@/lib/cms/lunchCategory";
import { buildMenuCatalogSnapshot } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import {
  applyOrderLocksToCatalog,
  applyOrderLocksToMenuDayRows,
  loadProviderOrderLockState,
} from "@/lib/provider-menu/providerMenuOrderLock";
import { weekDatesFromStart } from "@/lib/providers/providerMenuPackageSurface";
import { loadProviderMenuPrices } from "@/lib/providers/providerMenuPriceConfig";
import { requireSanityWrite } from "@/lib/sanity/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WRITE_ROLE = "provider_kitchen" as const;

type SyncStatus = "synced" | "skipped_draft" | "pending_webhook_or_reconcile";

type SanitizedMenuDayResponse = {
  id: string;
  providerSlug: string;
  providerName: string;
  date: string;
  tier: string;
  category: string;
  mealTitle: string;
  status: MenuDayStatus;
  approvedForPublish: boolean;
  customerVisible: boolean;
  syncStatus: SyncStatus;
};

function sanitizeResponse(
  payload: {
    docId: string;
    providerSlug: string;
    providerName: string;
    date: string;
    tier: string;
    category: string;
    mealTitle: string;
    status: MenuDayStatus;
    approvedForPublish: boolean;
    customerVisible: boolean;
    syncStatus: SyncStatus;
  },
): SanitizedMenuDayResponse {
  return {
    id: payload.docId,
    providerSlug: payload.providerSlug,
    providerName: payload.providerName,
    date: payload.date,
    tier: payload.tier,
    category: payload.category,
    mealTitle: payload.mealTitle,
    status: payload.status,
    approvedForPublish: payload.approvedForPublish,
    customerVisible: payload.customerVisible,
    syncStatus: payload.syncStatus,
  };
}

async function resolveSyncStatus(
  status: MenuDayStatus,
  menuDay: { date: string; planTier: string; providerId: string },
): Promise<SyncStatus> {
  if (status !== "published") return "skipped_draft";

  try {
    const admin = supabaseAdmin();
    const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, {
      date: menuDay.date,
      planTier: menuDay.planTier,
      providerId: menuDay.providerId,
    });
    if (stats.skipped) return "pending_webhook_or_reconcile";
    return "synced";
  } catch {
    return "pending_webhook_or_reconcile";
  }
}

async function unpublishMenuServiceDays(menuDay: {
  date: string;
  planTier: string;
  providerId: string;
}): Promise<void> {
  try {
    const admin = supabaseAdmin();
    await deleteMenuServiceDaysForMenuDay(admin, menuDay);
  } catch {
    // Non-blocking: webhook/reconcile can self-heal.
  }
}

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_menu");

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

  const parsed = parseMenuDayRequestBody(body);
  if (!parsed) {
    return jsonErr(rid, "Ugyldig forespørsel. Sjekk alle felt.", 422, "INVALID_BODY");
  }

  const tier = String(parsed.tier ?? "").trim().toUpperCase() as PlanTier;
  const category = canonicalMenuCategory(parsed.category);
  if (!category) {
    return jsonErr(rid, "Ugyldig kategori.", 422, "VALIDATION_ERROR");
  }

  const existingSlot = await loadProviderMenuDaySlot(
    provider.id,
    { date: parsed.date, tier, category },
    { providerSlug: provider.slug },
  );

  // Ignore any client-supplied providerId — always use server-resolved provider.
  const payloadResult = buildMenuDayPayload(provider.id, parsed, { existingSlot });
  if (payloadResult.ok === false) {
    return jsonErr(rid, payloadResult.error, 422, "VALIDATION_ERROR");
  }

  let client;
  try {
    client = requireSanityWrite();
  } catch {
    return jsonErr(rid, "Menypublisering er ikke tilgjengelig akkurat nå.", 503, "SANITY_WRITE_DISABLED");
  }

  try {
    await client.createOrReplace(payloadResult.payload);
  } catch {
    return jsonErr(rid, "Kunne ikke lagre menyen. Prøv igjen.", 500, "SANITY_WRITE_FAILED");
  }

  if (payloadResult.status === "draft") {
    await unpublishMenuServiceDays({
      date: payloadResult.payload.date,
      planTier: payloadResult.payload.planTier,
      providerId: provider.id,
    });
  }

  const syncStatus = await resolveSyncStatus(payloadResult.status, {
    date: payloadResult.payload.date,
    planTier: payloadResult.payload.planTier,
    providerId: provider.id,
  });

    return jsonOk(
    rid,
    {
      ...sanitizeResponse({
        docId: payloadResult.docId,
        providerSlug: provider.slug,
        providerName: provider.name,
        date: payloadResult.payload.date,
        tier: payloadResult.payload.planTier,
        category: payloadResult.payload.category,
        mealTitle: payloadResult.payload.mealTitle,
        status: payloadResult.status,
        approvedForPublish: payloadResult.payload.approvedForPublish,
        customerVisible: payloadResult.payload.customerVisible,
        syncStatus,
      }),
      warnings: payloadResult.warnings ?? [],
    },
    200,
  );
}

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_menu");

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

  const canView = await hasProviderRole(userId, provider.id, "provider_viewer");
  if (!canView) {
    return jsonErr(rid, "Du har ikke tilgang til meny.", 403, "FORBIDDEN");
  }

  const weekStart = String(req.nextUrl.searchParams.get("weekStart") ?? "").trim();
  const base = /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? weekStart : startOfWeekISO(osloTodayISODate());
  const dates = weekDatesFromStart(base);

  const [items, prices, lunchCategoryRows, lockState] = await Promise.all([
    loadProviderMenuDaysForDates(provider.id, dates, { providerSlug: provider.slug }),
    loadProviderMenuPrices(provider.id),
    fetchLunchCategoryRowsForProvider(provider.id),
    loadProviderOrderLockState(provider.id),
  ]);

  const catalog = applyOrderLocksToCatalog(buildMenuCatalogSnapshot(lunchCategoryRows), lockState);
  const lockedItems = applyOrderLocksToMenuDayRows(items, lockState);
  const varmrettLockedDates = [...lockState.datesWithOrders].filter((d) => dates.includes(d));

  const orderCountsByDate: Record<string, number> = {};
  for (const [date, count] of lockState.orderCountsByDate.entries()) {
    orderCountsByDate[date] = count;
  }

  return jsonOk(
    rid,
    {
      weekStart: base,
      dates,
      items: lockedItems,
      prices,
      catalog,
      varmrettLockedDates,
      orderCountsByDate,
      providerId: provider.id,
      providerSlug: provider.slug,
    },
    200,
  );
}
