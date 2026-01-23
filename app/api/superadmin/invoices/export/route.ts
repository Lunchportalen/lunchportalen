export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  if (!runId || !isUuid(runId)) {
    return jsonError(400, "BAD_RUN_ID", "runId må være en gyldig UUID");
  }

  const supabase = await supabaseServer();

  // Autentisering/rolle: superadmin
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonError(401, "NOT_AUTHENTICATED", "Ikke innlogget");

  const role = String(userData.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return jsonError(403, "FORBIDDEN", "Kun superadmin");

  // Hent eksport fra DB-funksjon
  const { data, error } = await supabase.rpc("tripletex_export_by_run", { p_run_id: runId });
  if (error) return jsonError(500, "RPC_FAILED", "Kunne ikke hente eksportgrunnlag", error);

  const rows = (data ?? []) as Array<{
    run_id: string;
    customer_id: string | null;
    company_name: string;
    description: string;
    period_from: string;
    period_to: string;
    quantity: number;
    unit_price_ex_vat: number | null;
    amount_ex_vat: number | null;
    vat_code: string | null;
    status: string;
  }>;

  if (format === "csv") {
    const header = [
      "run_id",
      "customer_id",
      "company_name",
      "description",
      "period_from",
      "period_to",
      "quantity",
      "unit_price_ex_vat",
      "amount_ex_vat",
      "vat_code",
      "status",
    ];

    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.run_id,
          r.customer_id ?? "",
          r.company_name,
          r.description,
          r.period_from,
          r.period_to,
          r.quantity,
          r.unit_price_ex_vat ?? "",
          r.amount_ex_vat ?? "",
          r.vat_code ?? "",
          r.status,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ];

    const body = lines.join("\n");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tripletex_export_${runId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ ok: true, runId, rows }, { status: 200 });
}
