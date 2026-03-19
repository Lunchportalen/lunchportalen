import { createClient } from "@supabase/supabase-js";

function safeTrim(v) {
  return String(v ?? "").trim();
}

export function getSupabaseAdminDiagnostics() {
  const env = process.env;
  const url = safeTrim(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "");
  const serviceRoleKey = safeTrim(env.SUPABASE_SERVICE_ROLE_KEY || "");

  const out = {
    configPresent: Boolean(url && serviceRoleKey),
    urlLength: url ? url.length : 0,
    keyPresent: Boolean(serviceRoleKey),
    tables: {},
  };

  if (!out.configPresent) {
    return { out, supabase: null };
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return { out, supabase };
}

