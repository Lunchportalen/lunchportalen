import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function PATCH(req: Request) {
  try {
    // ✅ Auth gate
    const supa = await supabaseServer();
    const { data: auth, error: authErr } = await supa.auth.getUser();

    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Role gate (samme modell som resten: profiles.id = auth.user.id)
    const { data: profile, error: profErr } = await supa
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profErr || !profile?.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const role = profile.role;

    // ✅ Tillat kitchen + superadmin (ev. company_admin hvis du vil)
    if (!["kitchen", "superadmin", "company_admin"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ Input
    const body = await req.json();
    const { delivery_date, delivery_window, company_location_id, status } = body ?? {};

    if (!delivery_date || !delivery_window || !company_location_id || !status) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!["queued", "packed", "delivered"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // ✅ patch
    const patch: any = { status, updated_at: now };
    if (status === "queued") {
      patch.packed_at = null;
      patch.delivered_at = null;
    }
    if (status === "packed") {
      patch.packed_at = now;
      patch.delivered_at = null;
    }
    if (status === "delivered") {
      patch.delivered_at = now;
    }

    // ✅ Data update (service role)
    const supabase = serviceSupabase();

    const { error } = await supabase
      .from("delivery_batches")
      .upsert(
        {
          delivery_date,
          delivery_window,
          company_location_id,
          ...patch,
        },
        { onConflict: "delivery_date,delivery_window,company_location_id" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Bad Request" }, { status: 400 });
  }
}
