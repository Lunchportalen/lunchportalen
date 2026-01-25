// app/api/admin/agreements/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

type Tier = "BASIS" | "LUXUS";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type AgreementStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function mkRid() {
  return `admin_agreements_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

function normalizeTier(v: any): Tier {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

function normalizeStatus(v: any): AgreementStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED" || s === "DRAFT") return s;
  return "DRAFT";
}

function normalizeDeliveryDays(v: any): DayKey[] {
  // jsonb array: ["mon","tue",...]
  if (!v) return DAY_KEYS.slice();
  if (Array.isArray(v)) {
    const set = new Set<DayKey>();
    for (const x of v) {
      const s = String(x ?? "").trim().toLowerCase();
      if (DAY_KEYS.includes(s as DayKey)) set.add(s as DayKey);
    }
    return set.size ? Array.from(set) : DAY_KEYS.slice();
  }
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    if (Array.isArray(parsed)) return normalizeDeliveryDays(parsed);
  } catch {}
  return DAY_KEYS.slice();
}

type AgreementRow = {
  id: string;
  company_id: string;
  status: AgreementStatus;
  plan_tier: Tier;
  price_per_cuvert_nok: number;
  delivery_days: any; // jsonb
  binding_months: number;
  notice_months: number;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function viewModel(a: AgreementRow) {
  return {
    id: a.id,
    company_id: a.company_id,
    status: normalizeStatus(a.status),
    plan_tier: normalizeTier(a.plan_tier),
    price_per_cuvert_nok: Number(a.price_per_cuvert_nok ?? 0),
    delivery_days: normalizeDeliveryDays(a.delivery_days),
    binding_months: Number(a.binding_months ?? 0),
    notice_months: Number(a.notice_months ?? 0),
    start_date: a.start_date,
    end_date: a.end_date ?? null,
    notes: a.notes ?? null,
    meta: {
      created_at: a.created_at,
      updated_at: a.updated_at,
    },
  };
}

export async function GET(req: NextRequest) {
  const rid = mkRid();

  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const url = new URL(req.url);
    const requestedCompanyId = url.searchParams.get("company_id");

    // ✅ company_admin: own company only
    // ✅ superadmin: must pass ?company_id=
    const companyId =
      scope.role === "superadmin"
        ? (requestedCompanyId ? String(requestedCompanyId).trim() : null)
        : mustCompanyId(scope);

    if (scope.role === "superadmin" && !companyId) {
      return jsonErr(400, rid, "BAD_REQUEST", "Superadmin må angi ?company_id= for avtaleoppslag.");
    }
    if (!companyId || !isUuid(companyId)) {
      return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig company_id.");
    }

    const sb = await supabaseServer();

    // ✅ Hent avtaler fra fasit-tabell.
    // For admin-UI ønsker vi:
    // - current: ACTIVE hvis finnes, ellers nyeste
    // - history: siste N (for historikk)
    const { data: rows, error } = await sb
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return jsonErr(500, rid, "AGREEMENTS_READ_FAILED", "Kunne ikke hente avtaler.", error);

    const list = (rows ?? []) as AgreementRow[];
    const active = list.find((x) => String(x.status).toUpperCase() === "ACTIVE") ?? null;
    const latest = list[0] ?? null;

    // Hvis dere vil tillate "ingen avtale" i admin: return ok:true med null i stedet.
    if (!active && !latest) {
      return jsonOk({
        ok: true,
        rid,
        company_id: companyId,
        readOnly: scope.role !== "superadmin",
        current: null,
        active: null,
        latest: null,
        history: [],
      });
    }

    const current = (active ?? latest) as AgreementRow;

    return jsonOk({
      ok: true,
      rid,
      company_id: companyId,
      readOnly: scope.role !== "superadmin", // company_admin får readOnly=true
      current: viewModel(current),
      active: active ? viewModel(active) : null,
      latest: latest ? viewModel(latest) : null,
      history: list.map(viewModel),
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}

export async function PUT(req: NextRequest) {
  // 🔒 LÅST: Denne ruten er admin-read-only i denne fasen.
  // Superadmin-endringer skal skje i dedikerte superadmin-ruter for å unngå regression.
  const rid = mkRid();
  return jsonErr(
    405,
    rid,
    "METHOD_NOT_ALLOWED",
    "Dette endepunktet er read-only. Avtaler endres kun av superadmin i egne superadmin-ruter."
  );
}

export async function POST() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk GET (les).");
}

export async function DELETE() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk GET (les).");
}
