export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { leadsCaptureBodySchema } from "@/lib/public/leadsCaptureSchema";
import { leadsCaptureRateLimitOk } from "@/lib/public/leadsCaptureRateLimit";
import { sendLeadSalesAlert } from "@/lib/public/leadsSalesAlert";
import { captureServerException } from "@/lib/sentry/capture";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";

const RPC_FIELD_MAP: Record<string, string> = {
  consent_required: "consented",
  invalid_name: "name",
  invalid_email: "email",
  invalid_company: "company",
  invalid_source: "source",
  invalid_phone: "phone",
  invalid_company_size: "company_size",
  invalid_message: "message",
  invalid_postal_code: "postal_code",
  invalid_city: "city",
  invalid_region: "region",
  invalid_lead_type: "lead_type",
};

function rpcErrorCode(message: string): string | null {
  const lower = message.toLowerCase();
  for (const code of Object.keys(RPC_FIELD_MAP)) {
    if (lower.includes(code)) return code;
  }
  return null;
}

function isConfigError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { code?: string };
  return e.code === "CONFIG_ERROR" || /missing env/i.test(e.message);
}

async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const rid = makeRid("lead");

  if (!(await leadsCaptureRateLimitOk(req))) {
    return jsonErr(rid, "For mange forsøk", 429, "RATE_LIMIT_EXCEEDED");
  }

  const body = await readJson(req);
  if (!body || typeof body !== "object") {
    return jsonErr(rid, "Ugyldig JSON", 400, "INVALID_JSON");
  }

  const raw = body as Record<string, unknown>;
  if (String(raw.website ?? "").trim()) {
    return jsonOk(rid, { received: true }, 200);
  }

  const parsed = leadsCaptureBodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path?.[0] ? String(first.path[0]) : undefined;
    return jsonErr(rid, first?.message ?? "Ugyldig forespørsel", 422, "VALIDATION_FAILED", { field });
  }

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Tjenesten er midlertidig utilgjengelig", 503, "CONFIG_UNAVAILABLE");
  }

  const { name, email, company, source, phone, company_size, message, postal_code, city, region, coverage_wish, lead_type } =
    parsed.data;

  let leadId: string;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("lp_capture_lead", {
      p_name: name,
      p_email: email,
      p_company: company,
      p_source: source,
      p_consented: true,
      p_phone: phone ?? null,
      p_company_size: company_size ?? null,
      p_message: message ?? null,
      p_postal_code: postal_code ?? null,
      p_city: city ?? null,
      p_region: region ?? null,
      p_coverage_wish: coverage_wish ?? false,
      p_lead_type: lead_type ?? "customer",
    });

    if (error) {
      const code = rpcErrorCode(error.message ?? "");
      if (code) {
        const field = RPC_FIELD_MAP[code];
        const messages: Record<string, string> = {
          consent_required: "Du må samtykke for å sende inn.",
          invalid_email: "Ugyldig e-postadresse",
          invalid_name: "Ugyldig navn",
          invalid_company: "Ugyldig bedriftsnavn",
          invalid_source: "Ugyldig kilde",
          invalid_phone: "Ugyldig telefonnummer",
          invalid_company_size: "Ugyldig antall ansatte",
          invalid_message: "Meldingen er for lang",
        };
        return jsonErr(rid, messages[code] ?? "Ugyldig forespørsel", 422, code.toUpperCase(), { field });
      }
      captureServerException(error, { rid, route: "/api/public/leads/capture" });
      await Sentry.flush(2000);
      return jsonErr(rid, "Kunne ikke lagre forespørselen", 500, "RPC_FAILED");
    }

    if (!data || typeof data !== "string") {
      captureServerException(new Error("lp_capture_lead returned empty id"), {
        rid,
        route: "/api/public/leads/capture",
      });
      await Sentry.flush(2000);
      return jsonErr(rid, "Kunne ikke lagre forespørselen", 500, "RPC_EMPTY");
    }

    leadId = data;
  } catch (err) {
    if (isConfigError(err)) {
      return jsonErr(rid, "Tjenesten er midlertidig utilgjengelig", 503, "CONFIG_UNAVAILABLE");
    }
    captureServerException(err, { rid, route: "/api/public/leads/capture" });
    await Sentry.flush(2000);
    return jsonErr(rid, "Kunne ikke lagre forespørselen", 500, "SERVER_ERROR");
  }

  await sendLeadSalesAlert({
    rid,
    leadId,
    name,
    email,
    company,
    source,
    phone,
    company_size,
    message,
    postal_code,
    city,
    coverage_wish,
    lead_type,
  });

  return jsonOk(rid, { leadId }, 200);
}
