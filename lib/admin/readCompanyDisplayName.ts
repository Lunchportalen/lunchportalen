import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function readCompanyDisplayName(companyId: string): Promise<string> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.from("companies").select("name").eq("id", companyId).maybeSingle();
    if (error) return "Firma";
    return safeStr(data?.name) || "Firma";
  } catch {
    return "Firma";
  }
}
