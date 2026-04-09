/**
 * U28 — Reviewbar batch-normalisering: legacy → kanonisk envelope via previewNormalizeLegacyBodyToEnvelope.
 * Superadmin. Cap på antall sider. dryRun uten DB-skriv.
 */
import type { NextRequest } from "next/server";
import { recordPageContentVersion } from "@/lib/backoffice/content/pageVersionsRepo";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { getMergedBlockEditorDataTypesRecord } from "@/lib/cms/blocks/blockEditorDataTypeMerged.server";
import { previewNormalizeLegacyBodyToEnvelope } from "@/lib/cms/legacyEnvelopeGovernance";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { opsLog } from "@/lib/ops/log";
import { scheduleAuditEvent } from "@/lib/security/audit";
import { securityContextFromAuthedCtx } from "@/lib/security/context";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LOCALE = "nb";
const DEFAULT_ENV = "prod";
const MAX_BATCH = 25;

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

type VariantLoad = { variantId: string | null; body: unknown };

async function loadVariantForPage(
  supabase: ReturnType<typeof supabaseAdmin>,
  pageId: string,
  locale: string,
  environment: string
): Promise<VariantLoad> {
  const { data: variantByLocale } = await supabase
    .from("content_page_variants")
    .select("id, body")
    .eq("page_id", pageId)
    .eq("locale", locale)
    .eq("environment", environment)
    .maybeSingle();

  if (variantByLocale && typeof (variantByLocale as { id?: string }).id === "string") {
    return {
      variantId: (variantByLocale as { id: string }).id,
      body: (variantByLocale as { body?: unknown }).body,
    };
  }
  /** Ingen fallback til annen locale — batch skriver kun til eksakt (locale, environment) eller oppretter rad. */
  return { variantId: null, body: { version: 1, blocks: [] } };
}

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

  const aliasRaw = typeof o.documentTypeAlias === "string" ? o.documentTypeAlias.trim() : "";
  if (!aliasRaw) {
    return jsonErr(ctx.rid, "documentTypeAlias er påkrevd.", 400, "VALIDATION_ERROR");
  }

  const pageIdsIn = Array.isArray(o.pageIds) ? o.pageIds : [];
  const pageIds = pageIdsIn
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  if (pageIds.length === 0) {
    return jsonErr(ctx.rid, "pageIds må være en ikke-tom array.", 400, "VALIDATION_ERROR");
  }
  if (pageIds.length > MAX_BATCH) {
    return jsonErr(ctx.rid, `Maks ${MAX_BATCH} sider per forespørsel.`, 400, "BATCH_LIMIT");
  }

  const dryRun = o.dryRun === true;
  const locale = typeof o.locale === "string" && o.locale.trim() ? o.locale.trim() : DEFAULT_LOCALE;
  const environment =
    o.environment === "staging" || o.environment === "preview" || o.environment === "prod"
      ? o.environment
      : DEFAULT_ENV;

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const sec = securityContextFromAuthedCtx(ctx, request);

  type RowResult =
    | { pageId: string; status: "preview_ok" }
    | { pageId: string; status: "skipped"; reason: string }
    | { pageId: string; status: "applied" }
    | { pageId: string; status: "error"; reason: string };

  try {
    return await withCmsPageDocumentGate("api/backoffice/content/batch-normalize-legacy/POST", async () => {
      const mergedDt = getMergedBlockEditorDataTypesRecord();
      const results: RowResult[] = [];
      for (const pageId of pageIds) {
      const { data: pageRow } = await supabase
        .from("content_pages")
        .select("id")
        .eq("id", pageId)
        .maybeSingle();
      if (!pageRow) {
        results.push({ pageId, status: "error", reason: "Side ikke funnet." });
        continue;
      }

      const { variantId, body: rawBody } = await loadVariantForPage(supabase, pageId, locale, environment);
      const preview = previewNormalizeLegacyBodyToEnvelope(aliasRaw, rawBody, mergedDt);
      if (preview.ok === false) {
        const reason = preview.reason;
        if (/allerede/i.test(reason)) {
          results.push({ pageId, status: "skipped", reason });
        } else {
          results.push({ pageId, status: "error", reason });
        }
        continue;
      }

      if (dryRun) {
        results.push({ pageId, status: "preview_ok" });
        continue;
      }

      const payload = preview.payload;

      if (variantId) {
        const { error: vErr } = await supabase
          .from("content_page_variants")
          .update({ body: payload, updated_at: now })
          .eq("id", variantId);
        if (vErr) {
          results.push({ pageId, status: "error", reason: vErr.message ?? "Oppdatering feilet." });
          opsLog("cms.batch_normalize_variant_failed", { rid: ctx.rid, pageId, detail: vErr.message });
          continue;
        }
      } else {
        const { error: insErr } = await supabase.from("content_page_variants").insert({
          page_id: pageId,
          locale,
          environment,
          body: payload,
          updated_at: now,
        });
        if (insErr) {
          results.push({ pageId, status: "error", reason: insErr.message ?? "Innsetting feilet." });
          continue;
        }
      }

      try {
        await recordPageContentVersion(supabase as any, {
          pageId,
          locale,
          environment,
          createdBy: ctx.scope?.userId ?? null,
          label: "Batch: legacy → envelope",
          action: "batch_normalize_legacy",
          changedFields: ["Innhold"],
        });
      } catch (verErr) {
        opsLog("cms.batch_normalize_version_failed", {
          rid: ctx.rid,
          pageId,
          error: verErr instanceof Error ? verErr.message : String(verErr),
        });
      }

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
          batchNormalizeLegacy: true,
          documentTypeAlias: aliasRaw,
        },
      });

      try {
        const { onEvent } = await import("@/lib/pos/eventHandler");
        onEvent({
          type: "cms_content_changed",
          page_id: pageId,
          locale,
          environment,
          body_sample: payload,
        });
      } catch {
        /* best effort */
      }

      results.push({ pageId, status: "applied" });
    }

      return jsonOk(
        ctx.rid,
        { dryRun, documentTypeAlias: aliasRaw, locale, environment, maxBatch: MAX_BATCH, results },
        200
      );
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}
