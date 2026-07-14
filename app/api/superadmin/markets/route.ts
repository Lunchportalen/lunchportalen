// app/api/superadmin/markets/route.ts
//
// FASE 10 — superadmin-API for markedsgodkjenning (norsk kontrollflate).
// GET: 21 markeder med skattekonfig + godkjenningsstatus + hendelseslogg.
// POST: eksplisitt statusovergang i approval-registeret (service-RPC, auditert).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireSuperadminApi } from "@/lib/superadmin/auth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listMarketApprovals, transitionMarketApproval } from "@/lib/markets/marketApprovals";

export async function GET() {
  const rid = makeRid();
  const gate = await requireSuperadminApi();
  if (gate.ok === false) return jsonErr(rid, gate.message, gate.status, "forbidden");

  try {
    const admin = supabaseAdmin() as any;
    const [approvals, { data: markets }, { data: events }] = await Promise.all([
      listMarketApprovals(),
      admin
        .from("markets")
        .select(
          "country_code, locale, default_currency, default_timezone, vat_rate_food, invoice_language, tax_strategy, tax_id_validation, reverse_charge_supported, state_province_required, provider_timezone_required, postal_code_pattern, address_format, credit_note_policy, invoice_numbering_policy, is_active",
        )
        .eq("is_active", true)
        .order("country_code"),
      admin
        .from("market_approval_events")
        .select("country_code, from_status, to_status, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return jsonOk(rid, { approvals, markets: markets ?? [], events: events ?? [] });
  } catch (e) {
    return jsonErr(rid, "Kunne ikke hente markedsdata.", 500, { detail: String((e as Error)?.message ?? e) });
  }
}

export async function POST(req: Request) {
  const rid = makeRid();
  const gate = await requireSuperadminApi();
  if (gate.ok === false) return jsonErr(rid, gate.message, gate.status, "forbidden");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "invalid_json");
  }

  const countryCode = String(body.countryCode ?? "").trim().toUpperCase();
  const newStatus = String(body.newStatus ?? "").trim().toUpperCase();
  const reason = String(body.reason ?? "").trim() || null;
  if (!/^[A-Z]{2}$/.test(countryCode) || !newStatus) {
    return jsonErr(rid, "countryCode og newStatus kreves.", 422, "validation");
  }

  const res = await transitionMarketApproval({ countryCode, newStatus, reason, actor: gate.userId });
  if (res.ok === false) return jsonErr(rid, `Overgang avvist: ${res.code}`, 409, res.code);
  return jsonOk(rid, res.data);
}
