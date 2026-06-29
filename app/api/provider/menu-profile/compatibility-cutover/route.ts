export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { isMenuProfileCompatibilityCutoverEnabled } from "@/lib/menu-profile/featureFlag";
import { buildCompatibilityCutoverEvaluation } from "@/lib/menu-profile/runtimeCompatibilityCutover.server";
import type {
  CompatibilityCutoverInput,
  CompatibilityRuntimeSnapshot,
} from "@/lib/menu-profile/runtimeCompatibilityCutoverTypes";
import {
  readLatestRuntimeMappingDraft,
  RuntimeMappingDraftPersistenceError,
  type RuntimeMappingDraftDto,
} from "@/lib/menu-profile/runtimeMappingDraftPersistence.server";
import { buildRuntimeMappingPublishShadowEvaluation } from "@/lib/menu-profile/runtimeMappingPublishShadow.server";
import type { RuntimeMappingPublishShadowInput } from "@/lib/menu-profile/runtimeMappingPublishShadowTypes";
import { buildRuntimeMappingWeekShadowEvaluation } from "@/lib/menu-profile/runtimeMappingWeekShadow.server";
import type { WeekShadowComparisonInput } from "@/lib/menu-profile/runtimeMappingWeekShadowTypes";

const ADMIN_ROLE = "provider_admin" as const;

const ZERO_COMPATIBILITY_META_COUNTERS = {
  weekResponseChanges: 0 as const,
  employeeVisibleChanges: 0 as const,
  orderChanges: 0 as const,
  publishChanges: 0 as const,
  sanityWrites: 0 as const,
  menuDayPayloadMutations: 0 as const,
  priceVisibleChanges: 0 as const,
  commercialVisibleChanges: 0 as const,
};

function flagDisabledResponse(rid: string) {
  return jsonErr(rid, "Not found.", 404, "NOT_FOUND");
}

function draftToPublishShadowInput(draft: RuntimeMappingDraftDto): RuntimeMappingPublishShadowInput {
  return {
    draftId: draft.id,
    menuProfileId: draft.menuProfileId,
    mappingVersion: draft.mappingVersion,
    sourceProfileVersion: draft.sourceProfileVersion,
    mappingJson: draft.mappingJson,
    unmappedCategoriesJson: draft.unmappedCategoriesJson,
    warmDishPreviewJson: draft.warmDishPreviewJson,
    validationSummaryJson: draft.validationSummaryJson,
    draftStatus: draft.draftStatus === "reviewed" ? "reviewed" : "draft",
  };
}

/** Safe provider evidence baseline — not live /week response, no employee/order/commercial data. */
function buildSafeCompatibilityEvidenceBaseline(draft: RuntimeMappingDraftDto) {
  return {
    days: [] as Array<{
      dateISO: string;
      weekdayKey: "mon" | "tue" | "wed" | "thu" | "fri";
      status: "evidence_only";
    }>,
    metadata: {
      evidenceKind: "provider_compatibility_evidence_baseline",
      compatibilityOnly: true,
      providerOnly: true,
      menuProfileId: draft.menuProfileId,
      mappingVersion: draft.mappingVersion,
      sourceDraftId: draft.id,
      sourceProfileVersion: draft.sourceProfileVersion ?? null,
      draftStatus: draft.draftStatus,
    },
    notes: ["Provider evidence only — not live /week response"],
  };
}

function buildSafeWeekEvidencePayload(draft: RuntimeMappingDraftDto) {
  return {
    evidenceKind: "provider_week_shadow_evidence",
    shadowOnly: true,
    providerOnly: true,
    menuProfileId: draft.menuProfileId,
    mappingVersion: draft.mappingVersion,
    sourceDraftId: draft.id,
    sourceProfileVersion: draft.sourceProfileVersion ?? null,
    draftStatus: draft.draftStatus,
    days: [] as Array<{
      dateISO: string;
      weekdayKey: "mon" | "tue" | "wed" | "thu" | "fri";
      status: "evidence_only";
    }>,
  };
}

function buildWeekShadowComparisonInput(
  draft: RuntimeMappingDraftDto,
  publishShadow: ReturnType<typeof buildRuntimeMappingPublishShadowEvaluation>,
): WeekShadowComparisonInput {
  const baseline = buildSafeWeekEvidencePayload(draft);

  return {
    menuProfileId: draft.menuProfileId,
    sourceDraftId: draft.id,
    sourceMappingVersion: draft.mappingVersion,
    currentWeekPayload: baseline,
    shadowWeekPayload: baseline,
    publishShadow: {
      shadowOnly: true,
      publishImpact: publishShadow.publishImpact,
    },
  };
}

