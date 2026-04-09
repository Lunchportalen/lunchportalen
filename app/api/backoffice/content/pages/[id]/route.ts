import type { NextRequest } from "next/server";
import { ensureRemoteBackendCmsHarnessContentIfEnabled } from "@/lib/auth/remoteBackendCmsHarness";
import { validateBodyPayloadBlockAllowlist } from "@/lib/cms/blockAllowlistGovernance";
import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { getMergedBlockEditorDataTypesRecord } from "@/lib/cms/blocks/blockEditorDataTypeMerged.server";
import { getMergedDocumentTypeDefinitionsRecord } from "@/lib/cms/schema/documentTypeDefinitionMerged.server";
import { mergeInvariantLayerIntoBody } from "@/lib/cms/variantInvariantPropagation";
import { LP_CMS_CLIENT_HEADER, LP_CMS_CLIENT_CONTENT_WORKSPACE } from "@/lib/cms/cmsClientHeaders";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import {
  recordCmsPagePatchMissingHeader,
  recordCmsStrictRejection,
} from "@/lib/system/controlPlaneMetrics";
import { isStrictCms } from "@/lib/system/controlStrict";
import {
  getLocalDevContentReservePageById,
  isContentBackendUnavailableError,
  isLocalDevContentReserveEnabled,
} from "@/lib/cms/contentLocalDevReserve";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, q } from "@/lib/http/routeGuard";
import { recordPageContentVersion } from "@/lib/backoffice/content/pageVersionsRepo";
import {
  getLocalCmsPageDetail,
  isLocalCmsRuntimeError,
  patchLocalCmsPage,
} from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { opsLog } from "@/lib/ops/log";
import { scheduleAuditEvent } from "@/lib/security/audit";
import { securityContextFromAuthedCtx } from "@/lib/security/context";
import { supabaseAdmin } from "@/lib/supabase/admin";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

function deriveChangedFieldLabels(params: {
  titleDefined: boolean;
  slugDefined: boolean;
  statusDefined: boolean;
  bodyDefined: boolean;
  resolvedBodyPayload: unknown;
}): string[] {
  const out: string[] = [];
  if (params.titleDefined) out.push("Tittel");
  if (params.slugDefined) out.push("Slug");
  if (params.statusDefined) out.push("Status");
  if (params.bodyDefined) {
    out.push("Innhold");
    const body = params.resolvedBodyPayload;
    if (body && typeof body === "object" && !Array.isArray(body) && "blocks" in body) {
      const blocks = (body as { blocks?: unknown }).blocks;
      if (Array.isArray(blocks)) {
        for (const b of blocks) {
          if (b && typeof b === "object" && "type" in b) {
            const t = String((b as { type?: string }).type ?? "").toLowerCase();
            if (t.includes("cta") && !out.includes("CTA")) out.push("CTA");
          }
        }
      }
    }
  }
  return out;
}

const DEFAULT_LOCALE = "nb";
const DEFAULT_ENV = "prod";

type PageRow = {
  id: string;
  title: string | null;
  slug: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
};

type VariantRow = {
  id: string;
  body: unknown;
  locale?: string | null;
  environment?: string | null;
};

