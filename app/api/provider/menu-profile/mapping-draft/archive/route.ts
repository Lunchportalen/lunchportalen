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
  archiveRuntimeMappingDraft,
  RuntimeMappingDraftPersistenceError,
} from "@/lib/menu-profile/runtimeMappingDraftPersistence.server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

const WRITE_ROLE = "provider_admin" as const;

function flagDisabledResponse(rid: string) {
  return jsonErr(rid, "Not found.", 404, "NOT_FOUND");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_map_arch");

  if (!isMenuProfileMappingDraftApiEnabled(process.env)) {
    return flagDisabledResponse(rid);
  }

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
    return jsonErr(rid, "Kun leverandør-admin kan arkivere mapping-utkast.", 403, "FORBIDDEN");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  if (!isPlainObject(body)) {
    return jsonErr(rid, "Request body must be a JSON object.", 400, "BAD_REQUEST");
  }

  if (body.providerId !== undefined) {
    return jsonErr(rid, "providerId must not be supplied by client.", 400, "BAD_REQUEST");
  }

  const draftId = String(body.draftId ?? "").trim();
  if (!draftId) {
    return jsonErr(rid, "draftId is required.", 400, "BAD_REQUEST");
  }

  try {
    const draft = await archiveRuntimeMappingDraft({
      providerId: provider.id,
      userId,
      draftId,
    });
    return jsonOk(rid, { draft });
  } catch (e) {
    if (e instanceof RuntimeMappingDraftPersistenceError) {
      if (e.code === "draft_not_found") {
        return jsonErr(rid, "Fant ikke mapping-utkast.", 404, "NOT_FOUND");
      }
      if (e.code === "draft_already_archived") {
        return jsonErr(rid, "Utkastet er allerede arkivert.", 409, "ALREADY_ARCHIVED");
      }
      return jsonErr(rid, "Kunne ikke arkivere mapping-utkast.", 500, e.code.toUpperCase());
    }
    return jsonErr(rid, "Kunne ikke arkivere mapping-utkast.", 500, "INTERNAL_ERROR");
  }
}
