import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

const HOME_SLUG = "home";
const HOME_TITLE = "Hjem";
const DEFAULT_LOCALE = "nb";
const DEFAULT_ENV = "prod";
const BODY_BASELINE = { version: 1, blocks: [] } as const;

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  try {
    const supabase = supabaseAdmin();

    const { data: existing, error: selectErr } = await supabase
      .from("content_pages")
      .select("id, title, slug, status, updated_at")
      .eq("slug", HOME_SLUG)
      .maybeSingle();

    if (selectErr) throw selectErr;

    if (existing) {
      return jsonOk(ctx.rid, {
        ok: true,
        rid: ctx.rid,
        page: {
          id: existing.id,
          title: existing.title ?? HOME_TITLE,
          slug: existing.slug ?? HOME_SLUG,
          status: existing.status ?? "draft",
          updated_at: existing.updated_at ?? null,
        },
      }, 200);
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from("content_pages")
      .insert({
        title: HOME_TITLE,
        slug: HOME_SLUG,
        status: "draft",
        updated_at: now,
      })
      .select("id, title, slug, status, updated_at")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: row, error: retryErr } = await supabase
          .from("content_pages")
          .select("id, title, slug, status, updated_at")
          .eq("slug", HOME_SLUG)
          .maybeSingle();
        if (retryErr) throw retryErr;
        if (row) {
          return jsonOk(ctx.rid, {
            ok: true,
            rid: ctx.rid,
            page: {
              id: row.id,
              title: row.title ?? HOME_TITLE,
              slug: row.slug ?? HOME_SLUG,
              status: row.status ?? "draft",
              updated_at: row.updated_at ?? null,
            },
          }, 200);
        }
      }
      throw insertErr;
    }

    if (!inserted) {
      const { data: row, error: retryErr } = await supabase
        .from("content_pages")
        .select("id, title, slug, status, updated_at")
        .eq("slug", HOME_SLUG)
        .maybeSingle();
      if (retryErr) throw retryErr;
      if (row) {
        return jsonOk(ctx.rid, {
          ok: true,
          rid: ctx.rid,
          page: {
            id: row.id,
            title: row.title ?? HOME_TITLE,
            slug: row.slug ?? HOME_SLUG,
            status: row.status ?? "draft",
            updated_at: row.updated_at ?? null,
          },
        }, 200);
      }
    }

    const { error: variantErr } = await supabase.from("content_page_variants").insert({
      page_id: inserted.id,
      locale: DEFAULT_LOCALE,
      environment: DEFAULT_ENV,
      body: BODY_BASELINE,
      updated_at: now,
    });

    if (variantErr) {
      await supabase.from("content_pages").delete().eq("id", inserted.id);
      throw variantErr;
    }

    return jsonOk(ctx.rid, {
      ok: true,
      rid: ctx.rid,
      page: {
        id: inserted.id,
        title: inserted.title ?? HOME_TITLE,
        slug: inserted.slug ?? HOME_SLUG,
        status: inserted.status ?? "draft",
        updated_at: inserted.updated_at ?? null,
      },
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    const code = (e as { code?: string })?.code;
    if (code) console.error("[content/home GET]", code, msg);
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}