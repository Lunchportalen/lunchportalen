export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * PATCH body: full `prompt_registry` object `{ editor, seo, growth, product?, support?, ... }` (string values).
 * Merges into `ai_config.features` without dropping other feature keys.
 */
export async function PATCH(req: Request) {
  const rid = makeRid("ai_prompts_patch");
  const auth = await getAuthContext({ rid });

  if (!auth.ok || auth.role !== "superadmin") {
    return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "INVALID_JSON");
  }

  const supabase = await supabaseServer();

  const { data: row, error: readErr } = await supabase.from("ai_config").select("id, features").limit(1).maybeSingle();

  if (readErr) {
    return jsonErr(rid, readErr.message, 500, "AI_CONFIG_FETCH_FAILED");
  }

  if (!row?.id) {
    return jsonErr(rid, "Ingen AI-konfigurasjon å oppdatere.", 404, "AI_CONFIG_MISSING");
  }

  const prev =
    row.features && typeof row.features === "object" && !Array.isArray(row.features)
      ? (row.features as Record<string, unknown>)
      : {};

  const nextFeatures: Record<string, unknown> = {
    ...prev,
    prompt_registry: body,
  };

  const { error: upErr } = await supabase
    .from("ai_config")
    .update({
      features: nextFeatures,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId ?? null,
    })
    .eq("id", row.id);

  if (upErr) {
    return jsonErr(rid, upErr.message, 500, "AI_PROMPTS_UPDATE_FAILED");
  }

  return jsonOk(rid, { ok: true }, 200);
}
