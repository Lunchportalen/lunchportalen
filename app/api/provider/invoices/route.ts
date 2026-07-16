// FASE 8 — provider-fakturaer: GET liste (viewer) + POST bygg DRAFT (admin).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { requireProviderForInvoices } from "@/lib/billing/providerInvoiceGuard";
import { invoiceRpc, listProviderInvoices } from "@/lib/billing/invoiceLifecycle";

function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET() {
  const rid = makeRid("prov_inv_list");
  const g = await requireProviderForInvoices({ minRole: "provider_viewer" });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  // Deterministisk forfallsstatus før visning.
  await invoiceRpc.refreshOverdue(g.providerId);
  const invoices = await listProviderInvoices(g.providerId);
  return jsonOk(rid, { invoices }, 200);
}

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_inv_draft");
  const g = await requireProviderForInvoices({ minRole: "provider_admin" });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const companyId = String(body?.company_id ?? "").trim();
  const periodStart = String(body?.period_start ?? "").trim();
  const periodEnd = String(body?.period_end ?? "").trim();
  if (!isUuid(companyId)) return jsonErr(rid, "Ugyldig company_id.", 400, "BAD_COMPANY");
  if (!isIsoDate(periodStart) || !isIsoDate(periodEnd)) return jsonErr(rid, "Periode må være ÅÅÅÅ-MM-DD.", 400, "BAD_PERIOD");

  const res = await invoiceRpc.buildDraft({
    providerId: g.providerId,
    companyId,
    periodStart,
    periodEnd,
    actor: g.userId,
  });
  if (res.ok === false) {
    const map: Record<string, { status: number; message: string }> = {
      COMPANY_NOT_OWNED_BY_PROVIDER: { status: 403, message: "Firmaet tilhører ikke din leverandør." },
      AGREEMENT_NOT_FOUND: { status: 422, message: "Fant ingen avtale for firmaet." },
      PERIOD_ALREADY_INVOICED: { status: 409, message: "Perioden er allerede fakturert." },
      NO_CHARGEABLE_ORDERS: { status: 422, message: "Ingen leverte (fakturerbare) ordre i perioden." },
      CURRENCY_MIXED: { status: 422, message: "Perioden har blandet valuta og kan ikke faktureres samlet." },
      PERIOD_INVALID: { status: 422, message: "Ugyldig periode." },
    };
    const m = map[res.code] ?? { status: 500, message: "Kunne ikke bygge fakturautkast." };
    return jsonErr(rid, m.message, m.status, res.code);
  }
  return jsonOk(rid, res.data, 200);
}
