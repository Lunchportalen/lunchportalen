export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();

  const { data: auth } = await sb.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = String(profile?.role ?? "");

  const dest =
    role === "superadmin"
      ? "/superadmin"
      : role === "company_admin"
      ? "/admin"
      : role === "kitchen"
      ? "/kitchen"
      : role === "driver"
      ? "/driver"
      : "/week";

  return NextResponse.redirect(new URL(dest, req.url), 303);
}
