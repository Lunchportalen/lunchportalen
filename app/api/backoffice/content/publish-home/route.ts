import type { NextRequest } from "next/server";

import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { CMS_DRAFT_ENVIRONMENT } from "@/lib/cms/cmsDraftEnvironment";
import { createHomeTrafficExperimentCore } from "@/lib/experiments/createHomeTrafficExperimentCore";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { rid } from "@/lib/http/rid";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { opsLog } from "@/lib/ops/log";
import { recordPageContentVersion } from "@/lib/backoffice/content/pageVersionsRepo";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  return jsonErr(rid(), "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function POST(_request: NextRequest) {
  const s = await scopeOr401(_request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  return withCmsPageDocumentGate("api/backoffice/content/publish-home/POST", async () => {
  try {
    const supabase = supabaseAdmin();
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

    const { data: draftVar, error: draftErr } = await supabase
      .from("content_page_variants")
      .select("body")
      .eq("page_id", page.id)
      .eq("locale", "nb")
      .eq("environment", CMS_DRAFT_ENVIRONMENT)
      .maybeSingle();

    if (draftErr) {
      return jsonErr(ctx.rid, draftErr.message, 500, "DB_ERROR");
    }
    if (!draftVar) {
      return jsonErr(ctx.rid, "Draft variant not found for home.", 404, "NOT_FOUND");
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase.from("content_page_variants").upsert(
      {
        page_id: page.id,
        locale: "nb",
        environment: "prod",
        body: draftVar.body ?? { version: 1, blocks: [] },
        updated_at: now,
      },
      { onConflict: "page_id,locale,environment" },
    );

    if (upErr) {
      return jsonErr(ctx.rid, upErr.message, 500, "DB_ERROR");
    }

    const { error: pageTsErr } = await supabase.from("content_pages").update({ updated_at: now }).eq("id", page.id);
    if (pageTsErr) {
      return jsonErr(ctx.rid, pageTsErr.message, 500, "DB_ERROR");
    }

    try {
      await recordPageContentVersion(supabase as any, {
        pageId: page.id,
        locale: "nb",
        environment: "prod",
        createdBy: ctx.scope?.userId ?? null,
        label: "Publisert til produksjon",
        action: "publish",
      });
    } catch (e) {
      return jsonErr(
        ctx.rid,
        e instanceof Error ? e.message : "Kunne ikke lagre versjonshistorikk etter publisering.",
        500,
        "VERSION_RECORD_FAILED",
      );
    }

    const expStart = await createHomeTrafficExperimentCore({
      rid: ctx.rid,
      source: "api/backoffice/content/publish-home",
    });
    opsLog(
      "growth.publish_home_experiment_autostart",
      expStart.ok === false
        ? {
            rid: ctx.rid,
            ok: false,
            code: expStart.code,
            experimentId: undefined,
          }
        : {
            rid: ctx.rid,
            ok: true,
            code: undefined,
            experimentId: expStart.experimentId,
          },
    );

    try {
      const base =
        String(process.env.NEXT_PUBLIC_BASE_URL ?? "")
          .trim()
          .replace(/\/$/, "") || _request.nextUrl.origin;
      const cookie = _request.headers.get("cookie") ?? "";
      const res = await fetch(`${base}/api/backoffice/experiments/create`, {
        method: "POST",
        headers: cookie ? { cookie } : {},
      });
      opsLog("growth.publish_home_experiment_create_http_followup", {
        rid: ctx.rid,
        status: res.status,
        ok: res.ok,
      });
    } catch (e) {
      opsLog("experiment_autostart_failed", {
        rid: ctx.rid,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    return jsonOk(
      ctx.rid,
      {
        published: true,
        environment: "prod",
        experimentAutostart:
          expStart.ok === false
            ? { ok: false as const, code: expStart.code, message: expStart.message }
            : { ok: true as const, experimentId: expStart.experimentId },
      },
      200,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonErr(ctx.rid, message, 500, "INTERNAL_ERROR");
  }
  });
}
