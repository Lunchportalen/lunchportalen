// app/api/superadmin/invoices/csv/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { defaultInvoiceWindowISO, isIsoDate } from "@/lib/billing/period";
import { toCsv, type InvoiceRow } from "@/lib/billing/csv";
import { safeTier, unitPriceNOK, type PlanTier } from "@/lib/billing/pricing";
import { isSuperadminEmail } from "@/lib/system/emails";
import { jsonErr, makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

function csvResponse(csv: string, filename: string, rid: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...noStoreHeaders(),
      "x-lp-rid": rid,
    },
  });
}

type Agreement = {
  company_id: string;
  plan_tier: string | null;
  start_date: string | null;
  end_date: string | null;
};

function overlaps(a: Agreement, dateISO: string) {
  const start = a.start_date ?? "0000-01-01";
  const end = a.end_date ?? "9999-12-31";
  return start <= dateISO && dateISO <= end;
}

function pickTierForDate(agreements: Agreement[], dateISO: string): PlanTier {
  const matches = agreements
    .filter((a) => overlaps(a, dateISO))
    .sort((x, y) => String(y.start_date ?? "").localeCompare(String(x.start_date ?? "")));
  return safeTier(matches[0]?.plan_tier);
}

/** supabaseAdmin kan være client eller factory */
async function adminClient(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

export async function GET(req: Request) {
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  // cookie-auth: må være innlogget
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) return jsonErr(rid, "Ikke innlogget", 401, "unauthorized");

  // ✅ Hard superadmin gate (ikke metadata)
  if (!isSuperadminEmail(user.email)) return jsonErr(rid, "Ingen tilgang", 403, "forbidden");

  // (valgfritt ekstra-lag): hvis dere senere vil sjekke profiles.role, gjør det her.

  const url = new URL(req.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");
  const companyId = String(url.searchParams.get("companyId") ?? "").trim() || null;

  const def = defaultInvoiceWindowISO();
  const from = isIsoDate(qFrom) ? qFrom! : def.from;
  const to = isIsoDate(qTo) ? qTo! : def.to;

  if (from >= to) return jsonErr(rid, "Ugyldig periode", 400, { code: "bad_range", detail: { from, to } });

  // ✅ Service role (RLS skal ikke stoppe fakturagrunnlag)
  const admin = await adminClient();

  // companies
  const cQ = admin.from("companies").select("id,name");
  const cRes = companyId ? await cQ.eq("id", companyId) : await cQ;
  if (cRes.error) return jsonErr(rid, "Kunne ikke hente firma", 500, { code: "db_error", detail: cRes.error });

  const companies = cRes.data ?? [];
  const companyNameById = new Map<string, string>();
  for (const c of companies) companyNameById.set(c.id, String((c as any).name ?? "—"));

  const companyIds = companies.map((c: any) => c.id);
  if (!companyIds.length) return csvResponse(toCsv([]), `invoice_ALL_${from}_to_${to}.csv`, rid);

  // locations
  const locRes = await admin.from("company_locations").select("id,name,company_id").in("company_id", companyIds);
  if (locRes.error) return jsonErr(rid, "Kunne ikke hente lokasjoner", 500, { code: "db_error", detail: locRes.error });

  const locName = new Map<string, string>();
  for (const l of locRes.data ?? []) locName.set(l.id, String((l as any).name ?? ""));

  // agreements
  const agRes = await admin
    .from("company_agreements")
    .select("company_id,plan_tier,start_date,end_date")
    .in("company_id", companyIds)
    .order("start_date", { ascending: false });

  if (agRes.error) return jsonErr(rid, "Kunne ikke hente avtaler", 500, { code: "db_error", detail: agRes.error });

  const agreementsByCompany = new Map<string, Agreement[]>();
  for (const a of agRes.data ?? []) {
    const cid = String((a as any).company_id);
    const arr = agreementsByCompany.get(cid) ?? [];
    arr.push({
      company_id: cid,
      plan_tier: (a as any).plan_tier ?? null,
      start_date: (a as any).start_date ?? null,
      end_date: (a as any).end_date ?? null,
    });
    agreementsByCompany.set(cid, arr);
  }

  // orders
  // ✅ prefer-const fix: oQ reassignes ikke
  const oQ = admin
    .from("orders")
    .select("company_id,date,location_id,slot,status")
    .in("company_id", companyIds)
    .gte("date", from)
    .lt("date", to)
    .eq("status", "ACTIVE");

  const oRes = await oQ;
  if (oRes.error) return jsonErr(rid, "Kunne ikke hente ordre", 500, { code: "db_error", detail: oRes.error });

  // group: company + date + location + slot + tier
  const buckets = new Map<
    string,
    { company_id: string; date: string; location_id: string | null; slot: string | null; tier: PlanTier; qty: number }
  >();

  for (const o of oRes.data ?? []) {
    const cid = String((o as any).company_id);
    const dateISO = String((o as any).date);
    const location_id = (o as any).location_id ? String((o as any).location_id) : null;
    const slot = (o as any).slot ? String((o as any).slot) : null;

    const ag = agreementsByCompany.get(cid) ?? [];
    const tier = pickTierForDate(ag, dateISO);

    const key = [cid, dateISO, location_id ?? "", slot ?? "", tier].join("|");
    const cur = buckets.get(key);
    if (cur) cur.qty += 1;
    else buckets.set(key, { company_id: cid, date: dateISO, location_id, slot, tier, qty: 1 });
  }

  const rows: InvoiceRow[] = Array.from(buckets.values())
    .sort((a, b) => (a.company_id + a.date).localeCompare(b.company_id + b.date))
    .map((b) => {
      const unit = unitPriceNOK(b.tier);
      return {
        company_id: b.company_id,
        company_name: companyNameById.get(b.company_id) ?? "—",
        location_id: b.location_id,
        location_name: b.location_id ? locName.get(b.location_id) ?? null : null,
        date: b.date,
        slot: b.slot,
        plan_tier: b.tier,
        qty: b.qty,
        unit_price_nok: unit,
        amount_nok: unit * b.qty,
      };
    });

  const csv = toCsv(rows);
  const name = companyId ? `invoice_${companyId}_${from}_to_${to}.csv` : `invoice_ALL_${from}_to_${to}.csv`;
  return csvResponse(csv, name, rid);
}
