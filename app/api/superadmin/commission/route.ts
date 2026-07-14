// app/api/superadmin/commission/route.ts
//
// FASE 9 — superadmin styringsflate for plattformprovisjon (invoice-only).
// GET: perioder + fakturaer + feilede leveranser (norsk kontrollflate).
// POST: handlinger — dry_run, close (close+utsted+lever), payment, credit,
// resend, refresh_overdue. Alle handlinger er idempotente og revisjonsloggede
// i RPC-laget. INGEN Stripe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireSuperadminApi } from "@/lib/superadmin/auth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  closeAndInvoice,
  commissionDryRun,
  createCommissionCredit,
  deliverCommissionInvoice,
  issueCommissionInvoice,
  listCommissionInvoices,
  refreshCommissionOverdue,
  registerCommissionPayment,
} from "@/lib/billing/commissionSettlement";

export async function GET() {
  const rid = makeRid();
  const gate = await requireSuperadminApi();
  if (gate.ok === false) return jsonErr(rid, gate.message, gate.status, "forbidden");

  try {
    const admin = supabaseAdmin() as any;
    const [invoices, { data: periods }, { data: failedDeliveries }] = await Promise.all([
      listCommissionInvoices(null),
      admin
        .from("commission_periods")
        .select("id, provider_id, period_start, period_end, currency, status, total_basis_amount_minor, rounded_commission_minor, closed_at")
        .order("period_start", { ascending: false })
        .limit(100),
      admin
        .from("invoice_deliveries")
        .select("id, invoice_id, recipient_email, delivery_status, failed_at, failed_reason")
        .in("delivery_status", ["failed", "bounced"])
        .order("failed_at", { ascending: false })
        .limit(50),
    ]);
    return jsonOk(rid, { invoices, periods: periods ?? [], failedDeliveries: failedDeliveries ?? [] });
  } catch (e) {
    return jsonErr(rid, "Kunne ikke hente provisjonsdata.", 500, { detail: String((e as Error)?.message ?? e) });
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

  const action = String(body.action ?? "").trim();

  try {
    if (action === "dry_run" || action === "close") {
      const providerId = String(body.providerId ?? "").trim();
      const periodStart = String(body.periodStart ?? "").trim();
      const periodEnd = String(body.periodEnd ?? "").trim();
      const currency = String(body.currency ?? "").trim().toUpperCase();
      if (!providerId || !periodStart || !periodEnd || !currency) {
        return jsonErr(rid, "providerId, periodStart, periodEnd og currency kreves.", 422, "validation");
      }

      const dry = await commissionDryRun({ providerId, periodStart, periodEnd, currency });
      if (dry.ok === false) return jsonErr(rid, `Dry-run feilet: ${dry.code}`, 409, dry.code);
      if (action === "dry_run") return jsonOk(rid, { dryRun: dry.data });

      if (!dry.data.can_close) {
        return jsonErr(rid, `Perioden kan ikke lukkes: ${(dry.data.missing_requirements ?? []).join(", ")}`, 409, "not_ready");
      }
      const closed = await closeAndInvoice({ providerId, periodStart, periodEnd, currency });
      if (closed.ok === false) return jsonErr(rid, `Lukking feilet: ${closed.code}`, 409, closed.code);
      const issued = await issueCommissionInvoice(closed.invoiceId, gate.userId);
      if (issued.ok === false) return jsonErr(rid, `Utstedelse feilet: ${issued.code}`, 409, issued.code);
      const delivered = await deliverCommissionInvoice(closed.invoiceId);
      return jsonOk(rid, {
        invoiceId: closed.invoiceId,
        createdNew: closed.createdNew,
        issued: issued.data,
        delivered: delivered.ok === false ? { error: delivered.code } : { recipients: delivered.recipients },
      });
    }

    if (action === "payment") {
      const invoiceId = String(body.invoiceId ?? "").trim();
      const amountMinor = Number(body.amountMinor ?? 0);
      const reference = String(body.reference ?? "").trim() || null;
      if (!invoiceId || !Number.isFinite(amountMinor) || amountMinor <= 0) {
        return jsonErr(rid, "invoiceId og positivt amountMinor kreves.", 422, "validation");
      }
      const idem = String(body.idempotencyKey ?? "").trim() || `manual:${invoiceId}:${amountMinor}:${reference ?? "bank"}`;
      const res = await registerCommissionPayment({
        invoiceId,
        amountMinor,
        paidAt: String(body.paidAt ?? "").trim() || null,
        method: String(body.method ?? "BANK"),
        reference,
        idempotencyKey: idem,
        actor: gate.userId,
      });
      if (!res.ok) return jsonErr(rid, `Betaling feilet: ${res.code}`, 409, res.code);
      return jsonOk(rid, res.data);
    }

    if (action === "credit") {
      const invoiceId = String(body.invoiceId ?? "").trim();
      const reason = String(body.reason ?? "").trim();
      if (!invoiceId || !reason) return jsonErr(rid, "invoiceId og reason kreves.", 422, "validation");
      const res = await createCommissionCredit({ invoiceId, reason, actor: gate.userId });
      if (!res.ok) return jsonErr(rid, `Kreditering feilet: ${res.code}`, 409, res.code);
      return jsonOk(rid, res.data);
    }

    if (action === "resend") {
      const invoiceId = String(body.invoiceId ?? "").trim();
      if (!invoiceId) return jsonErr(rid, "invoiceId kreves.", 422, "validation");
      const res = await deliverCommissionInvoice(invoiceId, { force: true });
      if (res.ok === false) return jsonErr(rid, `Levering feilet: ${res.code}`, 409, res.code);
      return jsonOk(rid, { recipients: res.recipients });
    }

    if (action === "refresh_overdue") {
      const res = await refreshCommissionOverdue();
      if (!res.ok) return jsonErr(rid, `Forfalls-oppdatering feilet: ${res.code}`, 409, res.code);
      return jsonOk(rid, res.data);
    }

    return jsonErr(rid, "Ukjent handling.", 422, "unknown_action");
  } catch (e) {
    return jsonErr(rid, "Uventet feil.", 500, { detail: String((e as Error)?.message ?? e) });
  }
}
