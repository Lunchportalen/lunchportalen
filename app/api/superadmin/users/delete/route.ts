// app/api/superadmin/users/delete/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { systemRoleByEmail } from "@/lib/system/emails";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

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
  if (!(await isSuperadminProfile(user.id))) throw Object.assign(new Error("forbidden"), { code: "forbidden" });
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

    if (!isUuid(user_id)) return jsonErr(rid, "Ugyldig user_id.", 400, "invalid_user_id");

    // Les profil for å få epost (og sperre systemkonto)
    const prof = await admin
      .from("profiles")
      .select("user_id,email,role,company_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prof.error) return jsonErr(rid, "Kunne ikke lese profil.", 500, { code: "profile_read_failed", detail: prof.error });

    const email = prof.data?.email ? String(prof.data.email) : null;
    if (email && isProtectedSystemEmail(email)) {
      return jsonErr(rid, "Systemkonto kan ikke slettes.", 403, "protected_account");
    }

    // 1) Slett pending invites knyttet til epost
    if (email) {
      const delInv = await admin.from("employee_invites").delete().eq("email", email);
      if (delInv.error) {
        return jsonErr(rid, "Kunne ikke slette invitasjoner.", 500, { code: "invites_delete_failed", detail: delInv.error });
      }
    }

    // 2) Slett profil (hvis finnes)
    if (prof.data?.user_id) {
      const delProf = await admin.from("profiles").delete().eq("user_id", user_id);
      if (delProf.error) {
        return jsonErr(rid, "Kunne ikke slette profil.", 500, { code: "profile_delete_failed", detail: delProf.error });
      }
    } else {
      // Hvis ingen profil, forsøker vi likevel å slette eventuelle profiler med user_id
      await admin.from("profiles").delete().eq("user_id", user_id);
    }

    // 3) Slett auth-user (kilden til “email exists”)
    const delAuth = await admin.auth.admin.deleteUser(user_id);
    if (delAuth.error) {
      return jsonErr(rid, "Profil/invites slettet, men auth-user kunne ikke slettes.", 500, { code: "auth_delete_failed", detail: delAuth.error });
    }

    return jsonOk(rid, { ok: true, rid, message: "Bruker slettet." }, 200);
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonErr(rid, "Ikke innlogget.", 401, "not_authenticated");
    if (code === "forbidden") return jsonErr(rid, "Ingen tilgang.", 403, "forbidden");
    return jsonErr(rid, "Uventet feil.", 500, { code: "server_error", detail: String(e?.message ?? e) });
  }
}
