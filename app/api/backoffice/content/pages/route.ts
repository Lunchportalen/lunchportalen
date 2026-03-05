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

const DEFAULT_TITLE = "Ny side";
const DEFAULT_LOCALE = "nb";
const DEFAULT_ENV = "prod";
const BODY_BASELINE = { version: 1, blocks: [] } as const;

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const title = typeof o.title === "string" ? o.title.trim() || DEFAULT_TITLE : DEFAULT_TITLE;
  let slug = typeof o.slug === "string" ? o.slug.trim() : "";
  if (!slug) slug = slugify(title);
  const slugSafe = slug || "ny-side-" + shortId();
  const locale = typeof o.locale === "string" ? o.locale.trim() || DEFAULT_LOCALE : DEFAULT_LOCALE;
  const environment = o.environment === "staging" || o.environment === "preview" ? o.environment : DEFAULT_ENV;

  try {
    const supabase = supabaseAdmin();

    const now = new Date().toISOString();
    const { data: pageRow, error: pageErr } = await supabase
      .from("content_pages")
      .insert({
        title,
        slug: slugSafe,
        status: "draft",
        updated_at: now,
      })
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

    const { error: variantErr } = await supabase.from("content_page_variants").insert({
      page_id: pageRow.id,
      locale,
      environment,
      body: BODY_BASELINE,
      updated_at: now,
    });

    if (variantErr) {
      await supabase.from("content_pages").delete().eq("id", pageRow.id);
      throw variantErr;
    }

    const page = { id: pageRow.id, title: pageRow.title ?? title, slug: pageRow.slug ?? slugSafe };
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, page }, 200);
  } catch (err) {
    const e = err as any;
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
}
