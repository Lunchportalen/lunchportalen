

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { loadTripletexExportByRun } from "@/lib/superadmin/tripletexExportByRun";

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
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  if (!runId || !isUuid(runId)) {
    return jsonErr(rid, "runId må være en gyldig UUID", 400, "BAD_RUN_ID");
  }

  const { requireSuperadminApi } = await import("@/lib/superadmin/auth");
  const guard = await requireSuperadminApi();
  if (guard.ok === false) {
    return jsonErr(rid, guard.message, guard.status, guard.status === 401 ? "NOT_AUTHENTICATED" : "FORBIDDEN");
  }

  const result = await loadTripletexExportByRun(runId);
  if (result.ok === false) {
    const status = result.code === "NOT_FOUND" ? 404 : 500;
    return jsonErr(rid, result.message, status, { code: result.code, detail: result.detail });
  }

  const rows = result.rows;

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
