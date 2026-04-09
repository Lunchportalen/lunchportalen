export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const rid = makeRid("ai_config_get");
  const auth = await getAuthContext({ rid });

  if (!auth.ok || auth.role !== "superadmin") {
    return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("ai_config").select("*").limit(1).maybeSingle();

  if (error) {
    return jsonErr(rid, error.message, 500, "AI_CONFIG_FETCH_FAILED");
  }

  if (!data) {
    return jsonErr(rid, "Ingen AI-konfigurasjon funnet.", 404, "AI_CONFIG_MISSING");
  }

  return jsonOk(rid, data, 200);
}

export async function PATCH(req: Request) {
  const rid = makeRid("ai_config_patch");
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

  const { data: row, error: readErr } = await supabase.from("ai_config").select("id").limit(1).maybeSingle();

  if (readErr) {
    return jsonErr(rid, readErr.message, 500, "AI_CONFIG_FETCH_FAILED");
  }

  if (!row?.id) {
    return jsonErr(rid, "Ingen AI-konfigurasjon å oppdatere.", 404, "AI_CONFIG_MISSING");
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.userId ?? null,
  };

  if ("model" in body) patch.model = body.model;
  if ("temperature" in body) patch.temperature = body.temperature;
  if ("max_tokens" in body) patch.max_tokens = body.max_tokens;
  if ("system_prompt" in body) patch.system_prompt = body.system_prompt;
  if ("features" in body) patch.features = body.features;

  const { error: upErr } = await supabase.from("ai_config").update(patch).eq("id", row.id);

  if (upErr) {
    return jsonErr(rid, upErr.message, 500, "AI_CONFIG_UPDATE_FAILED");
  }

  return jsonOk(rid, { ok: true }, 200);
}
