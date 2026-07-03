export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { ZodError } from "zod";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  parseProviderTranslationPatchBody,
  patchProviderMenuTranslation,
  ProviderTranslationApprovalError,
} from "@/lib/smart-menu/providerTranslationApproval";

const WRITE_ROLE = "provider_admin" as const;
const VIEW_ROLE = "provider_viewer" as const;

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
    return { error: jsonErr(rid, "Du har ikke tilgang til oversettelser.", 403, "FORBIDDEN") };
  }

  return { userId, provider };
}

function zodErrorResponse(rid: string, error: ZodError) {
  return jsonErr(rid, "Ugyldig forespørsel.", 422, "VALIDATION_FAILED", {
    errors: error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function approvalErrorResponse(rid: string, error: ProviderTranslationApprovalError) {
  if (error.code === "approve_requires_text" || error.code === "validation_failed") {
    return jsonErr(rid, error.message, 422, error.code.toUpperCase(), { field: error.field });
  }
  if (error.code === "not_found") {
    return jsonErr(rid, error.message, 404, "NOT_FOUND");
  }
  return jsonErr(rid, error.message, 500, error.code.toUpperCase());
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const rid = makeRid("prov_menu_tr");
  const { id } = await ctx.params;

  const resolved = await resolveProviderViewer(rid);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { userId, provider } = resolved as {
    userId: string;
    provider: { id: string; slug: string; name: string };
  };

  const canWrite = await hasProviderRole(userId, provider.id, WRITE_ROLE);
  if (!canWrite) {
    return jsonErr(rid, "Kun leverandør-admin kan administrere oversettelser.", 403, "FORBIDDEN");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  let parsed;
  try {
    parsed = parseProviderTranslationPatchBody(body);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(rid, e);
    return jsonErr(rid, "Ugyldig forespørsel.", 422, "VALIDATION_FAILED");
  }

  try {
    const translation = await patchProviderMenuTranslation(provider.id, userId, id, parsed);
    return jsonOk(rid, {
      translation,
      providerId: provider.id,
      employeeTranslationsLive: false,
    });
  } catch (e) {
    if (e instanceof ProviderTranslationApprovalError) return approvalErrorResponse(rid, e);
    return jsonErr(rid, "Kunne ikke oppdatere oversettelse.", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(_req: NextRequest) {
  const rid = makeRid("prov_menu_tr");
  return jsonErr(rid, "Sletting er ikke støttet.", 405, "METHOD_NOT_ALLOWED");
}
