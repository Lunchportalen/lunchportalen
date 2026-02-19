export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ParsedMonth = {
  month: string;
  monthStart: string;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseMonth(raw: string): ParsedMonth | null {
  const month = safeStr(raw);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  return { month, monthStart: `${month}-01` };
}

function parsePagination(inputLimit: unknown, inputOffset: unknown): { limit: number; offset: number } {
  const limitRaw = Math.floor(safeNum(inputLimit));
  const offsetRaw = Math.floor(safeNum(inputOffset));
  const limit = limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
  const offset = offsetRaw >= 0 ? offsetRaw : 0;
  return { limit, offset };
}

function normalizeExportStatus(value: unknown): "PENDING_EXPORT" | "EXPORTED" | "FAILED" {
  const s = safeStr(value).toUpperCase();
  if (s === "EXPORTED") return "EXPORTED";
  if (s === "FAILED") return "FAILED";
  return "PENDING_EXPORT";
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.exports.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const parsedMonth = parseMonth(url.searchParams.get("month") ?? "");
  if (!parsedMonth) return jsonErr(ctx.rid, "month ma vaere pa formatet YYYY-MM.", 400, "BAD_REQUEST");

  const { limit, offset } = parsePagination(url.searchParams.get("limit"), url.searchParams.get("offset"));
  const admin = supabaseAdmin();

  try {
    const { data: invoiceRows, error: invoiceError, count } = await admin
      .from("invoice_lines")
      .select(
        "reference,company_id,month,quantity,unit_price,amount,currency,locked,export_status,export_last_error,tripletex_vat_code,product_tier,product_name",
        { count: "exact" }
      )
      .eq("month", parsedMonth.monthStart)
      .order("reference", { ascending: true })
      .range(offset, offset + limit - 1);

    if (invoiceError) {
      return jsonErr(ctx.rid, "Kunne ikke hente invoice exports.", 500, {
        code: "INVOICE_EXPORTS_READ_FAILED",
        detail: { message: safeStr(invoiceError?.message ?? invoiceError) },
      });
    }

    const lines = Array.isArray(invoiceRows) ? invoiceRows : [];
    const references = lines.map((row) => safeStr((row as any).reference)).filter(Boolean);

    const exportsByRef = new Map<string, { external_id: string | null; exported_at: string | null }>();
    if (references.length > 0) {
      const { data: exportRows, error: exportError } = await admin
        .from("invoice_exports")
        .select("reference,external_id,exported_at")
        .in("reference", references);

      if (exportError) {
        return jsonErr(ctx.rid, "Kunne ikke hente export-logg.", 500, {
          code: "INVOICE_EXPORT_LOG_READ_FAILED",
          detail: { message: safeStr(exportError?.message ?? exportError) },
        });
      }

      for (const row of Array.isArray(exportRows) ? exportRows : []) {
        const reference = safeStr((row as any).reference);
        if (!reference) continue;
        exportsByRef.set(reference, {
          external_id: safeStr((row as any).external_id) || null,
          exported_at: safeStr((row as any).exported_at) || null,
        });
      }
    }

    const rows = lines.map((row) => {
      const reference = safeStr((row as any).reference);
      const exportRow = exportsByRef.get(reference);
      const exportStatus = normalizeExportStatus((row as any).export_status);
      const effectiveStatus: "PENDING_EXPORT" | "EXPORTED" | "FAILED" =
        exportRow?.external_id || exportRow?.exported_at ? "EXPORTED" : exportStatus;

      return {
        reference,
        company_id: safeStr((row as any).company_id),
        month: safeStr((row as any).month),
        quantity: Math.max(0, Math.floor(safeNum((row as any).quantity))),
        unit_price: safeNum((row as any).unit_price),
        amount: safeNum((row as any).amount),
        currency: safeStr((row as any).currency) || "NOK",
        locked: Boolean((row as any).locked),
        export_status: effectiveStatus,
        export_last_error: safeStr((row as any).export_last_error) || null,
        tripletex_vat_code: safeStr((row as any).tripletex_vat_code) || null,
        product_tier: safeStr((row as any).product_tier) || null,
        product_name: safeStr((row as any).product_name) || null,
        external_id: exportRow?.external_id ?? null,
        exported_at: exportRow?.exported_at ?? null,
      };
    });

    return jsonOk(ctx.rid, {
      month: parsedMonth.month,
      pagination: {
        limit,
        offset,
        total: Number.isFinite(Number(count)) ? Number(count) : rows.length,
        returned: rows.length,
      },
      rows,
    });
  } catch (error: any) {
    return jsonErr(ctx.rid, "Invoice exports endpoint feilet.", 500, {
      code: "INVOICE_EXPORTS_ENDPOINT_FAILED",
      detail: { message: safeStr(error?.message ?? error) },
    });
  }
}
