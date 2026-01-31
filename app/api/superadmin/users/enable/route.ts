// app/api/superadmin/users/enable/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

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
  const { supabaseServer } = await import("@/lib/supabase/server");
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
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = `sa_enable_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await requireSuperadmin();
    const admin = supabaseAdmin();

    const body = await req.json().catch(() => ({}));
    const user_id = String(body.user_id ?? "");

    if (!isUuid(user_id)) return json({ ok: false, rid, error: "invalid_user_id" }, 400);

    // Hent profil (for å sperre systemkontoer)
    const prof = await admin.from("profiles").select("user_id,email").eq("user_id", user_id).maybeSingle();
    if (prof.error) return json({ ok: false, rid, error: "profile_read_failed", detail: prof.error }, 500);
    if (!prof.data) return json({ ok: false, rid, error: "not_found" }, 404);

    const email = String(prof.data.email ?? "");
    if (email && isProtectedSystemEmail(email)) {
      return json({ ok: false, rid, error: "protected_account", message: "Systemkonto kan ikke endres her." }, 403);
    }

    // Re-enable
    const upd = await admin
      .from("profiles")
      .update({
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("user_id", user_id);

    if (upd.error) return json({ ok: false, rid, error: "enable_failed", detail: upd.error }, 500);

    return json({ ok: true, rid, message: "Bruker aktivert." });
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return json({ ok: false, rid, error: "not_authenticated" }, 401);
    if (code === "forbidden") return json({ ok: false, rid, error: "forbidden" }, 403);
    return json({ ok: false, rid, error: "server_error", detail: String(e?.message ?? e) }, 500);
  }
}


