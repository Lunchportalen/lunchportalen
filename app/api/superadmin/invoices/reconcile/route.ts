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
  nextMonthStart: string;
};

type ReconcileStatus = "OK" | "AVVIK";

type InvoiceLineRow = {
  reference: string | null;
  company_id: string | null;
  quantity: number | null;
  export_status: string | null;
  locked: boolean | null;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(value: unknown): string {
  return safeStr(value).toUpperCase();
}

function parseMonth(raw: string): ParsedMonth | null {
  const month = safeStr(raw);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mm = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(mm)) return null;

  const monthStart = `${month}-01`;
  const nextMonthStart = new Date(Date.UTC(year, mm, 1)).toISOString().slice(0, 10);
  return { month, monthStart, nextMonthStart };
}

function parsePagination(limitRaw: unknown, offsetRaw: unknown): { limit: number; offset: number } {
  const limitN = Math.floor(safeNum(limitRaw));
  const offsetN = Math.floor(safeNum(offsetRaw));
  const limit = limitN > 0 ? Math.min(limitN, 500) : 100;
  const offset = offsetN >= 0 ? offsetN : 0;
  return { limit, offset };
}

function isMissingRelationOrColumn(err: any): boolean {
  const code = safeStr(err?.code).toLowerCase();
  const msg = safeStr(err?.message || err?.details || err?.hint).toLowerCase();
  return (
    code === "42p01" ||
    code === "42703" ||
    code === "pgrst205" ||
    msg.includes("relation") ||
    msg.includes("does not exist") ||
    msg.includes("column") ||
    msg.includes("schema cache")
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.reconcile.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const parsed = parseMonth(url.searchParams.get("month") ?? "");
  if (!parsed) return jsonErr(ctx.rid, "month ma vaere pa formatet YYYY-MM.", 400, "BAD_REQUEST");

  const { limit, offset } = parsePagination(url.searchParams.get("limit"), url.searchParams.get("offset"));
  const admin = supabaseAdmin();

  try {
    const { data: companyRows, error: companyError, count } = await admin
      .from("companies")
      .select("id,name", { count: "exact" })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (companyError) {
      return jsonErr(ctx.rid, "Kunne ikke hente firmaliste for avstemming.", 500, {
        code: "RECONCILE_COMPANIES_READ_FAILED",
        detail: { message: safeStr(companyError?.message ?? companyError) },
      });
    }

    const companies = Array.isArray(companyRows) ? companyRows : [];
    const companyIds = companies.map((c) => safeStr((c as any).id)).filter(Boolean);

    if (companyIds.length === 0) {
      return jsonOk(ctx.rid, {
        month: parsed.month,
        pagination: {
          limit,
          offset,
          totalCompanies: Number.isFinite(Number(count)) ? Number(count) : 0,
          returned: 0,
        },
        totals: {
          ok: 0,
          avvik: 0,
        },
        rows: [],
      });
    }

    const rollupQty = new Map<string, number>();
    {
      let cursor = 0;
      const pageSize = 2000;
      while (true) {
        const { data, error } = await admin
          .from("daily_company_rollup")
          .select("company_id,ordered_count")
          .in("company_id", companyIds)
          .gte("date", parsed.monthStart)
          .lt("date", parsed.nextMonthStart)
          .range(cursor, cursor + pageSize - 1);

        if (error) {
          if (isMissingRelationOrColumn(error)) {
            return jsonErr(ctx.rid, "Rollup-schema mangler for reconcile.", 500, "ROLLUP_SCHEMA_MISSING");
          }
          return jsonErr(ctx.rid, "Kunne ikke lese rollup-data.", 500, {
            code: "RECONCILE_ROLLUP_READ_FAILED",
            detail: { message: safeStr(error?.message ?? error) },
          });
        }

        const rows = Array.isArray(data) ? data : [];
        for (const row of rows) {
          const companyId = safeStr((row as any).company_id);
          if (!companyId) continue;
          const sum = (rollupQty.get(companyId) ?? 0) + Math.max(0, Math.floor(safeNum((row as any).ordered_count)));
          rollupQty.set(companyId, sum);
        }

        if (rows.length < pageSize) break;
        cursor += pageSize;
      }
    }

    const invoiceByCompany = new Map<
      string,
      {
        qty: number;
        locked: boolean;
        references: string[];
        statuses: string[];
      }
    >();

    {
      let cursor = 0;
      const pageSize = 2000;
      while (true) {
        const { data, error } = await admin
          .from("invoice_lines")
          .select("reference,company_id,quantity,export_status,locked")
          .in("company_id", companyIds)
          .eq("month", parsed.monthStart)
          .range(cursor, cursor + pageSize - 1);

        if (error) {
          if (isMissingRelationOrColumn(error)) {
            return jsonErr(ctx.rid, "Invoice-schema mangler for reconcile.", 500, "INVOICE_SCHEMA_MISSING");
          }
          return jsonErr(ctx.rid, "Kunne ikke lese fakturalinjer for avstemming.", 500, {
            code: "RECONCILE_INVOICE_READ_FAILED",
            detail: { message: safeStr(error?.message ?? error) },
          });
        }

        const rows = (Array.isArray(data) ? data : []) as InvoiceLineRow[];
        for (const row of rows) {
          const companyId = safeStr(row.company_id);
          if (!companyId) continue;
          const bucket = invoiceByCompany.get(companyId) ?? { qty: 0, locked: false, references: [], statuses: [] };

          bucket.qty += Math.max(0, Math.floor(safeNum(row.quantity)));
          bucket.locked = bucket.locked || Boolean(row.locked);

          const ref = safeStr(row.reference);
          if (ref) bucket.references.push(ref);
          bucket.statuses.push(normalizeStatus(row.export_status));

          invoiceByCompany.set(companyId, bucket);
        }

        if (rows.length < pageSize) break;
        cursor += pageSize;
      }
    }

    const rows = companies.map((company) => {
      const companyId = safeStr((company as any).id);
      const rollup = Math.max(0, Math.floor(safeNum(rollupQty.get(companyId) ?? 0)));
      const invoice = invoiceByCompany.get(companyId) ?? {
        qty: 0,
        locked: false,
        references: [] as string[],
        statuses: [] as string[],
      };

      const invoiceQty = Math.max(0, Math.floor(safeNum(invoice.qty)));
      const delta = rollup - invoiceQty;

      let exportStatus = "MISSING";
      if (invoice.statuses.length > 0) {
        if (invoice.statuses.some((s0) => s0 === "FAILED")) exportStatus = "FAILED";
        else if (invoice.statuses.every((s0) => s0 === "EXPORTED")) exportStatus = "EXPORTED";
        else exportStatus = "PENDING_EXPORT";
      }

      const reasons: string[] = [];
      if (invoice.references.length === 0) reasons.push("INVOICE_LINE_MISSING");
      if (delta !== 0) reasons.push("QTY_MISMATCH");
      if (invoice.locked && delta !== 0) reasons.push("LOCKED_PERIOD");
      if (exportStatus !== "EXPORTED") reasons.push("NOT_EXPORTED");

      const reconcileStatus: ReconcileStatus = delta === 0 ? "OK" : "AVVIK";

      return {
        company_id: companyId,
        company_name: safeStr((company as any).name) || "Ukjent firma",
        rollup_qty: rollup,
        invoice_qty: invoiceQty,
        delta,
        export_status: exportStatus,
        locked: invoice.locked,
        reference: invoice.references[0] ?? null,
        reasons,
        reconcile_status: reconcileStatus,
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        if (row.reconcile_status === "OK") acc.ok += 1;
        else acc.avvik += 1;
        return acc;
      },
      { ok: 0, avvik: 0 }
    );

    return jsonOk(ctx.rid, {
      month: parsed.month,
      pagination: {
        limit,
        offset,
        totalCompanies: Number.isFinite(Number(count)) ? Number(count) : rows.length,
        returned: rows.length,
      },
      totals,
      rows,
    });
  } catch (error: any) {
    return jsonErr(ctx.rid, "Kunne ikke kjoere avstemming.", 500, {
      code: "INVOICE_RECONCILE_FAILED",
      detail: {
        message: safeStr(error?.message ?? error),
      },
    });
  }
}