function buildPayload(pageRow: PageRow, variantRow: VariantRow | null, locale: string, environment: string) {
  const body = variantRow?.body ?? { version: 1, blocks: [] };
  const variant = variantRow
    ? {
        id: variantRow.id,
        locale: variantRow.locale ?? locale,
        environment: variantRow.environment ?? environment,
      }
    : { id: null as string | null, locale, environment };

  return {
    id: pageRow.id,
    title: pageRow.title ?? "",
    slug: pageRow.slug ?? "",
    status: pageRow.status ?? "draft",
    created_at: pageRow.created_at ?? null,
    updated_at: pageRow.updated_at ?? pageRow.created_at ?? null,
    published_at: pageRow.published_at ?? null,
    body,
    page: {
      id: pageRow.id,
      title: pageRow.title ?? "",
      slug: pageRow.slug ?? "",
      status: pageRow.status ?? "draft",
      created_at: pageRow.created_at ?? null,
      updated_at: pageRow.updated_at ?? pageRow.created_at ?? null,
      published_at: pageRow.published_at ?? null,
      body,
      variantId: variantRow?.id ?? null,
    },
    variant,
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: pageId } = await context.params;
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const locale = q(request, "locale") ?? DEFAULT_LOCALE;
  const environment = q(request, "environment") ?? DEFAULT_ENV;
  if (!pageId?.trim()) return jsonErr(ctx.rid, "Mangler page id.", 400, "BAD_REQUEST");

  try {
    if (isLocalCmsRuntimeEnabled()) {
      const payload = getLocalCmsPageDetail({ pageId, locale, environment });
      return jsonOk(ctx.rid, payload, 200);
    }

    if (isLocalDevContentReserveEnabled()) {
      const reservePage = getLocalDevContentReservePageById(pageId);
      if (!reservePage) {
        return jsonErr(ctx.rid, "Side ikke funnet i lokal reserve.", 404, "NOT_FOUND");
      }

      return jsonOk(
        ctx.rid,
        buildPayload(
          {
            id: reservePage.id,
            title: reservePage.title,
            slug: reservePage.slug,
            status: reservePage.status,
            created_at: reservePage.created_at,
            updated_at: reservePage.updated_at,
            published_at: reservePage.published_at,
          },
          {
            id: `local-dev-${reservePage.id}`,
            body: reservePage.body,
            locale,
            environment,
          },
          locale,
          environment,
        ),
        200,
      );
    }

    await ensureRemoteBackendCmsHarnessContentIfEnabled();

    const supabase = supabaseAdmin();
    const { data: pageRow, error: pageErr } = await supabase
      .from("content_pages")
      .select("id, title, slug, status, created_at, updated_at, published_at")
      .eq("id", pageId)
      .maybeSingle();

    if (pageErr) throw pageErr;
    if (!pageRow) return jsonErr(ctx.rid, "Side ikke funnet.", 404, "NOT_FOUND");

    const { data: variantByLocale } = await supabase
      .from("content_page_variants")
      .select("id, body, locale, environment")
      .eq("page_id", pageId)
      .eq("locale", locale)
      .eq("environment", environment)
      .maybeSingle();

    const variantRow = variantByLocale ?? null;
    if (!variantRow) {
      return jsonErr(ctx.rid, "Forespurt variant finnes ikke.", 404, "VARIANT_NOT_FOUND", {
        pageId,
        locale,
        environment,
      });
    }

    const payload = buildPayload(pageRow, variantRow, locale, environment);
    return jsonOk(ctx.rid, payload, 200);
  } catch (e) {
    if (isLocalCmsRuntimeError(e)) {
      return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
    }
    if (isContentBackendUnavailableError(e)) {
      return jsonErr(
        ctx.rid,
        "Content-backenden svarte ikke. Kontroller Supabase-runtime for dette miljøet, eller aktiver LOCAL_DEV_CONTENT_RESERVE=true eksplisitt.",
        503,
        "CONTENT_BACKEND_UNREACHABLE",
      );
    }
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}

/** PATCH: update page/variant. Used for both manual edits and CRO-applied meta; same auth (superadmin only). */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: pageId } = await context.params;
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  if (!pageId?.trim()) return jsonErr(ctx.rid, "Mangler page id.", 400, "BAD_REQUEST");

  const localRuntimeEnabled = isLocalCmsRuntimeEnabled();

  if (!localRuntimeEnabled && isLocalDevContentReserveEnabled()) {
    return jsonErr(
      ctx.rid,
      "Lokal content-reserve er skrivebeskyttet. Deaktiver LOCAL_DEV_CONTENT_RESERVE for å lagre mot ekte backend.",
      503,
      "LOCAL_DEV_CONTENT_RESERVE_READONLY",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const titleRaw = typeof o.title === "string" ? o.title.trim() : undefined;
  const slugRaw = typeof o.slug === "string" ? o.slug.trim() : undefined;
  const statusRaw = o.status;
  const bodyPayload = o.body;
  const blocksTop = o.blocks;
  const variantPayloadRequested = bodyPayload !== undefined || blocksTop !== undefined;
  let resolvedBodyPayload: unknown = bodyPayload;
  const locale = typeof o.locale === "string" ? o.locale.trim() || DEFAULT_LOCALE : DEFAULT_LOCALE;
  const environment = o.environment === "staging" || o.environment === "preview" ? o.environment : DEFAULT_ENV;

  if (titleRaw !== undefined && (titleRaw.length < 1 || titleRaw.length > 120)) {
    return jsonErr(ctx.rid, "title må være 1–120 tegn.", 400, "VALIDATION_ERROR");
  }

  const normalizeSlug = (s: string): string =>
    s.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (slugRaw !== undefined) {
    const n = normalizeSlug(slugRaw);
    if (n.length < 1 || n.length > 120) {
      return jsonErr(ctx.rid, "slug må være 1–120 tegn.", 400, "VALIDATION_ERROR");
    }
  }

  const status = statusRaw === "published" || statusRaw === "draft" ? statusRaw : undefined;

  return withCmsPageDocumentGate("api/backoffice/content/pages/[id]/PATCH", async () => {
  try {
    if (localRuntimeEnabled) {
      const result = patchLocalCmsPage({
        pageId,
        title: titleRaw,
        slug: slugRaw,
        status,
        body: bodyPayload,
        blocks: blocksTop,
        locale,
        environment,
        actorUserId: ctx.scope?.userId ?? null,
        actorEmail: ctx.scope?.email ?? null,
      });
      return jsonOk(ctx.rid, result, 200);
    }

    const supabase = supabaseAdmin();
    let existingVariant:
      | {
          id: string;
          body: unknown;
        }
      | null = null;

    if (variantPayloadRequested) {
      const { data: existingVariantRow, error: existingVariantErr } = await supabase
        .from("content_page_variants")
        .select("id, body")
        .eq("page_id", pageId)
        .eq("locale", locale)
        .eq("environment", environment)
        .maybeSingle();
      if (existingVariantErr) throw existingVariantErr;
      existingVariant = existingVariantRow
        ? {
            id: existingVariantRow.id,
            body: existingVariantRow.body,
          }
        : null;
    }

    if (blocksTop !== undefined) {
      if (!Array.isArray(blocksTop)) {
        return jsonErr(ctx.rid, "blocks må være en array.", 400, "VALIDATION_ERROR");
      }
      const prev =
        bodyPayload !== undefined && typeof bodyPayload === "object" && bodyPayload !== null && !Array.isArray(bodyPayload)
          ? ({ ...(bodyPayload as Record<string, unknown>) } as Record<string, unknown>)
          : existingVariant?.body &&
                typeof existingVariant.body === "object" &&
                !Array.isArray(existingVariant.body)
            ? ({ ...(existingVariant.body as Record<string, unknown>) } as Record<string, unknown>)
            : ({ version: 1 } as Record<string, unknown>);
      resolvedBodyPayload = { ...prev, blocks: blocksTop };
    }

    if (resolvedBodyPayload !== undefined) {
      const mergedDt = getMergedBlockEditorDataTypesRecord();
      const mergedDoc = getMergedDocumentTypeDefinitionsRecord();
      const allow = validateBodyPayloadBlockAllowlist(resolvedBodyPayload, mergedDt, mergedDoc);
      if (allow.ok === false) {
        if (allow.error === "INVALID_DOCUMENT_TYPE") {
          return jsonErr(
            ctx.rid,
            `Ukjent dokumenttype «${allow.documentType}».`,
            422,
            "INVALID_DOCUMENT_TYPE",
            { documentType: allow.documentType },
          );
        }
        return jsonErr(
          ctx.rid,
          "En eller flere blokktyper er ikke tillatt for valgt dokumenttype.",
          422,
          "BLOCK_TYPES_NOT_ALLOWED",
          { documentType: allow.documentType, forbidden: allow.forbidden },
        );
      }
      const okHeader = request.headers.get(LP_CMS_CLIENT_HEADER) === LP_CMS_CLIENT_CONTENT_WORKSPACE;
      if (!okHeader) {
        recordCmsPagePatchMissingHeader();
        if (isStrictCms()) {
          recordCmsStrictRejection("Page body PATCH without ContentWorkspace header");
          return jsonErr(
            ctx.rid,
            "CMS strict: ContentWorkspace-klient påkrevd for lagring av body.",
            403,
            "CMS_CONTROL_PLANE",
          );
        }
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[CMS] Page body PATCH without ContentWorkspace client header — expected",
            LP_CMS_CLIENT_HEADER,
            "=",
            LP_CMS_CLIENT_CONTENT_WORKSPACE,
          );
        }
      }
    }
    const now = new Date().toISOString();

    const pageUpdates: Record<string, unknown> = {};
    if (titleRaw !== undefined) pageUpdates.title = titleRaw;
    if (slugRaw !== undefined) pageUpdates.slug = normalizeSlug(slugRaw);
    if (status !== undefined) {
      pageUpdates.status = status;
      if (status === "published") pageUpdates.published_at = now;
      else if (status === "draft") pageUpdates.published_at = null;
    }

    if (Object.keys(pageUpdates).length > 0) {
      pageUpdates.updated_at = now;
      const { error: updateErr } = await supabase.from("content_pages").update(pageUpdates).eq("id", pageId);
      if (updateErr) {
        if (updateErr.code === "23505") {
          return jsonErr(ctx.rid, "Slug already exists", 409, "SLUG_TAKEN");
        }
        throw updateErr;
      }
    }

    if (variantPayloadRequested && resolvedBodyPayload !== undefined) {
      if (existingVariant?.id) {
        const { error: vErr } = await supabase
          .from("content_page_variants")
          .update({ body: resolvedBodyPayload, updated_at: now })
          .eq("id", existingVariant.id);
        if (vErr) throw vErr;
      } else {
        const { error: vInsErr } = await supabase.from("content_page_variants").insert({
          page_id: pageId,
          locale,
          environment,
          body: resolvedBodyPayload,
          updated_at: now,
        });
        if (vInsErr) throw vInsErr;
      }

      const envParsed = parseBodyEnvelope(resolvedBodyPayload);
      const docKey = envParsed.documentType != null ? String(envParsed.documentType).trim() : "";
      const mergedDocs = getMergedDocumentTypeDefinitionsRecord();
      const docForInv = docKey ? mergedDocs[docKey] ?? null : null;
      const inv = envParsed.invariantFields;
      if (docForInv && inv && typeof inv === "object" && !Array.isArray(inv) && Object.keys(inv).length > 0) {
        const { data: allVar, error: allVarErr } = await supabase
          .from("content_page_variants")
          .select("id, body")
          .eq("page_id", pageId)
          .eq("environment", environment);
        if (allVarErr) throw allVarErr;
        for (const row of allVar ?? []) {
          const rid = row && typeof row === "object" && "id" in row ? String((row as { id: string }).id) : "";
          const prevBody = (row as { body: unknown }).body;
          const nextBody = mergeInvariantLayerIntoBody(prevBody, inv, docForInv);
          if (JSON.stringify(nextBody) !== JSON.stringify(prevBody)) {
            const { error: propErr } = await supabase
              .from("content_page_variants")
              .update({ body: nextBody, updated_at: now })
              .eq("id", rid);
            if (propErr) throw propErr;
          }
        }
      }
    }

    const { data: pageRowAfter } = await supabase
      .from("content_pages")
      .select("id, title, slug, status, created_at, updated_at, published_at")
      .eq("id", pageId)
      .maybeSingle();
    const { data: variantAfter } = await supabase
      .from("content_page_variants")
      .select("id, body, locale, environment")
      .eq("page_id", pageId)
      .eq("locale", locale)
      .eq("environment", environment)
      .maybeSingle();
    if (!pageRowAfter) {
      return jsonErr(ctx.rid, "Siden mangler etter lagring.", 409, "PAGE_MISSING_AFTER_UPDATE", {
        pageId,
      });
    }
    const pageForClient = pageRowAfter
      ? {
          id: pageRowAfter.id,
          title: pageRowAfter.title ?? "",
          slug: pageRowAfter.slug ?? "",
          status: pageRowAfter.status ?? "draft",
          created_at: pageRowAfter.created_at ?? null,
          updated_at: pageRowAfter.updated_at ?? pageRowAfter.created_at ?? null,
          published_at: pageRowAfter.published_at ?? null,
          body: variantAfter?.body ?? { version: 1, blocks: [] },
          variantId: variantAfter?.id ?? null,
        }
      : null;

    const hadWrites = Object.keys(pageUpdates).length > 0 || resolvedBodyPayload !== undefined;
    let versionRecorded: boolean | undefined;
    if (hadWrites && pageForClient) {
      const changedFields = deriveChangedFieldLabels({
        titleDefined: titleRaw !== undefined,
        slugDefined: slugRaw !== undefined,
        statusDefined: status !== undefined,
        bodyDefined: resolvedBodyPayload !== undefined,
        resolvedBodyPayload,
      });
      try {
        await recordPageContentVersion(supabase as any, {
          pageId,
          locale,
          environment,
          createdBy: ctx.scope?.userId ?? null,
          label: "Manuell lagring",
          action: "save",
          changedFields: changedFields.length > 0 ? changedFields : undefined,
        });
        versionRecorded = true;
      } catch (verErr) {
        versionRecorded = false;
        opsLog("cms.page_version_insert_failed", {
          rid: ctx.rid,
          pageId,
          locale,
          environment,
          error: verErr instanceof Error ? verErr.message : String(verErr),
        });
      }
    }

    const sec = securityContextFromAuthedCtx(ctx, request);
    scheduleAuditEvent({
      companyId: sec.companyId,
      userId: sec.userId,
      action: "update_content",
      resource: "content_page",
      metadata: {
        rid: ctx.rid,
        pageId,
        locale,
        environment,
        updatedPageFields: Object.keys(pageUpdates),
        variantUpdated: resolvedBodyPayload !== undefined,
      },
    });

    try {
      const { onEvent } = await import("@/lib/pos/eventHandler");
      onEvent({
        type: "cms_content_changed",
        page_id: pageId,
        locale,
        environment,
        body_sample: pageForClient?.body,
      });
    } catch {
      /* POS etter vellykket CMS-lagring */
    }

    return jsonOk(
      ctx.rid,
      pageForClient
        ? {
            page: pageForClient,
            ...(versionRecorded === false ? { versionRecorded: false as const } : {}),
          }
        : {},
      200,
    );
  } catch (e) {
    if (isLocalCmsRuntimeError(e)) {
      return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
    }
    if (isContentBackendUnavailableError(e)) {
      return jsonErr(
        ctx.rid,
        "Content-backenden svarte ikke. Lagring er blokkert til Supabase er tilbake.",
        503,
        "CONTENT_BACKEND_UNREACHABLE",
      );
    }
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
  });
}