export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { providerRegistrationSchema } from "@/lib/public/providerRegistrationSchema";
import { rateLimit } from "@/lib/security/rateLimit";
import { validateNorwayAcceptanceBatch } from "@/lib/legal/norwayAcceptanceValidate";
import { buildNorwayLegalPendingPayload } from "@/lib/legal/norwayAcceptanceGate";
import { norwayClientMeta } from "@/lib/legal/norwayClientMeta";

function clientIp(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

/** Map RPC error tokens → safe 4xx (never leak DB text). */
function mapRpcError(rid: string, message: string) {
  const m = message.toUpperCase();
  if (m.includes("TIMEZONE_REQUIRED_FOR_MARKET"))
    return jsonErr(rid, "Tidssone må velges for dette markedet (USA/Canada).", 422, "TIMEZONE_REQUIRED_FOR_MARKET");
  if (m.includes("ORG_NUMBER_ALREADY_PROVIDER") || m.includes("EMAIL_ALREADY_PROVIDER"))
    return jsonErr(rid, "Dette firmaet er allerede registrert som leverandør.", 409, "ALREADY_PROVIDER");
  if (m.includes("PENDING_REGISTRATION_EXISTS"))
    return jsonErr(rid, "Det finnes allerede en åpen søknad for dette firmaet.", 409, "PENDING_REGISTRATION_EXISTS");
  if (m.includes("REQUIRED") || m.includes("INVALID"))
    return jsonErr(rid, "Skjemaet mangler påkrevde felter.", 422, "VALIDATION_FAILED");
  return jsonErr(rid, "Kunne ikke sende søknaden nå. Prøv igjen om litt.", 500, "REGISTRATION_FAILED");
}

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_reg");

  if (!rateLimit(`provider-registration:${clientIp(req)}`, 10)) {
    return jsonErr(rid, "For mange forespørsler. Prøv igjen om litt.", 429, "RATE_LIMITED");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "INVALID_JSON");
  }

  const parsed = providerRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path?.[0] ? String(first.path[0]) : undefined;
    const isTz = first?.message === "TIMEZONE_REQUIRED_FOR_MARKET";
    return jsonErr(
      rid,
      isTz ? "Tidssone må velges for dette markedet (USA/Canada)." : "Ugyldig forespørsel.",
      422,
      isTz ? "TIMEZONE_REQUIRED_FOR_MARKET" : "VALIDATION_FAILED",
      { field },
    );
  }

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Tjenesten er midlertidig utilgjengelig.", 503, "CONFIG_UNAVAILABLE");
  }

  const d = parsed.data;

  // 16NO.2: Norway provider clickwrap required; other countries stay blocked upstream.
  let pendingLegal: ReturnType<typeof buildNorwayLegalPendingPayload> | null = null;
  if (d.country_code === "NO") {
    const bodyRec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const legalBatch = validateNorwayAcceptanceBatch({
      role: "provider",
      acceptances: (bodyRec.norway_legal_acceptances ?? bodyRec.norwayLegalAcceptances) as
        | import("@/lib/legal/norwayAcceptanceValidate").NorwayAcceptanceInput[]
        | null
        | undefined,
    });
    if (legalBatch.ok === false) {
      return jsonErr(
        rid,
        legalBatch.code === "UNCHECKED_BLOCKED"
          ? "Du må eksplisitt akseptere alle norske leverandørvilkår."
          : "Gyldig aksept av norske vilkår kreves før innsending.",
        422,
        legalBatch.code,
      );
    }
    const meta = norwayClientMeta(req);
    pendingLegal = buildNorwayLegalPendingPayload({
      role: "provider",
      items: legalBatch.items,
      clientIp: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  const payload = {
    company_name: d.company_name,
    org_number: d.org_number || null,
    country_code: d.country_code,
    contact_name: d.contact_name,
    contact_email: d.contact_email,
    contact_phone: d.contact_phone || null,
    operating_language: d.operating_language,
    invoice_language: d.invoice_language,
    currency: d.currency,
    timezone: d.timezone || null,
    tax_registration: d.tax_registration || null,
    order_email: d.order_email || null,
    kitchen_email: d.kitchen_email || null,
    delivery_email: d.delivery_email || null,
    coverage_wish: d.coverage_wish || null,
    cutoff_local_time: d.cutoff_local_time || null,
  };

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();
    const { data, error } = await (admin as any).rpc("lp_provider_registration_create", { p_payload: payload });
    if (error) return mapRpcError(rid, String(error.message ?? ""));

    const registrationId = (data as { registration_id?: string } | null)?.registration_id ?? null;

    if (registrationId && pendingLegal) {
      await (admin as any)
        .from("provider_registrations")
        .update({ norway_legal_pending: pendingLegal })
        .eq("id", registrationId);
    }

    // Best-effort ops alert (never blocks the applicant).
    try {
      await admin.from("outbox").insert({
        event_key: `provider.registration:${registrationId ?? rid}`,
        payload: {
          event: "provider.registration.received",
          type: "provider.registration.received",
          from: "Lunchportalen <no-reply@lunchportalen.no>",
          to: "salg@lunchportalen.no",
          subject: `Ny leverandørsøknad: ${d.company_name} (${d.country_code})`,
          bodyText: `Ny cateringfirma-søknad mottatt.\nFirma: ${d.company_name}\nLand: ${d.country_code}\nKontakt: ${d.contact_name}\nRegistrerings-ID: ${registrationId ?? "(ukjent)"}`,
          registration_id: registrationId,
        },
        status: "PENDING",
        attempts: 0,
      });
    } catch {
      // non-fatal
    }

    return jsonOk(rid, { registration_id: registrationId, status: "PENDING" }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke sende søknaden nå.", 500, "REGISTRATION_FAILED");
  }
}
