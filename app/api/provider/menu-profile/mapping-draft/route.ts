export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { isMenuProfileMappingDraftApiEnabled } from "@/lib/menu-profile/featureFlag";
import {
  createRuntimeMappingDraft,
  parseRuntimeMappingDraftRequest,
  readLatestRuntimeMappingDraft,
  RuntimeMappingDraftPersistenceError,
} from "@/lib/menu-profile/runtimeMappingDraftPersistence.server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

const WRITE_ROLE = "provider_admin" as const;
const VIEW_ROLE = "provider_viewer" as const;

function flagDisabledResponse(rid: string) {
  return jsonErr(rid, "Not found.", 404, "NOT_FOUND");
}

async function resolveProviderViewer(rid: string) {
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

  const canView = await hasProviderRole(userId, provider.id, VIEW_ROLE);
  if (!canView) {
    return { error: jsonErr(rid, "Du har ikke tilgang til meny.", 403, "FORBIDDEN") };
  }

  return { userId, provider };
}

function validationErrorResponse(
  rid: string,
  errors: { code: string; path: string; message: string }[],
) {
  return jsonErr(rid, "Ugyldig mapping-utkast.", 400, "VALIDATION_FAILED", { errors });
}

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_map_draft");

  if (!isMenuProfileMappingDraftApiEnabled(process.env)) {
    return flagDisabledResponse(rid);
  }

  const resolved = await resolveProviderViewer(rid);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { provider } = resolved as {
    userId: string;
    provider: { id: string; slug: string; name: string };
  };

  const menuProfileId = String(req.nextUrl.searchParams.get("menuProfileId") ?? "").trim();
  if (!menuProfileId) {
    return jsonErr(rid, "menuProfileId query parameter is required.", 400, "BAD_REQUEST");
  }

  try {
    const draft = await readLatestRuntimeMappingDraft({
      providerId: provider.id,
      menuProfileId,
    });
    return jsonOk(rid, { draft });
  } catch (e) {
    if (e instanceof RuntimeMappingDraftPersistenceError) {
      if (e.code === "invalid_menu_profile_id") {
        return validationErrorResponse(rid, e.validationErrors);
      }
      return jsonErr(rid, "Kunne ikke lese mapping-utkast.", 500, "DB_READ_FAILED");
    }
    return jsonErr(rid, "Kunne ikke lese mapping-utkast.", 500, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_map_draft");

  if (!isMenuProfileMappingDraftApiEnabled(process.env)) {
    return flagDisabledResponse(rid);
  }

  const resolved = await resolveProviderViewer(rid);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { userId, provider } = resolved as {
    userId: string;
    provider: { id: string; slug: string; name: string };
  };

  const canWrite = await hasProviderRole(userId, provider.id, WRITE_ROLE);
  if (!canWrite) {
    return jsonErr(rid, "Kun leverandør-admin kan lagre mapping-utkast.", 403, "FORBIDDEN");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  const parsed = parseRuntimeMappingDraftRequest(body);
  if (parsed.ok === false) {
    return jsonErr(rid, parsed.message, 400, "BAD_REQUEST");
  }

  try {
    const result = await createRuntimeMappingDraft({
      providerId: provider.id,
      userId,
      request: parsed.value,
    });
    return jsonOk(rid, {
      draft: result.draft,
      validationSummary: result.draft.validationSummaryJson,
    });
  } catch (e) {
    if (e instanceof RuntimeMappingDraftPersistenceError) {
      if (e.code === "validation_failed") {
        return validationErrorResponse(rid, e.validationErrors);
      }
      return jsonErr(rid, "Kunne ikke lagre mapping-utkast.", 500, e.code.toUpperCase());
    }
    return jsonErr(rid, "Kunne ikke lagre mapping-utkast.", 500, "INTERNAL_ERROR");
  }
}
