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
  createProviderMenuTranslation,
  listProviderMenuTranslations,
  parseProviderTranslationCreateBody,
  parseProviderTranslationListFilters,
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

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_menu_tr");

  const resolved = await resolveProviderViewer(rid);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { provider } = resolved as {
    userId: string;
    provider: { id: string; slug: string; name: string };
  };

  let filters;
  try {
    const searchParams = req.nextUrl?.searchParams ?? new URL(req.url).searchParams;
    filters = parseProviderTranslationListFilters(searchParams);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(rid, e);
    return jsonErr(rid, "Ugyldige filtre.", 422, "VALIDATION_FAILED");
  }

  try {
    const translations = await listProviderMenuTranslations(provider.id, filters);
    return jsonOk(rid, {
      translations,
      providerId: provider.id,
      employeeTranslationsLive: false,
    });
  } catch (e) {
    if (e instanceof ProviderTranslationApprovalError) return approvalErrorResponse(rid, e);
    return jsonErr(rid, "Kunne ikke hente oversettelser.", 500, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_menu_tr");

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
    parsed = parseProviderTranslationCreateBody(body);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(rid, e);
    return jsonErr(rid, "Ugyldig forespørsel.", 422, "VALIDATION_FAILED");
  }

  try {
    const translation = await createProviderMenuTranslation(provider.id, parsed);
    return jsonOk(rid, {
      translation,
      providerId: provider.id,
      employeeTranslationsLive: false,
    });
  } catch (e) {
    if (e instanceof ProviderTranslationApprovalError) return approvalErrorResponse(rid, e);
    return jsonErr(rid, "Kunne ikke lagre oversettelse.", 500, "INTERNAL_ERROR");
  }
}
