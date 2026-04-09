export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePlatform } from "@/lib/social/socialPostContent";
import { normalizeSocialPostStatus } from "@/lib/social/socialPostStatusCanonical";
import { socialPostsSaveBodySchema } from "@/lib/validation/schemas";
import { parseValidatedJson } from "@/lib/validation/withValidation";

function mapPostRow(p: Record<string, unknown>, defaultVariantGroupId: string): Record<string, unknown> | null {
  const id = typeof p.id === "string" && p.id.trim() ? p.id.trim() : null;
  if (!id) return null;
  const status = normalizeSocialPostStatus(typeof p.status === "string" && p.status ? p.status : "planned");
  const scheduledAt =
    typeof p.scheduledAt === "number" && Number.isFinite(p.scheduledAt) && p.scheduledAt > 0
      ? new Date(p.scheduledAt).toISOString()
      : null;
  const vgFromPost =
    (typeof p.variant_group_id === "string" && p.variant_group_id.trim() ? p.variant_group_id.trim() : "") ||
    (typeof p.variantGroupId === "string" && p.variantGroupId.trim() ? p.variantGroupId.trim() : "");
  const variant_group_id = vgFromPost || defaultVariantGroupId;
  return {
    id,
    content: p,
    status,
    scheduled_at: scheduledAt,
    platform: typeof p.platform === "string" && p.platform.trim() ? normalizePlatform(p.platform) : "linkedin",
    variant_group_id,
    updated_at: new Date().toISOString(),
  };
}

/** Stabil variantgruppe for batch når klient ikke sender eksplisitt id (samme post-sett → samme gruppe ved re-save). */
function defaultVariantGroupForBatch(o: Record<string, unknown>, rawPosts: unknown[]): string {
  const explicit =
    (typeof o.variantGroupId === "string" && o.variantGroupId.trim() ? o.variantGroupId.trim() : "") ||
    (typeof o.variant_group_id === "string" && o.variant_group_id.trim() ? o.variant_group_id.trim() : "");
  if (explicit) return explicit;
  const ids = rawPosts
    .map((x) =>
      x && typeof x === "object" && typeof (x as Record<string, unknown>).id === "string"
        ? String((x as Record<string, unknown>).id).trim()
        : "",
    )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const h = createHash("sha256").update(ids.join("|")).digest("hex").slice(0, 32);
  return `ab_${h}`;
}

/** POST: persist calendar posts (superadmin). */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("social_posts_save");

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
  }

  return runInstrumentedApi(req, { rid, route: "/api/social/posts/save" }, async () => {
    try {
      const parsed = await parseValidatedJson(socialPostsSaveBodySchema, req, rid);
      if (parsed.ok === false) return parsed.response;

      const o = parsed.data as Record<string, unknown>;
      const rawPosts = Array.isArray(o.posts) ? o.posts : [];

      const batchVariantGroup = defaultVariantGroupForBatch(o, rawPosts);

      const rows = rawPosts
        .map((x) =>
          x && typeof x === "object" ? mapPostRow(x as Record<string, unknown>, batchVariantGroup) : null,
        )
        .filter((x): x is Record<string, unknown> => x != null);

      if (rows.length === 0) {
        return jsonOk(rid, { saved: 0 }, 200);
      }

      const { error } = await supabaseAdmin().from("social_posts").upsert(rows, { onConflict: "id" });
      if (error) {
        return jsonErr(rid, error.message, 500, "SOCIAL_POSTS_SAVE_FAILED", { detail: error });
      }

      return jsonOk(rid, { saved: rows.length }, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return jsonErr(rid, message, 500, "SOCIAL_POSTS_SAVE_UNHANDLED");
    }
  });
}
