// app/api/saas/billing/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { isOnlinePaymentAllowed } from "@/lib/billing/paymentPolicy";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { requireTenant } from "@/lib/saas/auth";
import {
  createBillingPortalSession,
  createCheckoutSession,
  ensureStripeCustomerForCompany,
  getStripe,
  isSaasPlan,
} from "@/lib/saas/billing";
import { scheduleAuditEvent } from "@/lib/security/audit";
import { securityContextFromAuthedCtx } from "@/lib/security/context";
import { supabaseServer } from "@/lib/supabase/server";
import { opsLog } from "@/lib/ops/log";

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);
  const { ctx } = s;
  const roleDeny = requireRoleOr403(ctx, ["company_admin"]);
  if (roleDeny) return roleDeny;
  const tenant = requireTenant(ctx);
  if (tenant instanceof Response) return tenant;

  const sb = await supabaseServer();
  const [{ data: sub }, { data: company }] = await Promise.all([
    sb.from("saas_subscriptions").select("plan, status, current_period_end, stripe_customer_id").eq("company_id", tenant.companyId).maybeSingle(),
    sb.from("companies").select("name, saas_plan").eq("id", tenant.companyId).maybeSingle(),
  ]);

  return jsonOk(ctx.rid, {
    companyId: tenant.companyId,
    companyName: company?.name ?? null,
    saasPlan: company?.saas_plan ?? "none",
    subscription: sub ?? null,
  });
}

export async function POST(req: NextRequest) {
  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);
  const { ctx } = s;
  const roleDeny = requireRoleOr403(ctx, ["company_admin"]);
  if (roleDeny) return roleDeny;
  const tenant = requireTenant(ctx);
  if (tenant instanceof Response) return tenant;

  const body = await readJson(req);
  const action = String(body?.action ?? "checkout").trim().toLowerCase();

  if (!isOnlinePaymentAllowed()) {
    opsLog("unauthorized_payment_attempt", { rid: ctx.rid, surface: "saas_billing_post", action });
    return jsonErr(
      ctx.rid,
      "Nettbetaling er ikke tilgjengelig. Fakturering skjer via Tripletex og firmavtale.",
      403,
      "ONLINE_PAYMENT_DISABLED",
    );
  }

  if (getStripe() == null) {
    return jsonErr(ctx.rid, "Betaling er ikke konfigurert.", 503, "STRIPE_NOT_CONFIGURED");
  }

  const sb = await supabaseServer();
  const { data: company } = await sb.from("companies").select("name").eq("id", tenant.companyId).maybeSingle();
  const companyName = String(company?.name ?? "Firma").trim() || "Firma";

  const cust = await ensureStripeCustomerForCompany({
    companyId: tenant.companyId,
    companyName,
    email: ctx.scope.email,
  });
  if ("error" in cust) {
    return jsonErr(ctx.rid, "Kunne ikke opprette kunde hos betalingsleverandør.", 502, cust.error);
  }

  if (action === "portal") {
    const portal = await createBillingPortalSession({ customerId: cust.customerId });
    if ("error" in portal) return jsonErr(ctx.rid, "Kunne ikke åpne faktureringsportal.", 502, portal.error);
    const sec = securityContextFromAuthedCtx(ctx, req);
    scheduleAuditEvent({
      companyId: tenant.companyId,
      userId: sec.userId,
      action: "billing.portal_open",
      resource: "saas_billing",
      metadata: { rid: ctx.rid },
    });
    return jsonOk(ctx.rid, { url: portal.url });
  }

  const planRaw = body?.plan;
  if (!isSaasPlan(planRaw) || planRaw === "none") {
    return jsonErr(ctx.rid, "Ugyldig plan.", 422, "INVALID_PLAN");
  }

  const checkout = await createCheckoutSession({
    companyId: tenant.companyId,
    plan: planRaw,
    customerId: cust.customerId,
  });
  if ("error" in checkout) return jsonErr(ctx.rid, "Kunne ikke starte betaling.", 502, checkout.error);

  const secCheckout = securityContextFromAuthedCtx(ctx, req);
  scheduleAuditEvent({
    companyId: tenant.companyId,
    userId: secCheckout.userId,
    action: "billing.checkout_start",
    resource: "saas_billing",
    metadata: { rid: ctx.rid, plan: planRaw },
  });

  return jsonOk(ctx.rid, { url: checkout.url });
}
