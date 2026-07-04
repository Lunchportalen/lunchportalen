export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { menuProfileResolverHostEnv } from "@/lib/providers/providerMenuProfileDiagnostic";
import { loadAndResolveProviderMenuProfile } from "@/lib/providers/loadProviderSettingsMenuProfile";
import { loadProviderMenuDaysForDates } from "@/lib/provider-menu/loadProviderMenuDays";
import { mergeProviderMenuRowsIntoSlots } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { loadProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";
import {
  buildProfileWarmDishWeekSuggestions,
  resolveProfileWarmDishGenerationContext,
} from "@/lib/provider-menu/profileWarmDishGeneration";
import { weekDatesFromStart } from "@/lib/providers/providerMenuPackageSurface";

const VIEW_ROLE = "provider_viewer" as const;

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_wgen_s");

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

  const canView = await hasProviderRole(userId, provider.id, VIEW_ROLE);
  if (!canView) {
    return jsonErr(rid, "Du har ikke tilgang til meny.", 403, "FORBIDDEN");
  }

  const weekStart = String(req.nextUrl.searchParams.get("weekStart") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return jsonErr(rid, "Ugyldig weekStart.", 422, "INVALID_QUERY");
  }

  const env = menuProfileResolverHostEnv();
  const resolver = await loadAndResolveProviderMenuProfile(provider.id, env);
  const generation = resolveProfileWarmDishGenerationContext(resolver, env);
  if (generation.active === false) {
    return jsonOk(rid, { active: false, reason: generation.reason }, 200);
  }

  const dates = weekDatesFromStart(weekStart).slice(0, 5);
  const rows = await loadProviderMenuDaysForDates(provider.id, dates, {
    providerSlug: provider.slug,
  });
  const lockState = await loadProviderOrderLockState(provider.id);
  const slots = mergeProviderMenuRowsIntoSlots(
    rows.map((row) => ({
      ...row,
      approvedForPublish: row.status === "published",
      customerVisible: row.status === "published",
    })),
  );

  const suggestions = buildProfileWarmDishWeekSuggestions({
    providerId: provider.id,
    weekMondayIso: weekStart,
    profileId: generation.profileId,
    profile: generation.profile,
    slots,
    lockState,
  });

  return jsonOk(
    rid,
    {
      active: true,
      profileId: suggestions.profileId,
      market: suggestions.market,
      locale: suggestions.locale,
      source: suggestions.source,
      weekStart,
      suggestions: suggestions.suggestions.map((s) => ({
        date: s.date,
        dayIndex: s.dayIndex,
        mealTitle: s.meal.title,
        description: s.meal.description,
        allergens: [...s.meal.allergens],
        seedKey: s.meal.seedKey,
        canApply: s.canApply,
      })),
      skippedDates: suggestions.skippedDates,
    },
    200,
  );
}
