

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

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
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  if (!runId || !isUuid(runId)) {
    return jsonErr(rid, "runId må være en gyldig UUID", 400, "BAD_RUN_ID");
  }

  const supabase = await supabaseServer();

  // Autentisering/rolle: superadmin
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonErr(rid, "Ikke innlogget", 401, "NOT_AUTHENTICATED");

  const role = String(userData.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return jsonErr(rid, "Kun superadmin", 403, "FORBIDDEN");

  // Hent eksport fra DB-funksjon
  const { data, error } = await supabase.rpc("tripletex_export_by_run", { p_run_id: runId });
  if (error) return jsonErr(rid, "Kunne ikke hente eksportgrunnlag", 500, { code: "RPC_FAILED", detail: error });

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
        ...noStoreHeaders(),
        "x-lp-rid": rid,
      },
    });
  }

  return jsonOk(rid, { runId, rows });
}

