import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

function envTrim(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function supabaseUrl(): string | null {
  const server = envTrim("SUPABASE_URL");
  if (server) return server;
  const pub = envTrim("NEXT_PUBLIC_SUPABASE_URL");
  return pub || null;
}

function supabaseServiceRoleKey(): string | null {
  const k = envTrim("SUPABASE_SERVICE_ROLE_KEY");
  return k || null;
}

let _service: SupabaseClient | null | undefined;

function serviceClient(): SupabaseClient | null {
  if (_service !== undefined) return _service;
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();
  if (!url || !key) {
    _service = null;
    return null;
  }
  _service = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "lunchportalen-global-settings-admin" } },
  });
  return _service;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

export type GlobalSettingsLoadSource = "draft" | "published";

/**
 * Backoffice: prefer draft `global_content` row for `settings` so AI/editor matches what is saved in CMS.
 * Falls back to published when no draft exists.
 */
export async function loadGlobalSettingsDataForEditor(): Promise<
  | { ok: true; data: Record<string, unknown>; source: GlobalSettingsLoadSource }
  | { ok: false; message: string }
> {
  try {
    const admin = serviceClient();
    if (!admin) return { ok: false, message: "Mangler database-konfigurasjon." };

    const { data: draftRow, error: draftErr } = await admin
      .from("global_content")
      .select("data")
      .eq("key", "settings")
      .eq("status", "draft")
      .maybeSingle();

    if (draftErr) {
      return { ok: false, message: draftErr.message?.trim() || "Kunne ikke lese utkast." };
    }
    if (draftRow && isPlainObject(draftRow.data)) {
      return { ok: true, data: draftRow.data as Record<string, unknown>, source: "draft" };
    }

    const { data: pubRow, error: pubErr } = await admin
      .from("global_content")
      .select("data")
      .eq("key", "settings")
      .eq("status", "published")
      .maybeSingle();

    if (pubErr) {
      return { ok: false, message: pubErr.message?.trim() || "Kunne ikke lese publiserte innstillinger." };
    }
    const raw = pubRow?.data;
    const data = isPlainObject(raw) ? (raw as Record<string, unknown>) : {};
    return { ok: true, data, source: "published" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lesing feilet.";
    return { ok: false, message: msg };
  }
}
