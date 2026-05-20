"use server";

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AI_RATE_LIMIT_SCOPE } from "@/lib/ai/rateLimit";
import { checkAiRateLimit, PROVIDER_REGISTRATION_RL } from "@/lib/security/rateLimit";
import {
  providerRegistrationSchema,
  toRegistrationRpcPayload,
} from "@/lib/providers/registrationSchema";
import { supabaseAnonServer } from "@/lib/supabase/anonServer";

function clientIpFromHeaders(h: Headers): string {
  const xf = h.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip") || "unknown";
}

function mapRpcError(message: string): string {
  const m = message.toUpperCase();
  if (m.includes("ORGNR_ALREADY_REGISTERED")) return "Organisasjonsnummeret er allerede registrert.";
  if (m.includes("ORGNR_INVALID")) return "Ugyldig organisasjonsnummer.";
  if (m.includes("EMPLOYEE_COUNT_MIN_20")) return "Minimum 20 ansatte.";
  if (m.includes("POSTAL_CODE_INVALID")) return "Postnummer må være 4 siffer.";
  if (m.includes("CONTACT_EMAIL_INVALID")) return "Ugyldig e-postadresse.";
  if (m.includes("CONTACT_PHONE_INVALID")) return "Ugyldig telefonnummer.";
  return "Kunne ikke sende registreringen. Prøv igjen om litt.";
}

export type RegisterCompanyState = {
  ok: boolean;
  error?: string;
};

export async function registerCompany(
  _prev: RegisterCompanyState,
  formData: FormData,
): Promise<RegisterCompanyState> {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const rl = checkAiRateLimit(ip, `${AI_RATE_LIMIT_SCOPE}:provider_registration`, PROVIDER_REGISTRATION_RL);
  if (!rl.allowed) {
    return { ok: false, error: "For mange forsøk. Vent noen minutter og prøv igjen." };
  }

  const parsed = providerRegistrationSchema.safeParse({
    company_name: formData.get("company_name"),
    org_number: formData.get("org_number"),
    contact_name: formData.get("contact_name"),
    contact_email: formData.get("contact_email"),
    contact_phone: formData.get("contact_phone"),
    postal_code: formData.get("postal_code"),
    city: formData.get("city"),
    employees_estimate: formData.get("employees_estimate"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Ugyldig skjema.";
    return { ok: false, error: first };
  }

  const sb = supabaseAnonServer();
  const { data, error } = await sb.rpc("lp_company_registration_create", {
    p_payload: toRegistrationRpcPayload(parsed.data),
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const registrationId = String(row.registration_id ?? "");
  const matched = row.matched_provider_id != null;
  const providerName = String(row.matched_provider_name ?? "");
  const city = parsed.data.city;
  const postal = parsed.data.postal_code.replace(/\D/g, "");

  const qs = new URLSearchParams();
  if (registrationId) qs.set("id", registrationId);
  qs.set("matched", matched ? "1" : "0");
  if (providerName) qs.set("provider", providerName);
  qs.set("area", `${city} ${postal}`.trim());

  redirect(`/registrer/takk?${qs.toString()}`);
}
