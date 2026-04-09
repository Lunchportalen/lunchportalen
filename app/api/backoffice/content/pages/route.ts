import type { NextRequest } from "next/server";
import { ensureRemoteBackendCmsHarnessContentIfEnabled } from "@/lib/auth/remoteBackendCmsHarness";
import { validateBodyPayloadBlockAllowlist } from "@/lib/cms/blockAllowlistGovernance";
import { getMergedBlockEditorDataTypesRecord } from "@/lib/cms/blocks/blockEditorDataTypeMerged.server";
import { getMergedDocumentTypeDefinitionsRecord } from "@/lib/cms/schema/documentTypeDefinitionMerged.server";
import {
  type ContentTreeRootKey,
  isContentTreeRootKey,
} from "@/lib/cms/contentTreeRoots";
import { parseBodyEnvelope, serializeBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { getDocType } from "@/lib/cms/contentDocumentTypes";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import {
  getLocalDevContentReservePages,
  isContentBackendUnavailableError,
  isLocalDevContentReserveEnabled,
} from "@/lib/cms/contentLocalDevReserve";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, q } from "@/lib/http/routeGuard";
import {
  createLocalCmsPage,
  isLocalCmsRuntimeError,
  listLocalCmsPages,
} from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { supabaseAdmin } from "@/lib/supabase/admin";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

const DEFAULT_TITLE = "Ny side";
const DEFAULT_LOCALE = "nb";
const DEFAULT_ENV = "prod";
const BODY_BLOCKS_EMPTY: { version: number; blocks: unknown[] } = { version: 1, blocks: [] };

/** Normaliserer blocksBody til kanonisk liste-objekt for variant-lagring. */
function normalizeBlocksBodyForEnvelope(raw: unknown): { version: number; blocks: unknown[] } {
  if (raw === "" || raw == null) return { ...BODY_BLOCKS_EMPTY };
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return normalizeBlocksBodyForEnvelope(parsed);
    } catch {
      return { ...BODY_BLOCKS_EMPTY };
    }
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const blocks = Array.isArray(o.blocks) ? o.blocks : [];
    const version = typeof o.version === "number" && !Number.isNaN(o.version) ? o.version : 1;
    return { version, blocks };
  }
  return { ...BODY_BLOCKS_EMPTY };
}

/**
 * U25: Nye sider får kanonisk body-envelope med documentType der det er trygt.
 * Valgfri `body` fra klient (create wizard) valideres mot dokumenttype + blokkliste.
 */
async function resolveInitialVariantBody(
  rid: string,
  o: Record<string, unknown>
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const defaultDoc = "page";
  const raw = o.body;
  if (raw === undefined || raw === null) {
    return {
      ok: true,
      body: serializeBodyEnvelope({
        documentType: defaultDoc,
        fields: {},
        blocksBody: { ...BODY_BLOCKS_EMPTY },
      }),
    };
  }
  const env = parseBodyEnvelope(raw);
  const docRaw = env.documentType != null ? String(env.documentType).trim() : "";
  const doc = docRaw !== "" ? docRaw : defaultDoc;
  if (!getDocType(doc)) {
    return {
      ok: false,
      response: jsonErr(rid, `Ukjent dokumenttype: ${doc}`, 400, "INVALID_DOCUMENT_TYPE"),
    };
  }
  const blocksBody = normalizeBlocksBodyForEnvelope(env.blocksBody);
  const fields =
    env.fields && typeof env.fields === "object" && !Array.isArray(env.fields) ? env.fields : {};
  const serialized = serializeBodyEnvelope({
    documentType: doc,
    fields: fields as Record<string, unknown>,
    blocksBody,
  });
  const mergedDt = getMergedBlockEditorDataTypesRecord();
  const mergedDoc = getMergedDocumentTypeDefinitionsRecord();
  const v = validateBodyPayloadBlockAllowlist(serialized, mergedDt, mergedDoc);
  if (v.ok === false) {
    const detail =
      v.error === "INVALID_DOCUMENT_TYPE"
        ? "Ugyldig dokumenttype i innhold."
        : `Blokktyper ikke tillatt for dokumenttype «${v.documentType}»: ${v.forbidden.join(", ")}`;
    return {
      ok: false,
      response: jsonErr(rid, detail, 400, v.error),
    };
  }
  return { ok: true, body: serialized };
}

