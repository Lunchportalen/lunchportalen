export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { randomUUID } from "crypto";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { readJson } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/** POST: spor hendelse i `social_posts.content` (data + metrics), `created_at` settes av DB. */
export async function POST(req: NextRequest): Promise<Response> {
  const rid = makeRid("social_track");
  try {
    const body = await readJson(req);
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const postId = typeof o.postId === "string" ? o.postId.trim() : "";
    const type = typeof o.type === "string" ? o.type.trim() : "";
    if (!postId || !type) {
      return jsonErr(rid, "postId og type er påkrevd.", 422, "INVALID_BODY");
    }

    if (!hasSupabaseAdminConfig()) {
      return jsonOk(rid, { accepted: false, reason: "no_admin" }, 200);
    }

    try {
      const admin = supabaseAdmin();
      const { error } = await admin.from("social_posts").insert({
        id: `evt_${randomUUID()}`,
        content: {
          data: { postId, type },
          metrics: {},
        },
        status: "planned",
        platform: "facebook",
      });
      if (error) {
        console.error("[social/track] social_posts insert failed", error.message);
      }
    } catch (e) {
      console.error("[social/track] social_posts insert failed", e);
    }

    return jsonOk(rid, { accepted: true }, 200);
  } catch {
    return jsonOk(rid, { accepted: true, skipped: "track_unhandled" }, 200);
  }
}
