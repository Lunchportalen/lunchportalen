export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { isMenuProfilePublishShadowEnabled } from "@/lib/menu-profile/featureFlag";
import {
  readLatestRuntimeMappingDraft,
  RuntimeMappingDraftPersistenceError,
  type RuntimeMappingDraftDto,
} from "@/lib/menu-profile/runtimeMappingDraftPersistence.server";
import { buildRuntimeMappingPublishShadowEvaluation } from "@/lib/menu-profile/runtimeMappingPublishShadow.server";
import type { RuntimeMappingPublishShadowInput } from "@/lib/menu-profile/runtimeMappingPublishShadowTypes";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

const ADMIN_ROLE = "provider_admin" as const;

const SHADOW_RESPONSE_META = {
  shadowOnly: true as const,
  runtimeWrites: 0 as const,
  sanityWrites: 0 as const,
  orderChanges: 0 as const,
  weekChanges: 0 as const,
  employeeVisibleChanges: 0 as const,
};

function flagDisabledResponse(rid: string) {
  return jsonErr(rid, "Not found.", 404, "NOT_FOUND");
}

function draftToShadowInput(draft: RuntimeMappingDraftDto): RuntimeMappingPublishShadowInput {
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
    return { error: jsonErr(rid, "Kun leverandør-admin kan vurdere publish shadow.", 403, "FORBIDDEN") };
  }

  return { userId, provider };
}

function validationErrorResponse(rid: string) {
  return jsonErr(rid, "Ugyldig mapping-utkast for publish shadow.", 400, "VALIDATION_FAILED");
}

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_pub_shadow");

  if (!isMenuProfilePublishShadowEnabled(process.env)) {
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
        shadow: null,
        source: null,
        meta: SHADOW_RESPONSE_META,
      });
    }

    const shadow = buildRuntimeMappingPublishShadowEvaluation(draftToShadowInput(draft));

    return jsonOk(rid, {
      shadow,
      source: {
        draftId: draft.id,
        menuProfileId: draft.menuProfileId,
        mappingVersion: draft.mappingVersion,
      },
      meta: SHADOW_RESPONSE_META,
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
      (e.message.includes("Invalid runtime mapping draft for shadow evaluation") ||
        e.message.includes("Invalid publish shadow input"))
    ) {
      return validationErrorResponse(rid);
    }
    return jsonErr(rid, "Kunne ikke evaluere publish shadow.", 500, "INTERNAL_ERROR");
  }
}