async function nextTreeSortOrder(
  supabase: ReturnType<typeof supabaseAdmin>,
  placement: { tree_parent_id: string | null; tree_root_key: ContentTreeRootKey }
): Promise<number> {
  if (placement.tree_parent_id) {
    const { data, error } = await supabase
      .from("content_pages")
      .select("tree_sort_order")
      .eq("tree_parent_id", placement.tree_parent_id)
      .is("tree_root_key", null)
      .order("tree_sort_order", { ascending: false })
      .limit(1);
    if (error) throw error;
    const max = Array.isArray(data) && data[0] && typeof (data[0] as { tree_sort_order?: number }).tree_sort_order === "number"
      ? (data[0] as { tree_sort_order: number }).tree_sort_order
      : -1;
    return max + 1;
  }
  const { data, error } = await supabase
    .from("content_pages")
    .select("tree_sort_order")
    .is("tree_parent_id", null)
    .eq("tree_root_key", placement.tree_root_key)
    .order("tree_sort_order", { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = Array.isArray(data) && data[0] && typeof (data[0] as { tree_sort_order?: number }).tree_sort_order === "number"
    ? (data[0] as { tree_sort_order: number }).tree_sort_order
    : -1;
  return max + 1;
}

function slugify(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "ny-side";
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const limitRaw = q(request, "limit");
  const limit = Math.min(Math.max(parseInt(limitRaw ?? "50", 10) || 50, 1), 200);
  const qSearch = q(request, "q") ?? "";

  try {
    if (isLocalCmsRuntimeEnabled()) {
      const items = listLocalCmsPages({ q: qSearch, limit });
      return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, items }, 200);
    }

    if (isLocalDevContentReserveEnabled()) {
      const reserveItems = getLocalDevContentReservePages()
        .map((page) => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          updated_at: page.updated_at,
        }))
        .filter((page) => {
          if (!qSearch.trim()) return true;
          const hay = `${page.title} ${page.slug}`.toLowerCase();
          return hay.includes(qSearch.trim().toLowerCase());
        })
        .slice(0, limit);

      return jsonOk(
        ctx.rid,
        {
          ok: true,
          rid: ctx.rid,
          items: reserveItems,
          degraded: true,
          reserve: true,
        },
        200,
      );
    }

    await ensureRemoteBackendCmsHarnessContentIfEnabled();

    const supabase = supabaseAdmin();
    let query = supabase
      .from("content_pages")
      .select("id, title, slug, status, updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (qSearch.trim()) {
      query = query.or(`title.ilike.%${qSearch.trim()}%,slug.ilike.%${qSearch.trim()}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const items = (rows ?? []).map((r: { id: string; title: string | null; slug: string | null; status?: string | null; updated_at?: string | null; created_at?: string | null }) => ({
      id: r.id,
      title: r.title ?? "",
      slug: r.slug ?? "",
      status: r.status ?? "draft",
      updated_at: r.updated_at ?? r.created_at ?? null,
    }));

    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, items }, 200);
  } catch (e) {
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

export async function POST(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  if (isLocalDevContentReserveEnabled()) {
    return jsonErr(
      ctx.rid,
      "Lokal content-reserve er skrivebeskyttet. Deaktiver LOCAL_DEV_CONTENT_RESERVE for å opprette sider mot ekte backend.",
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

  if (isLocalCmsRuntimeEnabled()) {
    try {
      const created = createLocalCmsPage({
        title: typeof o.title === "string" ? o.title : undefined,
        slug: typeof o.slug === "string" ? o.slug : undefined,
        locale: typeof o.locale === "string" ? o.locale : undefined,
        environment: typeof o.environment === "string" ? o.environment : undefined,
        tree_parent_id:
          typeof o.tree_parent_id === "string" || o.tree_parent_id == null
            ? (o.tree_parent_id as string | null | undefined)
            : undefined,
        tree_root_key:
          typeof o.tree_root_key === "string" || o.tree_root_key == null
            ? (o.tree_root_key as string | null | undefined)
            : undefined,
        body: o.body,
        actorUserId: ctx.scope?.userId ?? null,
        actorEmail: ctx.scope?.email ?? null,
      });
      return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, ...created }, 201);
    } catch (error) {
      if (isLocalCmsRuntimeError(error)) {
        return jsonErr(ctx.rid, error.message, error.status, error.code, error.detail);
      }
      const message = error instanceof Error ? error.message : "Internal server error";
      return jsonErr(ctx.rid, message, 500, "SERVER_ERROR", { detail: String(error) });
    }
  }

  const title = typeof o.title === "string" ? o.title.trim() || DEFAULT_TITLE : DEFAULT_TITLE;
  let slug = typeof o.slug === "string" ? o.slug.trim() : "";
  if (!slug) slug = slugify(title);
  const slugSafe = slug || "ny-side-" + shortId();
  const locale = typeof o.locale === "string" ? o.locale.trim() || DEFAULT_LOCALE : DEFAULT_LOCALE;
  const environment = o.environment === "staging" || o.environment === "preview" ? o.environment : DEFAULT_ENV;

  const treeParentRaw = o.tree_parent_id;
  const treeParentId =
    treeParentRaw === null || treeParentRaw === undefined
      ? null
      : typeof treeParentRaw === "string" && treeParentRaw.trim()
        ? treeParentRaw.trim()
        : null;
  const treeRootRaw = o.tree_root_key;
  const treeRootKeyFromBody =
    typeof treeRootRaw === "string" && isContentTreeRootKey(treeRootRaw.trim())
      ? (treeRootRaw.trim() as ContentTreeRootKey)
      : null;

  if (treeParentId && treeRootKeyFromBody) {
    return jsonErr(ctx.rid, "Oppgi enten tree_parent_id eller tree_root_key, ikke begge.", 400, "BAD_REQUEST");
  }

  return withCmsPageDocumentGate("api/backoffice/content/pages/POST", async () => {
    try {
      const resolved = await resolveInitialVariantBody(ctx.rid, o);
      if (resolved.ok === false) return resolved.response;

      const supabase = supabaseAdmin();

      if (treeParentId) {
        const { data: parentRow, error: parentErr } = await supabase
          .from("content_pages")
          .select("id")
          .eq("id", treeParentId)
          .maybeSingle();
        if (parentErr) throw parentErr;
        if (!parentRow?.id) {
          return jsonErr(ctx.rid, "Forelder-side finnes ikke.", 400, "INVALID_PARENT");
        }
      }

      const rootKeyResolved: ContentTreeRootKey = treeRootKeyFromBody ?? "overlays";
      const placementForSort: { tree_parent_id: string | null; tree_root_key: ContentTreeRootKey } = treeParentId
        ? { tree_parent_id: treeParentId, tree_root_key: rootKeyResolved }
        : { tree_parent_id: null, tree_root_key: rootKeyResolved };

      const now = new Date().toISOString();
      const treeSortOrder = await nextTreeSortOrder(supabase, placementForSort);

      const insertPayload: Record<string, unknown> = {
        title,
        slug: slugSafe,
        status: "draft",
        updated_at: now,
        tree_sort_order: treeSortOrder,
      };
      if (treeParentId) {
        insertPayload.tree_parent_id = treeParentId;
        insertPayload.tree_root_key = null;
      } else {
        insertPayload.tree_parent_id = null;
        insertPayload.tree_root_key = rootKeyResolved;
      }

      const { data: pageRow, error: pageErr } = await supabase
        .from("content_pages")
        .insert(insertPayload)
        .select("id, title, slug")
        .single();

      if (pageErr) {
        if (pageErr.code === "23505") {
          return jsonErr(ctx.rid, "Slug already exists", 409, "SLUG_TAKEN");
        }
        throw pageErr;
      }

      if (!pageRow) {
        return jsonErr(ctx.rid, "Kunne ikke opprette side.", 500, "SERVER_ERROR");
      }

      const variantBody = resolved.body;
      const { error: variantErr } = await supabase.from("content_page_variants").insert({
        page_id: pageRow.id,
        locale,
        environment,
        body: variantBody,
        updated_at: now,
      });

      if (variantErr) {
        await supabase.from("content_pages").delete().eq("id", pageRow.id);
        throw variantErr;
      }

      const alternateLocale = locale === "en" ? "nb" : "en";
      let twinBody: unknown = variantBody;
      try {
        twinBody = JSON.parse(JSON.stringify(variantBody)) as unknown;
      } catch {
        twinBody = variantBody;
      }
      const { error: variantErrTwin } = await supabase.from("content_page_variants").insert({
        page_id: pageRow.id,
        locale: alternateLocale,
        environment,
        body: twinBody,
        updated_at: now,
      });
      if (variantErrTwin) {
        await supabase.from("content_page_variants").delete().eq("page_id", pageRow.id);
        await supabase.from("content_pages").delete().eq("id", pageRow.id);
        throw variantErrTwin;
      }

      const page = {
        id: pageRow.id,
        title: pageRow.title ?? title,
        slug: pageRow.slug ?? slugSafe,
        tree_parent_id: treeParentId,
        tree_root_key: treeParentId ? null : rootKeyResolved,
      };
      return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, page }, 200);
    } catch (err) {
      const e = err as any;
      if (isContentBackendUnavailableError(e)) {
        return jsonErr(
          ctx.rid,
          "Content-backenden svarte ikke. Oppretting er blokkert til Supabase er tilbake, eller til lokal reserve er deaktivert.",
          503,
          "CONTENT_BACKEND_UNREACHABLE",
        );
      }
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") {
        return jsonErr(ctx.rid, "Slug already exists", 409, "SLUG_TAKEN");
      }

      const info = {
        name: e?.name,
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
        status: e?.status,
        stack: e?.stack,
      };

      console.error("[content/pages POST] FAILED", info);

      return jsonErr(ctx.rid, "Create page failed", 500, "CREATE_PAGE_FAILED", {
        message: info.message ?? String(err),
        code: info.code ?? null,
        hint: info.hint ?? null,
      });
    }
  });
}
