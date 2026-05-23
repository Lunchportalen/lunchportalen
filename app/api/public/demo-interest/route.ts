import { NextRequest } from "next/server";
import { parseGrowthAbFromCookieHeader } from "@/lib/growth/growthAbCookie";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  anonRateLimitOk,
  clientIpFromAnonRequest,
  publicDemoInterestBodySchema,
} from "@/lib/public/anonRouteGuard";

const RATE_PER_MINUTE = 30;

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
    const validated = publicDemoInterestBodySchema.safeParse(o);
    if (!validated.success) {
      return jsonErr(rid, "Ugyldig e-postadresse", 422, "INVALID_EMAIL");
    }
    const emailNorm = validated.data.email.toLowerCase();

    const ip = clientIpFromAnonRequest(request);
    if (!anonRateLimitOk("demo-interest", ip, RATE_PER_MINUTE)) {
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
        validated.data.postId?.trim() ||
        validated.data.post_id?.trim() ||
        "";
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
