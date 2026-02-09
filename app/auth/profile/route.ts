export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function GET() {
  const rid = makeRid();

  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();

  const { data: auth } = await sb.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED");
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, company_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.id) {
    return jsonErr(rid, "Brukerprofil mangler.", 403, "PROFILE_NOT_FOUND");
  }

  if (profile.is_active === false) {
    return jsonErr(rid, "Konto deaktivert.", 403, "ACCOUNT_DISABLED");
  }

  return jsonOk(rid, {
    ok: true,
    rid,
    pending: false,
    profileExists: true,
    profile,
  });
}
