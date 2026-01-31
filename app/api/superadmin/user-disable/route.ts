
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit/log";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { supabaseServer } = await import("@/lib/supabase/server");
  const body = await req.json().catch(() => ({}));
  const targetUserId = (body?.userId ?? "").toString().trim();
  const disabled = Boolean(body?.disabled);

  if (!targetUserId) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

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

  const { data: existing } = await admin
    .from("profiles")
    .select("user_id,is_disabled,email,full_name,company_id,role")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const prev = Boolean((existing as any).is_disabled);

  const { error: upErr } = await admin
    .from("profiles")
    .update({ is_disabled: disabled })
    .eq("user_id", targetUserId);

  if (upErr) return NextResponse.json({ ok: false, error: "UPDATE_FAILED", detail: upErr.message }, { status: 500 });

  try {
    await writeAudit({
      actor_user_id: actor.id,
      actor_role: "superadmin",
      action: "user.access_changed",
      severity: "warning",
      company_id: (existing as any).company_id ?? null,
      target_type: "profile",
      target_id: targetUserId,
      target_label: (existing as any).email ?? (existing as any).full_name ?? targetUserId,
      before: { is_disabled: prev },
      after: { is_disabled: disabled },
      meta: { role: (existing as any).role ?? null },
    });
  } catch {}

  return NextResponse.json({ ok: true, prevDisabled: prev, disabled }, { status: 200 });
}



