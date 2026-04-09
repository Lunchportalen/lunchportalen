import { NextRequest } from "next/server";
import { parseGrowthAbFromCookieHeader } from "@/lib/growth/growthAbCookie";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

const RATE_PER_MINUTE = 30;

const rateMap = new Map<string, number>();

function minuteBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

function rateKey(ip: string): string {
  return `demo-interest:${ip}:${minuteBucket()}`;
}

function isValidEmail(s: string): boolean {
  if (s.length < 5 || s.length > 254) return false;
  // Enkel, deterministisk sjekk — ingen «smart» parsing.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: NextRequest) {
  const rid = makeRid("dil");
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErr(rid, "Ugyldig JSON", 400, "INVALID_JSON");
    }
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    if (!o) {
      return jsonErr(rid, "Body må være et objekt", 400, "INVALID_BODY");
    }
    const raw = o.email != null ? String(o.email).trim() : "";
    const emailNorm = raw.toLowerCase();
    if (!isValidEmail(emailNorm)) {
      return jsonErr(rid, "Ugyldig e-postadresse", 422, "INVALID_EMAIL");
    }

    const fwd = request.headers.get("x-forwarded-for");
    const ip = (fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 64);
    const rk = rateKey(ip);
    const n = (rateMap.get(rk) ?? 0) + 1;
    rateMap.set(rk, n);
    if (n > RATE_PER_MINUTE) {
      return jsonErr(rid, "For mange forsøk", 429, "RATE_LIMIT_EXCEEDED");
    }

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("demo_interest_leads").insert({
      email: emailNorm,
      source: "public_ai_demo",
    });
    if (error) {
      return jsonErr(rid, error.message, 500, "INSERT_FAILED");
    }

    try {
      const postRaw =
        o.postId != null
          ? String(o.postId).trim()
          : o.post_id != null
            ? String(o.post_id).trim()
            : "";
      if (postRaw) {
        const ab = parseGrowthAbFromCookieHeader(request.headers.get("cookie"));
        const { upsertLeadFromSocial } = await import("@/lib/pipeline/upsertLead");
        await upsertLeadFromSocial({
          postId: postRaw,
          company: "Ukjent",
          email: emailNorm,
          abVariantId: ab?.variantId ?? null,
        });
      }
    } catch {
      /* best-effort */
    }

    return jsonOk(rid, { received: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonErr(rid, message, 500, "SERVER_ERROR");
  }
}
