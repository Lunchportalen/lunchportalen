import { trackEvent } from "@/lib/experiments/tracker";
import type { ExperimentEventType } from "@/lib/experiments/types";
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

const EVENTS = new Set(["view", "impression", "click", "conversion"]);

export async function POST(req: Request) {
  const requestId = makeRid("exp_track");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = body as {
    experimentId?: unknown;
    variantId?: unknown;
    eventType?: unknown;
    userId?: unknown;
  };

  const experimentId = typeof o.experimentId === "string" ? o.experimentId.trim() : "";
  const variantId = typeof o.variantId === "string" ? o.variantId.trim() : "";
  const eventType = typeof o.eventType === "string" ? o.eventType.trim() : "";
  const userId =
    o.userId === null || o.userId === undefined
      ? null
      : typeof o.userId === "string"
        ? o.userId.trim()
        : "";

  if (!experimentId || !isUuid(experimentId)) {
    return errJson(requestId, "experimentId (uuid) is required", 422);
  }
  if (!variantId) {
    return errJson(requestId, "variantId is required", 422);
  }
  if (!EVENTS.has(eventType)) {
    return errJson(requestId, "eventType must be view, impression, click, or conversion", 422);
  }
  if (userId !== null && userId !== "" && !isUuid(userId)) {
    return errJson(requestId, "userId must be a UUID when provided", 422);
  }

  let supabase;
  try {
    supabase = supabaseAdmin();
  } catch {
    return errJson(requestId, "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
  }

  try {
    const { data: vrow, error: vErr } = await supabase
      .from("experiment_variants")
      .select("id")
      .eq("experiment_id", experimentId)
      .eq("variant_id", variantId)
      .maybeSingle();
    if (vErr) return errJson(requestId, "Validation failed", 500);
    if (!vrow) return errJson(requestId, "Unknown variant for experiment", 404);

    const { data: exp } = await supabase.from("experiments").select("status").eq("id", experimentId).maybeSingle();
    if (!exp || (exp as { status: string }).status !== "running") {
      return errJson(requestId, "Experiment not running", 409);
    }
  } catch {
    return errJson(requestId, "Validation failed", 500);
  }

  const out = await trackEvent({
    experimentId,
    variantId,
    eventType: eventType as ExperimentEventType,
    userId: userId === "" ? null : userId,
  });

  if (out.ok === false) return errJson(requestId, out.error, 500);
  return okJson(requestId, { recorded: true }, 200);
}
