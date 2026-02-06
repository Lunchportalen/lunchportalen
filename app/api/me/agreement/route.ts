// app/api/me/agreement/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type ProfileRow = {
  company_id: string | null;
  role: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
};

export async function GET() {
  const rid = makeRid();

  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");

    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    if (error || !user) {
      return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHENTICATED");
    }

    // ✅ Supabase query builder er "thenable" i typings.
    // Vi gjør den til en ekte Promise via Promise.resolve(...)
    const profRes = (await Promise.resolve(
      sb
        .from("profiles")
        .select("company_id, role, is_active, disabled_at")
        .eq("user_id", user.id)
        .maybeSingle()
    )) as { data: ProfileRow | null; error: any };

    if (profRes.error) {
      return jsonErr(rid, "Kunne ikke hente profil.", 500, "PROFILE_READ_FAILED");
    }

    const profile = profRes.data;
    if (!profile?.company_id) {
      return jsonOk(
        rid,
        {
          hasAgreement: false,
          reason: "NO_COMPANY",
        },
        200
      );
    }

    let admin: ReturnType<typeof supabaseAdmin>;
    try {
      admin = supabaseAdmin();
    } catch (e: any) {
      return jsonErr(rid, "Mangler service role key.", 500, "SERVICE_ROLE_MISSING");
    }

    const { data: agreement, error: aErr } = await admin
      .from("company_current_agreement")
      .select("*")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (aErr) {
      return jsonErr(rid, "Kunne ikke hente avtale.", 500, "AGREEMENT_READ_FAILED");
    }

    if (agreement?.company_id && String(agreement.company_id) !== String(profile.company_id)) {
      return jsonErr(rid, "Avtale matcher ikke firmatilknytning.", 403, "AGREEMENT_SCOPE_MISMATCH");
    }

    return jsonOk(
      rid,
      {
        hasAgreement: Boolean(agreement),
        company_id: profile.company_id,
        agreement: agreement ?? null,
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil ved avtaleoppslag.", 500, "ME_AGREEMENT_FAILED");
  }
}
