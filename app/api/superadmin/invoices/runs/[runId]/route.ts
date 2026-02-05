export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

/**
 * Hos dere kan supabaseAdmin være:
 * - et client-objekt (med .from)
 * - ELLER en factory-funksjon som returnerer client
 * Vi normaliserer til et "db"-objekt.
 */
async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

async function requireSuperadmin() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, status: 401, message: "Ikke innlogget" };

  const role = String(data.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return { ok: false as const, status: 403, message: "Ingen tilgang" };

  return { ok: true as const, userId: data.user.id };
}

type InvoiceLine = {
  id: string;
  company_id: string;
  company_name: string | null;
  plan_tier: string | null;
  price_ex_vat: number | null;
  billable_qty: number;
  cancelled_qty: number;
  cancelled_before_0800_qty: number;
  amount_ex_vat: number | null;
  flags: string | null;
};

export async function GET(_: Request, ctx: { params: { runId: string } }) {
  const rid = makeRid();
  const guard = await requireSuperadmin();
  if (!guard.ok) return jsonErr(rid, guard.message, guard.status ?? 400, "AUTH");

  const runId = ctx.params.runId;
  if (!isUuid(runId)) return jsonErr(rid, "Ugyldig runId", 400, "BAD_REQUEST");

  const db = await adminDb();
  if (!db?.from) return jsonErr(rid, "supabaseAdmin er ikke tilgjengelig (mangler .from)", 500, "ADMIN_CLIENT_MISSING");

  // 1) run
  const runRes = await db
    .from("invoice_runs")
    .select("id, period_from, period_to, status, created_at, note")
    .eq("id", runId)
    .single();

  if (runRes.error) return jsonErr(rid, "Fant ikke invoice run", 404, { code: "NOT_FOUND", detail: runRes.error });

  // 2) lines
  const linesRes = await db
    .from("invoice_lines")
    .select(
      "id, company_id, company_name, plan_tier, price_ex_vat, billable_qty, cancelled_qty, cancelled_before_0800_qty, amount_ex_vat, flags"
    )
    .eq("run_id", runId)
    .order("company_name", { ascending: true });

  if (linesRes.error) return jsonErr(rid, "Kunne ikke hente invoice lines", 500, { code: "DB", detail: linesRes.error });

  const lines = (linesRes.data ?? []) as InvoiceLine[];

  // Hvis ingen linjer, returner tom struktur (UI skal ikke knekke)
  if (!lines.length) {
    return jsonOk(rid, {
      run: runRes.data,
      rows: [],
      totals: { companies: 0, billable: 0, amount: 0, missingCustomer: 0, missingPrice: 0 },
    });
  }

  const companyIds = Array.from(new Set(lines.map((l) => l.company_id)));

  // 3) Tripletex mapping pr firma
  const mapRes = await db
    .from("company_billing_accounts")
    .select("company_id, tripletex_customer_id, product_name, vat_code")
    .in("company_id", companyIds);

  if (mapRes.error) return jsonErr(rid, "Kunne ikke hente billing mapping", 500, { code: "DB", detail: mapRes.error });

  const map = new Map<string, any>();
  for (const m of mapRes.data ?? []) map.set(m.company_id, m);

  const rows = lines.map((l) => {
    const m = map.get(l.company_id) ?? null;
    const export_status = !m?.tripletex_customer_id
      ? "MISSING_CUSTOMER_ID"
      : l.flags
      ? String(l.flags)
      : "OK";

    return {
      ...l,
      tripletex_customer_id: m?.tripletex_customer_id ?? null,
      product_name: m?.product_name ?? null,
      vat_code: m?.vat_code ?? null,
      export_status,
    };
  });

  // 4) totals
  const totals = rows.reduce(
    (acc, r) => {
      acc.companies += 1;
      acc.billable += Number(r.billable_qty ?? 0);
      acc.amount += Number(r.amount_ex_vat ?? 0);
      acc.missingCustomer += r.export_status === "MISSING_CUSTOMER_ID" ? 1 : 0;
      acc.missingPrice += String(r.export_status ?? "").includes("MISSING_PRICE") ? 1 : 0;
      return acc;
    },
    { companies: 0, billable: 0, amount: 0, missingCustomer: 0, missingPrice: 0 }
  );

  return jsonOk(rid, { run: runRes.data, rows, totals });
}
