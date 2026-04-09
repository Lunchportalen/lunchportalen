import { assignVariant } from "@/lib/experiments/assign";
import { makeRid } from "@/lib/http/rid";
import { supabaseAdmin } from "@/lib/supabase/admin";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

function okJson(ridValue: string, data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, rid: ridValue, data }), { status, headers: JSON_HEADERS });
}

function errJson(ridValue: string, error: string, status: number, message?: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      rid: ridValue,
      error,
      message: message ?? error,
      status,
    }),
    { status, headers: JSON_HEADERS },
  );
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request) {
  const requestId = makeRid("exp_assign");
  const url = new URL(req.url);
  const experimentId = (url.searchParams.get("experimentId") ?? "").trim();
  const userId = (url.searchParams.get("userId") ?? "").trim();

  if (!experimentId || !isUuid(experimentId)) {
    return errJson(requestId, "experimentId (uuid) is required", 422);
  }
  if (!userId || !isUuid(userId)) {
    return errJson(
      requestId,
      "userId (uuid) is required — use a stable anonymous UUID in storage when logged out",
      422,
    );
  }

  let supabase;
  try {
    supabase = supabaseAdmin();
  } catch {
    return errJson(requestId, "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
  }

  try {
    const { data: exp, error: e1 } = await supabase
      .from("experiments")
      .select("id,status")
      .eq("id", experimentId)
      .maybeSingle();
    if (e1) return errJson(requestId, "Experiment lookup failed", 500);
    if (!exp || (exp as { status: string }).status !== "running") {
      return errJson(requestId, "Experiment not running", 404);
    }

    const { data: rows, error: e2 } = await supabase
      .from("experiment_variants")
      .select("variant_id,weight,blocks")
      .eq("experiment_id", experimentId);
    if (e2) return errJson(requestId, "Variants lookup failed", 500);
    if (!rows?.length) return errJson(requestId, "No variants configured", 404);

    const weights = (rows as { variant_id: string; weight: number }[]).map((r) => ({
      variantId: r.variant_id,
      weight: r.weight,
    }));

    let variantId: string;
    try {
      variantId = assignVariant(experimentId, userId, weights).variantId;
    } catch {
      return errJson(requestId, "Assignment failed", 500);
    }

    const row = (rows as { variant_id: string; blocks: unknown }[]).find((r) => r.variant_id === variantId);
    return okJson(requestId, { variantId, blocks: row?.blocks ?? [] }, 200);
  } catch {
    return errJson(requestId, "Assignment failed", 500);
  }
}
