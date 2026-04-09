function safeTrim(v) {
  return String(v ?? "").trim();
}

/**
 * URL-only diagnostics stub. Service role access is confined to lib/supabase/admin.ts (supabaseAdmin).
 * @returns {{ out: Record<string, unknown>, supabase: null }}
 */
export function getSupabaseAdminDiagnostics() {
  const env = process.env;
  const url = safeTrim(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "");

  const out = {
    configPresent: Boolean(url),
    urlLength: url ? url.length : 0,
    keyPresent: false,
    tables: {},
    note: "Admin DB checks use supabaseAdmin from lib/supabase/admin.ts only.",
  };

  return { out, supabase: null };
}
