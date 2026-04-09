// STATUS: KEEP

// lib/orders/backupContext.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function fetchCompanyLocationNames(args: {
  admin: SupabaseClient;
  companyId: string;
  locationId: string;
}) {
  const { admin, companyId, locationId } = args;

  const [cRes, lRes] = await Promise.all([
    admin.from("companies").select("id,name").eq("id", companyId).maybeSingle(),
    admin.from("company_locations").select("id,name,label").eq("id", locationId).maybeSingle(),
  ]);

  const company_name = cRes.error ? null : safeStr((cRes.data as any)?.name) || null;
  const location_name =
    lRes.error ? null : safeStr((lRes.data as any)?.name) || safeStr((lRes.data as any)?.label) || null;

  return { company_name, location_name };
}
