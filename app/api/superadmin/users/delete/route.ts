// app/api/superadmin/users/delete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function json(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function norm(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

async function requireSuperadmin() {
  const sb = await supabaseServer();
  const { data: auth, error } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (error || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });
  if (norm(user.email) !== "superadmin@lunchportalen.no") throw Object.assign(new Error("forbidden"), { code: "forbidden" });
  return user;
}

function isProtectedSystemEmail(email: string) {
  const e = norm(email);
  return e === "superadmin@lunchportalen.no" || e === "kjokken@lunchportalen.no" || e === "driver@lunchportalen.no";
}

export async function POST(req: Request) {
  const rid = `sa_delete_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await requireSuperadmin();
    const admin = supabaseAdmin();

    const body = await req.json().catch(() => ({}));
    const user_id = String(body.user_id ?? "");

    if (!isUuid(user_id)) return json({ ok: false, rid, error: "invalid_user_id" }, 400);

    // Les profil for å få epost (og sperre systemkonto)
    const prof = await admin
      .from("profiles")
      .select("user_id,email,role,company_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prof.error) return json({ ok: false, rid, error: "profile_read_failed", detail: prof.error }, 500);

    const email = prof.data?.email ? String(prof.data.email) : null;
    if (email && isProtectedSystemEmail(email)) {
      return json({ ok: false, rid, error: "protected_account", message: "Systemkonto kan ikke slettes." }, 403);
    }

    // 1) Slett pending invites knyttet til epost
    if (email) {
      const delInv = await admin.from("employee_invites").delete().eq("email", email);
      if (delInv.error) {
        return json({ ok: false, rid, error: "invites_delete_failed", detail: delInv.error }, 500);
      }
    }

    // 2) Slett profil (hvis finnes)
    if (prof.data?.user_id) {
      const delProf = await admin.from("profiles").delete().eq("user_id", user_id);
      if (delProf.error) {
        return json({ ok: false, rid, error: "profile_delete_failed", detail: delProf.error }, 500);
      }
    } else {
      // Hvis ingen profil, forsøker vi likevel å slette eventuelle profiler med user_id
      await admin.from("profiles").delete().eq("user_id", user_id);
    }

    // 3) Slett auth-user (kilden til “email exists”)
    const delAuth = await admin.auth.admin.deleteUser(user_id);
    if (delAuth.error) {
      return json(
        {
          ok: false,
          rid,
          error: "auth_delete_failed",
          message: "Profil/invites slettet, men auth-user kunne ikke slettes.",
          detail: delAuth.error,
        },
        500
      );
    }

    return json({ ok: true, rid, message: "Bruker slettet." });
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return json({ ok: false, rid, error: "not_authenticated" }, 401);
    if (code === "forbidden") return json({ ok: false, rid, error: "forbidden" }, 403);
    return json({ ok: false, rid, error: "server_error", detail: String(e?.message ?? e) }, 500);
  }
}
