

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export async function POST(req: Request) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonError(401, "NOT_AUTHENTICATED", "Ikke innlogget");

  const role = String(userData.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return jsonError(403, "FORBIDDEN", "Kun superadmin");

  const body = await req.json().catch(() => null);
  const company_id = body?.company_id;
  const tripletex_customer_id = String(body?.tripletex_customer_id ?? "").trim() || null;

  if (!isUuid(company_id)) return jsonError(400, "BAD_COMPANY_ID", "company_id må være UUID");

  // Upsert
  const { error } = await supabase.from("company_billing_accounts").upsert(
    {
      company_id,
      tripletex_customer_id,
    },
    { onConflict: "company_id" }
  );

  if (error) return jsonError(500, "UPSERT_FAILED", "Kunne ikke lagre mapping", error);

  return NextResponse.json({ ok: true }, { status: 200 });
}



