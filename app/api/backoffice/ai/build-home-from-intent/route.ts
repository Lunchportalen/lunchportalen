import type { NextRequest } from "next/server";

import { buildHomeFromIntentBody, CMS_DRAFT_ENVIRONMENT } from "@/lib/ai/buildHomeFromIntentBody";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { rid } from "@/lib/http/rid";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { recordPageContentVersion } from "@/lib/backoffice/content/pageVersionsRepo";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const DEFAULT_INTENT = "Firmalunsj med kontroll og forutsigbarhet";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  return jsonErr(rid(), "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function POST(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  return withApiAiEntrypoint(request, "POST", async () => {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    parsed = null;
  }
  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const rawIntent = typeof o?.intent === "string" ? o.intent.trim() : "";
  const intent = rawIntent.length > 0 ? rawIntent : DEFAULT_INTENT;

  try {
    const supabase = supabaseAdmin();
    const bodyDoc = buildHomeFromIntentBody(intent);

    const { data: page, error: pageErr } = await supabase
      .from("content_pages")
      .select("id")
      .eq("slug", "home")
      .maybeSingle();

    if (pageErr) {
      return jsonErr(ctx.rid, pageErr.message, 500, "DB_ERROR");
    }
    if (!page?.id) {
      return jsonErr(ctx.rid, "Home page not found", 404, "NOT_FOUND");
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("content_page_variants").upsert(
      {
        page_id: page.id,
        locale: "nb",
        environment: CMS_DRAFT_ENVIRONMENT,
        body: bodyDoc,
        updated_at: now,
      },
      { onConflict: "page_id,locale,environment" },
    );

    if (error) {
      return jsonErr(ctx.rid, error.message, 500, "DB_ERROR");
    }

    const { error: pageTsErr } = await supabase.from("content_pages").update({ updated_at: now }).eq("id", page.id);
    if (pageTsErr) {
      return jsonErr(ctx.rid, pageTsErr.message, 500, "DB_ERROR");
    }

    try {
      await recordPageContentVersion(supabase as any, {
        pageId: page.id,
        locale: "nb",
        environment: CMS_DRAFT_ENVIRONMENT,
        createdBy: ctx.scope?.userId ?? null,
        label: "AI genererte innhold",
        action: "ai",
      });
    } catch (e) {
      return jsonErr(
        ctx.rid,
        e instanceof Error ? e.message : "Kunne ikke lagre versjonshistorikk etter AI-generering.",
        500,
        "VERSION_RECORD_FAILED",
      );
    }

    return jsonOk(ctx.rid, { generated: true }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonErr(ctx.rid, message, 500, "INTERNAL_ERROR");
  }
  });
}
