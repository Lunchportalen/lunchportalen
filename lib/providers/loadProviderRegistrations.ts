import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

export type ProviderRegistrationRow = {
  id: string;
  status: string;
  company_name: string | null;
  orgnr: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  postal_code: string | null;
  city: string | null;
  employee_count: number | null;
  requested_postal_code: string | null;
  requested_city: string | null;
  provider_id: string | null;
  created_at: string;
  rejection_reason: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function loadProviderRegistrations(
  providerId: string,
  statusFilter: "pending" | "all" = "pending",
): Promise<ProviderRegistrationRow[]> {
  const sb = await supabaseServer();
  let q = sb
    .from("company_registrations")
    .select(
      "id, status, company_name, orgnr, contact_name, contact_email, contact_phone, postal_code, city, employee_count, requested_postal_code, requested_city, provider_id, created_at, rejection_reason",
    )
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter === "pending") {
    q = q.eq("status", "PENDING");
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map((row) => ({
    id: safeStr(row.id),
    status: safeStr(row.status),
    company_name: row.company_name ?? null,
    orgnr: row.orgnr ?? null,
    contact_name: row.contact_name ?? null,
    contact_email: row.contact_email ?? null,
    contact_phone: row.contact_phone ?? null,
    postal_code: row.postal_code ?? null,
    city: row.city ?? null,
    employee_count: row.employee_count ?? null,
    requested_postal_code: row.requested_postal_code ?? null,
    requested_city: row.requested_city ?? null,
    provider_id: row.provider_id ?? null,
    created_at: safeStr(row.created_at),
    rejection_reason: row.rejection_reason ?? null,
  }));
}

export async function loadProviderRegistrationById(
  providerId: string,
  registrationId: string,
): Promise<ProviderRegistrationRow | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("company_registrations")
    .select(
      "id, status, company_name, orgnr, contact_name, contact_email, contact_phone, postal_code, city, employee_count, requested_postal_code, requested_city, provider_id, created_at, rejection_reason",
    )
    .eq("provider_id", providerId)
    .eq("id", registrationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: safeStr(data.id),
    status: safeStr(data.status),
    company_name: data.company_name ?? null,
    orgnr: data.orgnr ?? null,
    contact_name: data.contact_name ?? null,
    contact_email: data.contact_email ?? null,
    contact_phone: data.contact_phone ?? null,
    postal_code: data.postal_code ?? null,
    city: data.city ?? null,
    employee_count: data.employee_count ?? null,
    requested_postal_code: data.requested_postal_code ?? null,
    requested_city: data.requested_city ?? null,
    provider_id: data.provider_id ?? null,
    created_at: safeStr(data.created_at),
    rejection_reason: data.rejection_reason ?? null,
  };
}
