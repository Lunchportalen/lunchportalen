import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isSystemPlatformCompanyName } from "@/lib/server/superadmin/superadminEntityKind";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type SuperadminProviderCustomerRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: "pending" | "active" | "paused" | "closed";
  activeAgreement: boolean;
  updatedAt: string | null;
};

export type SuperadminProviderDetail = {
  entityKind: "provider";
  provider: {
    id: string;
    name: string;
    orgnr: string | null;
    status: "pending" | "active" | "paused" | "closed";
    contactEmail: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  customers: SuperadminProviderCustomerRow[];
};

function toClientCompanyStatus(raw: unknown): SuperadminProviderCustomerRow["status"] {
  const s = safeStr(raw).toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "PAUSED") return "paused";
  if (s === "CLOSED") return "closed";
  return "pending";
}

function toClientProviderStatus(raw: unknown): SuperadminProviderDetail["provider"]["status"] {
  const s = safeStr(raw).toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "PAUSED" || s === "SUSPENDED") return "paused";
  if (s === "CLOSED") return "closed";
  return "pending";
}

export async function loadSuperadminProviderDetail(
  admin: SupabaseClient,
  providerId: string
): Promise<SuperadminProviderDetail | null> {
  const { data: provider, error } = await admin
    .from("providers")
    .select("id,name,org_number,status,contact_email,created_at,updated_at")
    .eq("id", providerId)
    .maybeSingle();

  if (error || !provider?.id) return null;

  const { data: companies, error: companiesErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,updated_at")
    .eq("provider_id", providerId)
    .order("name", { ascending: true });

  if (companiesErr) throw companiesErr;

  const customerRows = (companies ?? []).filter((row) => !isSystemPlatformCompanyName((row as { name?: string }).name));
  const customerIds = customerRows.map((r) => safeStr((r as { id?: string }).id)).filter(Boolean);

  const activeAgreementCompanyIds = new Set<string>();
  if (customerIds.length > 0) {
    const { data: agreements } = await admin
      .from("agreements")
      .select("company_id")
      .in("company_id", customerIds)
      .eq("status", "ACTIVE");

    for (const row of agreements ?? []) {
      const cid = safeStr((row as { company_id?: string }).company_id);
      if (cid) activeAgreementCompanyIds.add(cid);
    }
  }

  const customers: SuperadminProviderCustomerRow[] = customerRows.map((row) => {
    const id = safeStr((row as { id?: string }).id);
    return {
      id,
      name: safeStr((row as { name?: string }).name) || "Ukjent firma",
      orgnr: (row as { orgnr?: string | null }).orgnr ?? null,
      status: toClientCompanyStatus((row as { status?: string }).status),
      activeAgreement: activeAgreementCompanyIds.has(id),
      updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
    };
  });

  return {
    entityKind: "provider",
    provider: {
      id: safeStr(provider.id),
      name: safeStr(provider.name) || "Ukjent leverandør",
      orgnr: (provider as { org_number?: string | null }).org_number ?? null,
      status: toClientProviderStatus((provider as { status?: string }).status),
      contactEmail: (provider as { contact_email?: string | null }).contact_email ?? null,
      createdAt: (provider as { created_at?: string | null }).created_at ?? null,
      updatedAt: (provider as { updated_at?: string | null }).updated_at ?? null,
    },
    customers,
  };
}
