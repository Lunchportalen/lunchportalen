import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return NextResponse.json({
    ok: true,
    id: data.user?.id ?? null,
    email: data.user?.email ?? null,
    app_metadata: data.user?.app_metadata ?? null,
  });
}
