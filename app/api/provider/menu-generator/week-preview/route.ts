export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { isLocalizedFixedMenuGeneratorPanelEnabled } from "@/lib/menu-generator/featureFlag";
import { buildProviderMenuGeneratorPreviewPresentation } from "@/lib/provider-menu/providerMenuGeneratorPresentation";
import { menuProfileResolverHostEnv } from "@/lib/providers/providerMenuProfileDiagnostic";
import {
  loadAndResolveProviderMenuProfile,
  loadProviderSettingsMenuProfileRow,
} from "@/lib/providers/loadProviderSettingsMenuProfile";

const VIEW_ROLE = "provider_viewer" as const;
const VALID_TIERS = new Set<PlanTier>(["BASIS", "LUXUS", "ENTERPRISE"]);

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_mgen");

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

  const env = menuProfileResolverHostEnv();
  if (!isLocalizedFixedMenuGeneratorPanelEnabled(env)) {
    return jsonErr(rid, "Lokal fast menygenerator er ikke aktiv.", 404, "NOT_ENABLED");
  }

  const weekStartRaw = String(req.nextUrl.searchParams.get("weekStart") ?? "").trim();
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(weekStartRaw)
    ? weekStartRaw
    : startOfWeekISO(osloTodayISODate());

  const tierRaw = String(req.nextUrl.searchParams.get("tier") ?? "LUXUS").trim().toUpperCase();
  const previewTier = VALID_TIERS.has(tierRaw as PlanTier) ? (tierRaw as PlanTier) : "LUXUS";

  const [settingsRow, resolver] = await Promise.all([
    loadProviderSettingsMenuProfileRow(provider.id),
    loadAndResolveProviderMenuProfile(provider.id, env),
  ]);

  const presentation = buildProviderMenuGeneratorPreviewPresentation({
    providerId: provider.id,
    settingsRow,
    resolverResult: resolver,
    weekStart,
    previewTier,
    env,
  });

  if (!presentation.active) {
    return jsonErr(rid, "Kunne ikke bygge menygenerator-preview.", 404, "NOT_AVAILABLE");
  }

  return jsonOk(rid, {
    profile: {
      country: presentation.country,
      menuLocale: presentation.menuLocale,
      menuProfileId: presentation.menuProfileId,
      currency: presentation.currency,
      vatRate: presentation.vatRate,
      enabledCategories: presentation.enabledCategories,
      fixedDishBankStatus: presentation.fixedDishBankStatus,
      economySummary: presentation.economySummary,
      fallbackWarning: presentation.fallbackWarning,
    },
    weekStart: presentation.weekStart,
    previewTier,
    employeeSafe: presentation.employeeSafePreview,
    provider: presentation.providerPreview,
  });
}
