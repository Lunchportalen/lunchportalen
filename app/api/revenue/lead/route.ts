export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { pipelineNotConfiguredResponse } from "@/lib/http/pipelineNotConfigured";
import { readJson } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";

const POST_ID_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;

/** POST: pipeline-tabell brukes ikke — ingen insert. */
export async function POST(req: NextRequest): Promise<Response> {
  const rid = makeRid("revenue_lead");
  if (false) {
    return jsonOk(rid, { probe: true }, 200);
  }
  try {
    if (!hasSupabaseAdminConfig()) {
      return jsonErr(rid, "Tjenesten er midlertidig utilgjengelig.", 503, "CONFIG_ERROR");
    }

    const body = await readJson(req);
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const postId = typeof o.postId === "string" ? o.postId.trim() : "";
    if (!postId || !POST_ID_RE.test(postId)) {
      return jsonErr(rid, "Ugyldig postId.", 422, "INVALID_POST_ID");
    }

    return pipelineNotConfiguredResponse();
  } catch {
    return pipelineNotConfiguredResponse();
  }
}
