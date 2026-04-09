export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { mergeSocialPostContent } from "@/lib/social/socialPostContentMerge";
import { canTransitionSocialPostStatus, normalizeSocialPostStatus } from "@/lib/social/socialPostStatusCanonical";
import { socialPostPatchBodySchema } from "@/lib/validation/schemas";
import { parseValidatedJson } from "@/lib/validation/withValidation";

function parseScheduledAt(body: Record<string, unknown>): string | null {
  const raw = body.scheduled_at ?? body.scheduledAt;
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw).toISOString();
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** PATCH: oppdater ett innlegg (superadmin, CMS). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("social_post_patch");
  const { id: rawId } = await ctx.params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) return jsonErr(rid, "id mangler", 400, "BAD_REQUEST");

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
  }

  return runInstrumentedApi(req, { rid, route: "/api/social/posts/[id]" }, async () => {
    const parsed = await parseValidatedJson(socialPostPatchBodySchema, req, rid);
    if (parsed.ok === false) return parsed.response;

    const body = parsed.data as Record<string, unknown>;
    const admin = supabaseAdmin();

    const { data: row, error: fetchErr } = await admin.from("social_posts").select("*").eq("id", id).maybeSingle();
    if (fetchErr) return jsonErr(rid, fetchErr.message, 500, "SOCIAL_POST_FETCH_FAILED", { detail: fetchErr });
    if (!row) return jsonErr(rid, "Fant ikke innlegget.", 404, "NOT_FOUND");

    const current = normalizeSocialPostStatus((row as { status?: string }).status);
    const nextStatus =
      typeof body.status === "string" && body.status.trim()
        ? normalizeSocialPostStatus(body.status)
        : current;

    if (body.status !== undefined && !canTransitionSocialPostStatus(current, nextStatus)) {
      return jsonErr(rid, "Ugyldig statusovergang.", 422, "INVALID_STATUS_TRANSITION", {
        detail: { from: current, to: nextStatus },
      });
    }

    const scheduledAt = parseScheduledAt(body);
    if (nextStatus === "scheduled" && !scheduledAt) {
      return jsonErr(rid, "Planlagt tidspunkt kreves for status «scheduled».", 422, "SCHEDULE_REQUIRED");
    }

    const patchContent =
      body.caption !== undefined ||
      body.text !== undefined ||
      body.hashtags !== undefined ||
      body.imageUrl !== undefined ||
      body.platform !== undefined;

    const nextContent = patchContent
      ? mergeSocialPostContent((row as { content: unknown }).content, {
          text: typeof body.text === "string" ? body.text : typeof body.caption === "string" ? body.caption : undefined,
          hashtags: Array.isArray(body.hashtags) ? (body.hashtags as string[]) : undefined,
          imageUrl:
            body.imageUrl === null
              ? null
              : typeof body.imageUrl === "string"
                ? body.imageUrl
                : undefined,
          platform: typeof body.platform === "string" ? body.platform : undefined,
        })
      : (row as { content: unknown }).content;

    const update: Record<string, unknown> = {
      content: nextContent,
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      update.status = nextStatus;
    }

    if (body.scheduled_at !== undefined || body.scheduledAt !== undefined) {
      update.scheduled_at = scheduledAt;
    }

    if (typeof body.platform === "string" && body.platform.trim()) {
      update.platform = body.platform.trim().toLowerCase();
    }

    const { error: upErr } = await admin.from("social_posts").update(update).eq("id", id);
    if (upErr) return jsonErr(rid, upErr.message, 500, "SOCIAL_POST_UPDATE_FAILED", { detail: upErr });

    return jsonOk(rid, { id, ok: true }, 200);
  });
}
