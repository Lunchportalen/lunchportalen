// app/api/superadmin/users/disable/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isSuperadminEmail, systemRoleByEmail } from "@/lib/system/emails";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function safeText(v: any, max = 200) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

async function requireSuperadmin() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const { data: auth, error } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (error || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });
  if (!isSuperadminEmail(user.email)) throw Object.assign(new Error("forbidden"), { code: "forbidden" });
  return user;
}

function isProtectedSystemEmail(email: string) {
  return systemRoleByEmail(email) !== null;
}

export async function POST(req: Request) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    await requireSuperadmin();
    const admin = supabaseAdmin();

    const body = await req.json().catch(() => ({}));
    const user_id = String(body.user_id ?? "");
    const reason = safeText(body.reason ?? "Disabled by superadmin", 200);

    if (!isUuid(user_id)) return jsonErr(rid, "Ugyldig user_id.", 400, "invalid_user_id");

    // Hent profil
    const prof = await admin
      .from("profiles")
      .select("user_id,email,role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prof.error) return jsonErr(rid, "Kunne ikke lese profil.", 500, { code: "profile_read_failed", detail: prof.error });
    if (!prof.data) return jsonErr(rid, "Fant ikke bruker.", 404, "not_found");

    const email = String(prof.data.email ?? "");
    if (email && isProtectedSystemEmail(email)) {
      return jsonErr(rid, "Systemkonto kan ikke deaktiveres.", 403, "protected_account");
    }

    // Deaktiver profil (ingen auth-slett her)
    const upd = await admin
      .from("profiles")
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        disabled_reason: reason,
      })
      .eq("user_id", user_id);

    if (upd.error) return jsonErr(rid, "Kunne ikke deaktivere bruker.", 500, { code: "disable_failed", detail: upd.error });

    return jsonOk(rid, { ok: true, rid, message: "Bruker deaktivert." }, 200);
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonErr(rid, "Ikke innlogget.", 401, "not_authenticated");
    if (code === "forbidden") return jsonErr(rid, "Ingen tilgang.", 403, "forbidden");
    return jsonErr(rid, "Uventet feil.", 500, { code: "server_error", detail: String(e?.message ?? e) });
  }
}
