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
import { writeGeneratedSharedVarmrettForProvider } from "@/lib/provider-menu/varmrettSharedWrite";
import { weekDatesFromStart } from "@/lib/providers/providerMenuPackageSurface";
import { requireSanityWrite } from "@/lib/sanity/client";

const WRITE_ROLE = "provider_kitchen" as const;

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_wgen");

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

  const weekStart =
    body != null && typeof body === "object" && !Array.isArray(body)
      ? String((body as Record<string, unknown>).weekStart ?? "").trim()
      : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return jsonErr(rid, "Ugyldig weekStart.", 422, "INVALID_BODY");
  }

  const env = menuProfileResolverHostEnv();
  const resolver = await loadAndResolveProviderMenuProfile(provider.id, env);
  const generation = resolveProfileWarmDishGenerationContext(resolver, env);
  if (generation.active === false) {
    return jsonErr(rid, "Profilbasert varmrettgenerering er ikke aktiv.", 404, "NOT_ENABLED");
  }

  let client;
  try {
    client = requireSanityWrite();
  } catch {
    return jsonErr(rid, "Menypublisering er ikke tilgjengelig akkurat nå.", 503, "SANITY_WRITE_DISABLED");
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

  const plan = buildProfileWarmDishWeekSuggestions({
    providerId: provider.id,
    weekMondayIso: weekStart,
    profileId: generation.profileId,
    profile: generation.profile,
    slots,
    lockState,
  });

  const applied: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ date: string; error: string }> = [];

  for (const suggestion of plan.suggestions) {
    if (!suggestion.canApply) {
      skipped.push(suggestion.date);
      continue;
    }

    const result = await writeGeneratedSharedVarmrettForProvider(
      client,
      provider.id,
      {
        date: suggestion.date,
        mealTitle: suggestion.meal.title,
        description: suggestion.meal.description,
        allergensText: suggestion.meal.allergens.join(", ") || null,
        estimatedCostPerPortion: null,
        status: "draft",
        confirmWarnings: true,
      },
      { providerSlug: provider.slug },
    );

    if (result.ok === false) {
      errors.push({ date: suggestion.date, error: result.error });
      skipped.push(suggestion.date);
    } else {
      applied.push(suggestion.date);
    }
  }

  for (const date of plan.skippedDates) {
    if (!skipped.includes(date)) skipped.push(date);
  }

  return jsonOk(
    rid,
    {
      weekStart,
      profileId: plan.profileId,
      source: plan.source,
      appliedDates: applied,
      skippedDates: [...new Set(skipped)],
      errors,
    },
    200,
  );
}
