import type { NextRequest } from "next/server";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import {
  applyPageVersionDataToDb,
  getPageVersionById,
  parsePageVersionData,
  recordPageContentVersion,
} from "@/lib/backoffice/content/pageVersionsRepo";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isLocalCmsRuntimeError, rollbackLocalCmsVersion } from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { scheduleAuditEvent } from "@/lib/security/audit";
import { securityContextFromAuthedCtx } from "@/lib/security/context";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

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

function buildPageForClient(pageRow: PageRow, variantRow: VariantRow | null) {
  const body = variantRow?.body ?? { version: 1, blocks: [] };
  return {
    id: pageRow.id,
    title: pageRow.title ?? "",
    slug: pageRow.slug ?? "",
    status: pageRow.status ?? "draft",
    created_at: pageRow.created_at ?? null,
    updated_at: pageRow.updated_at ?? pageRow.created_at ?? null,
    published_at: pageRow.published_at ?? null,
    body,
    variantId: variantRow?.id ?? null,
  };
}

function isNonEmptyExpectedUpdatedAt(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function sameUpdatedInstant(dbIso: string | null | undefined, expectedIso: string): boolean {
  const e = Date.parse(expectedIso.trim());
  if (Number.isNaN(e)) return false;
  if (dbIso == null || String(dbIso).trim() === "") return false;
  const d = Date.parse(String(dbIso));
  if (Number.isNaN(d)) return false;
  return d === e;
}

/**
 * POST /api/page/rollback
 * Body: { pageId, versionId, expectedUpdatedAt? }
 * Backs up current state, then restores snapshot from versionId.
 */
export async function POST(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const pageId = typeof o.pageId === "string" ? o.pageId.trim() : "";
  const versionId = typeof o.versionId === "string" ? o.versionId.trim() : "";
  if (!pageId || !versionId) {
    return jsonErr(ctx.rid, "Mangler pageId eller versionId.", 400, "BAD_REQUEST");
  }

  return withCmsPageDocumentGate("api/page/rollback/POST", async () => {
    try {
      if (isLocalCmsRuntimeEnabled()) {
        const out = rollbackLocalCmsVersion({
          pageId,
          versionId,
          expectedUpdatedAt: isNonEmptyExpectedUpdatedAt(o.expectedUpdatedAt) ? o.expectedUpdatedAt : null,
          actorEmail: ctx.scope?.email ?? null,
          actorUserId: ctx.scope?.userId ?? null,
        });
        return jsonOk(ctx.rid, out, 200);
      }

      const supabase = supabaseAdmin();
      const versionRow = await getPageVersionById(supabase as any, versionId);
      if (!versionRow || versionRow.page_id !== pageId) {
        return jsonErr(ctx.rid, "Versjon ikke funnet for denne siden.", 404, "NOT_FOUND");
      }
      if (versionRow.data == null || typeof versionRow.data !== "object") {
        return jsonErr(ctx.rid, "Versjonen mangler lagret innhold.", 422, "MISSING_VERSION_DATA");
      }

      const parsed = parsePageVersionData(versionRow.data);
      if (!parsed) {
        return jsonErr(ctx.rid, "Ugyldig versjonsdata.", 422, "INVALID_VERSION_DATA");
      }
      if (parsed.variant.locale !== versionRow.locale || parsed.variant.environment !== versionRow.environment) {
        return jsonErr(ctx.rid, "Versjonsdata stemmer ikke med lagret variant.", 422, "VERSION_MISMATCH");
      }
      if (parsed.page.id !== pageId) {
        return jsonErr(ctx.rid, "Versjonsdata tilhører annen side.", 422, "PAGE_MISMATCH");
      }

      if (isNonEmptyExpectedUpdatedAt(o.expectedUpdatedAt)) {
        const { data: crow, error: lockErr } = await supabase
          .from("content_pages")
          .select("updated_at")
          .eq("id", pageId)
          .maybeSingle();
        if (lockErr) throw lockErr;
        if (!sameUpdatedInstant(crow?.updated_at, o.expectedUpdatedAt)) {
          return jsonErr(
            ctx.rid,
            "Siden ble oppdatert mens du arbeidet. Last innhold og historikk på nytt.",
            409,
            "PAGE_STALE",
          );
        }
      }

      const actorUserId = ctx.scope?.userId ?? null;
      const backup = await recordPageContentVersion(supabase as any, {
        pageId,
        locale: versionRow.locale,
        environment: versionRow.environment,
        createdBy: actorUserId,
        label: "Gjenopprettet versjon",
        action: "rollback",
      });

      const now = new Date().toISOString();
      try {
        await applyPageVersionDataToDb(supabase as any, {
          pageId,
          locale: versionRow.locale,
          environment: versionRow.environment,
          data: parsed,
          nowIso: now,
        });
      } catch (e) {
        const err = e as { code?: string; message?: string };
        if (err.code === "23505") {
          return jsonErr(ctx.rid, "Slug er i bruk av en annen side. Kan ikke gjenopprette.", 409, "SLUG_TAKEN");
        }
        throw e;
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
        .eq("locale", versionRow.locale)
        .eq("environment", versionRow.environment)
        .maybeSingle();

      const pageForClient =
        pageRowAfter != null ? buildPageForClient(pageRowAfter as PageRow, variantAfter as VariantRow | null) : null;

      const sec = securityContextFromAuthedCtx(ctx, request);
      scheduleAuditEvent({
        companyId: sec.companyId,
        userId: sec.userId,
        action: "content_page_rollback",
        resource: "content_page",
        metadata: {
          rid: ctx.rid,
          pageId,
          versionId,
          restoredVersionNumber: versionRow.version_number,
          locale: versionRow.locale,
          environment: versionRow.environment,
        },
      });

      return jsonOk(ctx.rid, { page: pageForClient, backupVersionId: backup.id }, 200);
    } catch (e) {
      if (isLocalCmsRuntimeError(e)) {
        return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
      }
      const msg = e instanceof Error ? e.message : "Internal server error";
      return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
    }
  });
}
