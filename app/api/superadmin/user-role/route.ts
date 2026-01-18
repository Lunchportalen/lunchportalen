import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit/log";

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
  const body = await req.json().catch(() => ({}));
  const targetUserId = (body?.userId ?? "").toString().trim();
  const newRole = body?.role;

  if (!targetUserId || !isRole(newRole)) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  // Session + superadmin guard
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const actor = userRes?.user ?? null;

  if (!actor) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", actor.id)
    .maybeSingle();

  if (actorProfile?.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "MISSING_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const admin = supabaseAdmin();

  // Hent eksisterende (for audit)
  const { data: existing, error: exErr } = await admin
    .from("profiles")
    .select("user_id, role, email, full_name, company_id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (exErr) {
    return NextResponse.json({ ok: false, error: "LOOKUP_FAILED", detail: exErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const prevRole = (existing.role ?? "employee") as Role;
  if (prevRole === newRole) {
    return NextResponse.json({ ok: true, note: "No change" }, { status: 200 });
  }

  // Optional safety: hindre at superadmin degraderer seg selv utilsiktet
  if (actor.id === targetUserId && newRole !== "superadmin") {
    return NextResponse.json(
      { ok: false, error: "SELF_DOWNGRADE_BLOCKED" },
      { status: 400 }
    );
  }

  const { error: upErr } = await admin
    .from("profiles")
    .update({ role: newRole })
    .eq("user_id", targetUserId);

  if (upErr) {
    return NextResponse.json({ ok: false, error: "UPDATE_FAILED", detail: upErr.message }, { status: 500 });
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

  return NextResponse.json({ ok: true, prevRole, newRole }, { status: 200 });
}
