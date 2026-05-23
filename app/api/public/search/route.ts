import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  anonRateLimitOk,
  clientIpFromAnonRequest,
  publicSearchQuerySchema,
} from "@/lib/public/anonRouteGuard";

/** djb2 hash (32-bit) for search dedup/analytics key. */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h = h & 0x7fffffff;
  }
  return h;
}

function getEnvironment(): "prod" | "staging" {
  const v = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "").toLowerCase();
  return v === "production" ? "prod" : "staging";
}

export async function GET(request: NextRequest) {
  const rid = makeRid("search");
  if (request.method !== "GET") {
    return jsonErr(rid, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const ip = clientIpFromAnonRequest(request);
  if (!anonRateLimitOk("public-search", ip, 120)) {
    return jsonErr(rid, "For mange forsøk", 429, "RATE_LIMIT_EXCEEDED");
  }

  const parsed = publicSearchQuerySchema.safeParse({
    q: request.nextUrl?.searchParams?.get("q") ?? "",
    locale: request.nextUrl?.searchParams?.get("locale") ?? "nb",
  });
  if (!parsed.success) {
    return jsonErr(rid, "Ugyldige søkeparametre", 422, "INVALID_QUERY");
  }

  const q = parsed.data.q;
  const safeLocale = parsed.data.locale;
  const response = jsonOk(rid, { ok: true, rid, results: [] }, 200);

  // Best-effort analytics insert; must not break or delay the response
  (async () => {
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const supabase = supabaseAdmin();
      const env = getEnvironment();
      const lower = q.toLowerCase();
      const eventKey = String(djb2(lower));
      const eventValue = q.length > 80 ? q.slice(0, 80) : q;
      await supabase.from("content_analytics_events").insert({
        page_id: null,
        variant_id: null,
        environment: env,
        locale: safeLocale,
        event_type: "search",
        event_key: eventKey,
        event_value: eventValue,
        metadata: { resultsCount: 0 },
      });
    } catch {
      // ignore
    }
  })();

  return response;
}
