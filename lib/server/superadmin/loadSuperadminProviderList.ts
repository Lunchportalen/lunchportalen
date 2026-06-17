import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isSystemPlatformCompanyName } from "@/lib/server/superadmin/superadminEntityKind";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type SuperadminProviderListStatus = "pending" | "active" | "paused" | "closed";

export type SuperadminProviderListRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: SuperadminProviderListStatus;
  customersCount: number;
  activeAgreementsCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  entityKind: "provider";
};

function toClientProviderStatus(raw: unknown): SuperadminProviderListStatus {
  const s = safeStr(raw).toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "PAUSED" || s === "SUSPENDED") return "paused";
  if (s === "CLOSED") return "closed";
  return "pending";
}

function errMessage(err: { message?: string; code?: string } | null | undefined) {
  return safeStr(err?.message || err?.code);
}

function isMissingSchema(err: { message?: string; code?: string } | null | undefined) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || err?.code === "42P01" || msg.includes("does not exist");
}

export async function loadSuperadminProviderList(
  admin: SupabaseClient,
  input: {
    q?: string;
    status?: SuperadminProviderListStatus | null;
    includeClosed?: boolean;
    page: number;
    limit: number;
    sort: "created_at" | "updated_at" | "name" | "status" | "orgnr";
    dir: "asc" | "desc";
  }
): Promise<{ items: SuperadminProviderListRow[]; total: number; totalPages: number }> {
  const page = Math.max(1, input.page);
  const limit = Math.max(1, input.limit);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const sortCol = input.sort === "orgnr" ? "org_number" : input.sort;

  let query = admin
    .from("providers")
    .select("id,name,org_number,status,created_at,updated_at,deleted_at", { count: "exact" })
    .order(sortCol, { ascending: input.dir === "asc" })
    .range(from, to);

  if (!input.includeClosed) {
    query = query.is("deleted_at", null).neq("status", "CLOSED");
  }

  if (input.status) {
    const statusMap: Record<SuperadminProviderListStatus, string> = {
      active: "ACTIVE",
      paused: "PAUSED",
      closed: "CLOSED",
      pending: "PENDING",
    };
    const mapped = statusMap[input.status];
    if (mapped === "PAUSED") {
      query = query.in("status", ["PAUSED", "SUSPENDED"]);
    } else if (mapped) {
      query = query.eq("status", mapped);
    }
  }

  const q = safeStr(input.q);
  if (q) {
    const esc = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const like = `%${esc}%`;
    query = query.or(`name.ilike.${like},org_number.ilike.${like},slug.ilike.${like}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const providers = (data ?? []) as Array<{
    id: string;
    name: string;
    org_number: string | null;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;

  const providerIds = providers.map((p) => safeStr(p.id)).filter(Boolean);
  const customersByProvider = new Map<string, string[]>();
  const activeAgreementsByProvider = new Map<string, number>();

  if (providerIds.length > 0) {
    const { data: companies, error: companiesErr } = await admin
      .from("companies")
      .select("id,provider_id,name,status")
      .in("provider_id", providerIds);

    if (companiesErr && !isMissingSchema(companiesErr)) throw companiesErr;

    const customerIds: string[] = [];
    const customerProvider = new Map<string, string>();

    for (const row of companies ?? []) {
      const pid = safeStr((row as { provider_id?: string }).provider_id);
      const cid = safeStr((row as { id?: string }).id);
      const name = safeStr((row as { name?: string }).name);
      if (!pid || !cid) continue;
      if (isSystemPlatformCompanyName(name)) continue;

      const arr = customersByProvider.get(pid) ?? [];
      arr.push(cid);
      customersByProvider.set(pid, arr);
      customerIds.push(cid);
      customerProvider.set(cid, pid);
    }

    if (customerIds.length > 0) {
      const { data: agreements, error: agrErr } = await admin
        .from("agreements")
        .select("company_id,status")
        .in("company_id", customerIds)
        .eq("status", "ACTIVE");

      if (agrErr && !isMissingSchema(agrErr)) throw agrErr;

      for (const row of agreements ?? []) {
        const cid = safeStr((row as { company_id?: string }).company_id);
        const pid = customerProvider.get(cid);
        if (!pid) continue;
        activeAgreementsByProvider.set(pid, (activeAgreementsByProvider.get(pid) ?? 0) + 1);
      }
    }
  }

  const items: SuperadminProviderListRow[] = providers.map((p) => {
    const id = safeStr(p.id);
    return {
      id,
      name: safeStr(p.name) || "Ukjent leverandør",
      orgnr: p.org_number ?? null,
      status: toClientProviderStatus(p.status),
      customersCount: (customersByProvider.get(id) ?? []).length,
      activeAgreementsCount: activeAgreementsByProvider.get(id) ?? 0,
      createdAt: p.created_at ?? null,
      updatedAt: p.updated_at ?? null,
      entityKind: "provider",
    };
  });

  const total = typeof count === "number" ? count : items.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return { items, total, totalPages };
}
