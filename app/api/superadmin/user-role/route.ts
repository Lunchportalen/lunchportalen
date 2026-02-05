
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit/log";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function isRole(x: any): x is Role {
  return x === "employee" || x === "company_admin" || x === "superadmin" || x === "kitchen" || x === "driver";
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const rid = makeRid();
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { supabaseServer } = await import("@/lib/supabase/server");
  const body = await req.json().catch(() => ({}));
  const targetUserId = (body?.userId ?? "").toString().trim();
  const newRole = body?.role;

  if (!targetUserId || !isRole(newRole)) {
    return jsonErr(rid, "Ugyldig input.", 400, "BAD_REQUEST");
  }

  // Session + superadmin guard
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const actor = userRes?.user ?? null;

  if (!actor) return jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED");

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", actor.id)
    .maybeSingle();

  if (actorProfile?.role !== "superadmin") {
    return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonErr(rid, "Mangler service role key.", 500, "MISSING_SERVICE_ROLE_KEY");
  }

  const admin = supabaseAdmin();

  // Hent eksisterende (for audit)
  const { data: existing, error: exErr } = await admin
    .from("profiles")
    .select("user_id, role, email, full_name, company_id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (exErr) {
    return jsonErr(rid, "Kunne ikke hente profil.", 500, { code: "LOOKUP_FAILED", detail: exErr.message });
  }
  if (!existing) {
    return jsonErr(rid, "Fant ikke bruker.", 404, "NOT_FOUND");
  }

  const prevRole = (existing.role ?? "employee") as Role;
  if (prevRole === newRole) {
    return jsonOk(rid, { ok: true, note: "No change" }, 200);
  }

  // Optional safety: hindre at superadmin degraderer seg selv utilsiktet
  if (actor.id === targetUserId && newRole !== "superadmin") {
    return jsonErr(rid, "Kan ikke degradere egen superadmin-rolle.", 400, "SELF_DOWNGRADE_BLOCKED");
  }

  const { error: upErr } = await admin
    .from("profiles")
    .update({ role: newRole })
    .eq("user_id", targetUserId);

  if (upErr) {
    return jsonErr(rid, "Kunne ikke oppdatere rolle.", 500, { code: "UPDATE_FAILED", detail: upErr.message });
  }

  // Audit (fail-quiet)
  try {
    await writeAudit({
      actor_user_id: actor.id,
      actor_role: "superadmin",
      action: "user.role_changed",
      severity: "warning",
      company_id: existing.company_id ?? null,
      target_type: "profile",
      target_id: targetUserId,
      target_label: existing.email ?? existing.full_name ?? targetUserId,
      before: { role: prevRole },
      after: { role: newRole },
      meta: { email: existing.email ?? null },
    });
  } catch {}

  return jsonOk(rid, { ok: true, prevRole, newRole }, 200);
}


