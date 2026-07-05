export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { writeAudit } from "@/lib/audit/log";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  applyLocalizedGeneratedWeekMenu,
} from "@/lib/menu-generator/applyLocalizedGeneratedWeekMenu";
import { parseApplyLocalizedGeneratedWeekMenuBody } from "@/lib/menu-generator/applyLocalizedGeneratedWeekMenuBody";
import { buildApplyIdempotencyKey } from "@/lib/menu-generator/applyTypes";
import { resolveProviderMenuRuntimeProfile } from "@/lib/menu-generator/resolveProviderMenuRuntimeProfile";
import { menuProfileResolverHostEnv } from "@/lib/providers/providerMenuProfileDiagnostic";
import { loadAndResolveProviderMenuProfile, loadProviderSettingsMenuProfileRow } from "@/lib/providers/loadProviderSettingsMenuProfile";
import { requireSanityWrite } from "@/lib/sanity/client";

const WRITE_ROLE = "provider_kitchen" as const;

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_mapply");

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
    return jsonErr(rid, "Du har ikke tilgang til å redigere meny.", 403, "FORBIDDEN", "provider_scope_denied");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  const parsed = parseApplyLocalizedGeneratedWeekMenuBody(body);
  if (parsed.ok === false) {
    return jsonErr(rid, parsed.message, 422, parsed.errorCode, parsed.errorCode);
  }

  const env = menuProfileResolverHostEnv();
  const [settingsRow, resolver] = await Promise.all([
    loadProviderSettingsMenuProfileRow(provider.id),
    loadAndResolveProviderMenuProfile(provider.id, env),
  ]);

  if (!settingsRow) {
    return jsonErr(rid, "Provider menyprofil mangler.", 422, "provider_profile_missing", "provider_profile_missing");
  }

  const runtimeProfile = resolveProviderMenuRuntimeProfile({
    providerId: provider.id,
    country: settingsRow.defaultCountryCode,
    menuLocale: settingsRow.locale,
    menuProfileId: settingsRow.menuProfileId,
    currency: settingsRow.defaultCurrency,
    resolverResult: resolver,
  });

  const idempotencyKey =
    parsed.input.idempotencyKey ||
    buildApplyIdempotencyKey({
      providerId: provider.id,
      weekStart: parsed.input.weekStart,
      menuLocale: runtimeProfile.menuLocale,
      menuProfileId: runtimeProfile.menuProfileId,
      overwriteMode: parsed.input.overwriteMode,
      categoryScope: parsed.input.categoryScope,
      packageTier: parsed.input.packageTier,
    });

  let sanityClient = null;
  if (!parsed.input.dryRun) {
    try {
      sanityClient = requireSanityWrite();
    } catch {
      return jsonErr(rid, "Menypublisering er ikke tilgjengelig akkurat nå.", 503, "SANITY_WRITE_DISABLED", "sanity_write_failed");
    }
  }

  const result = await applyLocalizedGeneratedWeekMenu(
    {
      env,
      settingsRow,
      resolverResult: resolver,
      sanityClient,
      providerSlug: provider.slug,
    },
    {
      providerId: provider.id,
      weekStart: parsed.input.weekStart,
      menuLocale: runtimeProfile.menuLocale,
      country: runtimeProfile.country,
      menuProfileId: runtimeProfile.menuProfileId,
      packageTier: parsed.input.packageTier,
      overwriteMode: parsed.input.overwriteMode,
      categoryScope: parsed.input.categoryScope,
      dryRun: parsed.input.dryRun,
      idempotencyKey,
      providerSlug: provider.slug,
    },
  );

  await writeAudit({
    actor_user_id: userId,
    actor_role: "kitchen",
    action: result.audit.action,
    severity: result.ok ? "info" : "warning",
    company_id: null,
    target_type: "provider",
    target_id: provider.id,
    target_label: provider.name ?? provider.id,
    before: null,
    after: {
      weekStart: result.weekStart,
      menuLocale: result.menuLocale,
      menuProfileId: result.menuProfileId,
      overwriteMode: result.overwriteMode,
      categoryScope: result.categoryScope,
      dryRun: result.audit.dryRun,
      summary: result.summary,
      appliedDates: result.audit.appliedDates,
      appliedCatalogCategories: result.audit.appliedCatalogCategories,
      generatorVersion: result.generatorVersion,
      idempotencyKey: result.idempotencyKey,
      errorCode: result.errorCode ?? null,
      catalogUpdateConfirmed: Boolean(parsed.input.catalogUpdateConfirmationToken),
      replaceCatalogConfirmationPhrase: parsed.input.replaceCatalogConfirmationPhrase ?? null,
    },
    meta: {
      surface: "provider.menu.localized_generator.apply",
      rid,
      warnings: result.warnings,
      blockedReasons: result.blockedReasons,
    },
  });

  if (!result.ok && result.errorCode) {
    const status =
      result.errorCode === "published_days_exist"
        ? 409
        : result.errorCode === "catalog_update_requires_confirmation"
          ? 422
        : result.errorCode === "sanity_write_failed"
          ? 503
          : 422;
    return jsonErr(rid, result.message ?? "Apply feilet.", status, result.errorCode, result.errorCode);
  }

  return jsonOk(rid, result, 200);
}
