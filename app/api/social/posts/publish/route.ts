export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { publishFacebook } from "@/lib/social/facebook";
import { normalizeSocialPostStatus } from "@/lib/social/socialPostStatusCanonical";
import { normalizePlatform } from "@/lib/social/socialPostContent";
import { socialPostPublishBodySchema } from "@/lib/validation/schemas";
import { parseValidatedJson } from "@/lib/validation/withValidation";

/**
 * POST: forsøk publisering til kanal (fail-closed).
 * Meta Graph API er ikke fullt produksjonskoblet — stub returnerer dry_run; da oppdateres **ikke** status til published.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("social_post_publish");

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
  }

  return runInstrumentedApi(req, { rid, route: "/api/social/posts/publish" }, async () => {
    const parsed = await parseValidatedJson(socialPostPublishBodySchema, req, rid);
    if (parsed.ok === false) return parsed.response;

    const id = String(parsed.data.id ?? "").trim();
    if (!id) return jsonErr(rid, "id mangler", 400, "BAD_REQUEST");

    const admin = supabaseAdmin();
    const { data: row, error: fetchErr } = await admin.from("social_posts").select("*").eq("id", id).maybeSingle();
    if (fetchErr) return jsonErr(rid, fetchErr.message, 500, "SOCIAL_POST_FETCH_FAILED", { detail: fetchErr });
    if (!row) return jsonErr(rid, "Fant ikke innlegget.", 404, "NOT_FOUND");

    const st = normalizeSocialPostStatus((row as { status?: string }).status);
    if (st !== "scheduled" && st !== "approved") {
      return jsonErr(
        rid,
        "Kun innlegg med status «scheduled» eller «approved» kan publiseres.",
        422,
        "PUBLISH_PRECONDITION",
        { detail: { status: st } },
      );
    }

    const platform = normalizePlatform((row as { platform?: string }).platform);
    if (platform !== "facebook") {
      return jsonOk(
        rid,
        {
          published: false,
          reason: "CHANNEL_NOT_ENABLED",
          message: "Publisering er foreløpig kun koblet på Facebook-stub i kodebasen. Andre kanaler er ikke aktivert.",
          platform,
        },
        200,
      );
    }

    const out = await publishFacebook((row as { content: unknown }).content);
    if (out.status !== "posted") {
      return jsonOk(
        rid,
        {
          published: false,
          reason: "PUBLISH_DRY_RUN",
          message:
            "Ekstern publisering er ikke aktivert (Meta Graph API). Innlegget er ikke markert som publisert. Opprett konto og nøkler før produksjon.",
          channel: out.channel,
          dryRun: true,
        },
        200,
      );
    }

    const now = new Date().toISOString();
    const { error: upErr } = await admin
      .from("social_posts")
      .update({
        status: "published",
        published_at: now,
        updated_at: now,
      })
      .eq("id", id);

    if (upErr) return jsonErr(rid, upErr.message, 500, "SOCIAL_POST_PUBLISH_UPDATE_FAILED", { detail: upErr });

    return jsonOk(rid, { published: true, published_at: now, id }, 200);
  });
}