function buildCompatibilitySnapshots(
  draft: RuntimeMappingDraftDto,
): Pick<CompatibilityCutoverInput, "currentNoRuntimeSnapshot" | "candidateProfileRuntimeSnapshot"> {
  const baseline = buildSafeCompatibilityEvidenceBaseline(draft);

  const currentNoRuntimeSnapshot: CompatibilityRuntimeSnapshot = {
    snapshotKind: "current_no_runtime",
    menuProfileId: draft.menuProfileId,
    mappingVersion: draft.mappingVersion,
    generatedAt: draft.updatedAt,
    ...baseline,
  };

  const candidateProfileRuntimeSnapshot: CompatibilityRuntimeSnapshot = {
    snapshotKind: "candidate_profile_runtime",
    menuProfileId: draft.menuProfileId,
    mappingVersion: draft.mappingVersion,
    sourceDraftId: draft.id,
    sourceMappingVersion: draft.mappingVersion,
    generatedAt: draft.updatedAt,
    days: baseline.days,
    metadata: baseline.metadata,
    notes: baseline.notes,
  };

  return { currentNoRuntimeSnapshot, candidateProfileRuntimeSnapshot };
}

function buildResponseMeta(currentNoRuntimeUnchanged: boolean | null) {
  return {
    compatibilityOnly: true as const,
    providerOnly: true as const,
    currentNoRuntimeUnchanged,
    ...ZERO_COMPATIBILITY_META_COUNTERS,
    canProceedToRuntimeHook: false as const,
    canProceedToProduction: false as const,
    productionFlagEnabled: false as const,
  };
}

async function resolveProviderAdmin(rid: string) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { error: jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED") };
  }

  const userId = String(auth.user.id).trim();
  const ctx = await getProviderAdminContext(userId);
  const provider = ctx.primaryProvider;
  if (!provider) {
    return { error: jsonErr(rid, "Ingen leverandørtilgang.", 403, "FORBIDDEN") };
  }

  const canAdmin = await hasProviderRole(userId, provider.id, ADMIN_ROLE);
  if (!canAdmin) {
    return {
      error: jsonErr(rid, "Kun leverandør-admin kan lese compatibility cutover.", 403, "FORBIDDEN"),
    };
  }

  return { userId, provider };
}

function validationErrorResponse(rid: string) {
  return jsonErr(rid, "Ugyldig mapping-utkast for compatibility cutover.", 400, "VALIDATION_FAILED");
}

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_compat_cutover");

  if (!isMenuProfileCompatibilityCutoverEnabled(process.env)) {
    return flagDisabledResponse(rid);
  }

  const resolved = await resolveProviderAdmin(rid);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { provider } = resolved as {
    userId: string;
    provider: { id: string; slug: string; name: string };
  };

  const menuProfileId = String(req.nextUrl.searchParams.get("menuProfileId") ?? "").trim();
  if (!menuProfileId) {
    return jsonErr(rid, "menuProfileId query parameter is required.", 400, "BAD_REQUEST");
  }

  if (req.nextUrl.searchParams.has("providerId")) {
    return jsonErr(rid, "providerId must not be supplied by client.", 400, "BAD_REQUEST");
  }

  try {
    const draft = await readLatestRuntimeMappingDraft({
      providerId: provider.id,
      menuProfileId,
    });

    if (!draft) {
      return jsonOk(rid, {
        compatibilityCutover: null,
        source: null,
        meta: buildResponseMeta(null),
      });
    }

    const publishShadow = buildRuntimeMappingPublishShadowEvaluation(
      draftToPublishShadowInput(draft),
    );
    const weekShadow = buildRuntimeMappingWeekShadowEvaluation(
      buildWeekShadowComparisonInput(draft, publishShadow),
    );
    const snapshots = buildCompatibilitySnapshots(draft);
    const compatibilityCutover = buildCompatibilityCutoverEvaluation({
      providerMenuProfileId: draft.menuProfileId,
      sourceDraftId: draft.id,
      sourceMappingVersion: draft.mappingVersion,
      ...snapshots,
    });

    return jsonOk(rid, {
      compatibilityCutover,
      source: {
        draftId: draft.id,
        menuProfileId: draft.menuProfileId,
        mappingVersion: draft.mappingVersion,
        sourceMappingVersion: draft.mappingVersion,
        weekShadowSource: {
          shadowOnly: true as const,
          providerOnly: true as const,
          currentWeekUnchanged: weekShadow.currentWeekUnchanged,
        },
      },
      meta: buildResponseMeta(compatibilityCutover.currentNoRuntimeUnchanged),
    });
  } catch (e) {
    if (e instanceof RuntimeMappingDraftPersistenceError) {
      if (e.code === "invalid_menu_profile_id") {
        return jsonErr(rid, "Ugyldig menuProfileId.", 400, "VALIDATION_FAILED", {
          errors: e.validationErrors,
        });
      }
      return jsonErr(rid, "Kunne ikke lese mapping-utkast.", 500, "DB_READ_FAILED");
    }
    if (
      e instanceof Error &&
      (e.message.includes("Invalid compatibility cutover input") ||
        e.message.includes("Invalid runtime mapping draft for shadow evaluation") ||
        e.message.includes("Invalid publish shadow input") ||
        e.message.includes("Invalid week shadow comparison input"))
    ) {
      return validationErrorResponse(rid);
    }
    return jsonErr(rid, "Kunne ikke evaluere compatibility cutover.", 500, "INTERNAL_ERROR");
  }
}
