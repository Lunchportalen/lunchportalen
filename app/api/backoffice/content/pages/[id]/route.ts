import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, q } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
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

    let variantRow = variantByLocale ?? null;
    if (!variantRow) {
      const { data: fallbackRows } = await supabase
        .from("content_page_variants")
        .select("id, body, locale, environment")
        .eq("page_id", pageId)
        .order("created_at", { ascending: true })
        .limit(1);
      variantRow = Array.isArray(fallbackRows) && fallbackRows.length > 0 ? fallbackRows[0] : null;
    }

    const payload = buildPayload(pageRow, variantRow, locale, environment);
    return jsonOk(ctx.rid, payload, 200);
  } catch (e) {
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

  try {
    const supabase = supabaseAdmin();
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

    if (bodyPayload !== undefined) {
      const { data: existingVariant } = await supabase
        .from("content_page_variants")
        .select("id")
        .eq("page_id", pageId)
        .eq("locale", locale)
        .eq("environment", environment)
        .maybeSingle();

      if (existingVariant?.id) {
        const { error: vErr } = await supabase
          .from("content_page_variants")
          .update({ body: bodyPayload, updated_at: now })
          .eq("id", existingVariant.id);
        if (vErr) throw vErr;
      } else {
        const { error: vInsErr } = await supabase.from("content_page_variants").insert({
          page_id: pageId,
          locale,
          environment,
          body: bodyPayload,
          updated_at: now,
        });
        if (vInsErr) throw vInsErr;
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
    return jsonOk(ctx.rid, pageForClient ? { page: pageForClient } : {}, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}