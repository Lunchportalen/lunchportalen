export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import {
  LP_ALLERGEN_CODES,
  normalizeLpAllergenCodes,
  normalizeLpAllergenFreeText,
  type LpUserAllergenProfile,
} from "@/lib/allergens/lpUserAllergens";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

const ALLOWED_ROLES = new Set(["employee", "company_admin"]);

async function requireEmployeeSession() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) {
    return { ok: false as const, res: jsonErr(rid, "Ikke innlogget.", 401, { code: "AUTH_REQUIRED" }) };
  }

  const userId = String(data.user.id);
  const profRes = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profRes.error || !profRes.data) {
    return { ok: false as const, res: jsonErr(rid, "Profil mangler.", 403, { code: "PROFILE_MISSING" }) };
  }

  const role = String(profRes.data.role ?? "employee");
  if (!ALLOWED_ROLES.has(role)) {
    return { ok: false as const, res: jsonErr(rid, "Ikke tilgang.", 403, { code: "FORBIDDEN" }) };
  }

  return { ok: true as const, rid, sb, userId };
}

function emptyProfile(userId: string): LpUserAllergenProfile {
  return { user_id: userId, codes: [], free_text: "", updated_at: null };
}

export async function GET() {
  const gate = await requireEmployeeSession();
  if (!gate.ok) return gate.res;

  const { rid, sb, userId } = gate;
  const { data, error } = await (sb as any)
    .from("lp_user_allergens")
    .select("user_id, codes, free_text, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return jsonErr(rid, "Kunne ikke hente allergiprofil.", 500, { code: "DB_ERROR", detail: { message: error.message } });
  }

  if (!data) {
    return jsonOk(rid, { profile: emptyProfile(userId) }, 200);
  }

  return jsonOk(
    rid,
    {
      profile: {
        user_id: userId,
        codes: normalizeLpAllergenCodes(data.codes),
        free_text: normalizeLpAllergenFreeText(data.free_text),
        updated_at: data.updated_at ?? null,
      } satisfies LpUserAllergenProfile,
    },
    200,
  );
}

export async function PUT(req: NextRequest) {
  const gate = await requireEmployeeSession();
  if (!gate.ok) return gate.res;

  const { rid, sb, userId } = gate;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, { code: "BAD_REQUEST" });
  }

  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const codes = normalizeLpAllergenCodes(raw.codes);
  const free_text = normalizeLpAllergenFreeText(raw.free_text);

  const invalid = codes.find((c) => !LP_ALLERGEN_CODES.includes(c));
  if (invalid) {
    return jsonErr(rid, "Ugyldig allergenkode.", 422, { code: "INVALID_CODE", field: "codes" });
  }

  const { data, error } = await (sb as any)
    .from("lp_user_allergens")
    .upsert(
      {
        user_id: userId,
        codes,
        free_text,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id, codes, free_text, updated_at")
    .single();

  if (error) {
    return jsonErr(rid, "Kunne ikke lagre allergiprofil.", 500, { code: "DB_ERROR", detail: { message: error.message } });
  }

  return jsonOk(
    rid,
    {
      profile: {
        user_id: userId,
        codes: normalizeLpAllergenCodes(data.codes),
        free_text: normalizeLpAllergenFreeText(data.free_text),
        updated_at: data.updated_at ?? null,
      } satisfies LpUserAllergenProfile,
    },
    200,
  );
}
