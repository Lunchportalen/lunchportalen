export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { coverageCheckBodySchema } from "@/lib/public/coverageCheckSchema";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";

async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const rid = makeRid("cov");

  const body = await readJson(req);
  if (!body || typeof body !== "object") {
    return jsonErr(rid, "Ugyldig JSON", 400, "INVALID_JSON");
  }

  const parsed = coverageCheckBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path?.[0] ? String(first.path[0]) : undefined;
    return jsonErr(rid, first?.message ?? "Ugyldig forespørsel", 422, "VALIDATION_FAILED", { field });
  }

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Tjenesten er midlertidig utilgjengelig", 503, "CONFIG_UNAVAILABLE");
  }

  const { postal_code, city } = parsed.data;

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();

    const { count, error: countError } = await supabase
      .from("provider_service_areas")
      .select("id", { count: "exact", head: true })
      .eq("active", true);

    if (countError) {
      return jsonErr(rid, "Kunne ikke sjekke dekning", 500, "COUNT_FAILED");
    }

    const hasServiceAreas = (count ?? 0) > 0;

    if (!hasServiceAreas) {
      return jsonOk(rid, {
        covered: true,
        hasServiceAreas: false,
        postal_code,
        city,
        mvpForward: true,
      });
    }

    const { data: providerId, error: matchError } = await supabase.rpc("lp_match_provider_by_postal_code", {
      p_postal_code: postal_code,
    });

    if (matchError) {
      return jsonErr(rid, "Kunne ikke sjekke dekning", 500, "MATCH_FAILED");
    }

    const covered = typeof providerId === "string" && providerId.length > 0;

    return jsonOk(rid, {
      covered,
      hasServiceAreas: true,
      postal_code,
      city,
      mvpForward: false,
    });
  } catch {
    return jsonErr(rid, "Kunne ikke sjekke dekning", 500, "SERVER_ERROR");
  }
}
