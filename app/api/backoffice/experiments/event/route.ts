import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordView, recordClick, recordConversion } from "@/lib/ai/experiments/analytics";

export const dynamic = "force-dynamic";

const rateLimitMap = new Map<string, { count: number; ts: number }>();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 120;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.ts > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, ts: now });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const rid = makeRid("exp");
  const secret = process.env.EXPERIMENT_INGEST_SECRET;
  const headerSecret = request.headers.get("x-lp-experiment-secret") ?? "";
  if (!secret || headerSecret !== secret) {
    return jsonErr(rid, "Unauthorized", 401, "UNAUTHORIZED");
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  if (!rateLimitOk(ip)) {
    return jsonErr(rid, "Too many requests", 429, "RATE_LIMIT");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const experimentId = typeof o.experimentId === "string" ? o.experimentId.trim() : "";
  const variant = typeof o.variant === "string" ? o.variant.trim().slice(0, 40) : "";
  const event = o.event === "view" || o.event === "click" || o.event === "conversion" ? o.event : null;

  if (!experimentId || experimentId.length > 80) return jsonErr(rid, "Ugyldig experimentId.", 400, "BAD_REQUEST");
  if (!variant) return jsonErr(rid, "Ugyldig variant.", 400, "BAD_REQUEST");
  if (!event) return jsonErr(rid, "Ugyldig event.", 400, "BAD_REQUEST");

  const supabase = supabaseAdmin();
  if (event === "view") await recordView(supabase, experimentId, variant);
  else if (event === "click") await recordClick(supabase, experimentId, variant);
  else await recordConversion(supabase, experimentId, variant);

  await supabase.from("ai_activity_log").insert({
    page_id: null,
    variant_id: null,
    environment: "preview",
    locale: "nb",
    action: "experiment_event",
    tool: "experiment_ingest",
    metadata: { experimentId, variant, event },
  });

  return jsonOk(rid, { ok: true }, 200);
}