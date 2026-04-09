import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { saveLocalCmsGlobalDraft } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import type { Database } from "@/lib/types/database";

type StoreKey = "header" | "footer" | "settings";

type GlobalContentKey = "header" | "footer" | "settings";

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
    global: { headers: { "X-Client-Info": "lunchportalen-cms-write-global" } },
  });
  return _service;
}

function normalizeKey(key: string): StoreKey | null {
  if (key === "header" || key === "footer" || key === "settings") return key;
  return null;
}

function cloneRecord(data: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function reserveWriteBlockedMessage() {
  return "Reserve-modus er skrivebeskyttet.";
}

/**
 * Draft only: upsert (key, status=draft), bump draft version; never touches published row.
 * Does not call revalidateTag — published GETs stay cached until publishGlobal runs.
 */
export async function saveGlobalDraft(
  key: GlobalContentKey,
  data: Record<string, unknown>,
): Promise<
  { ok: true; version: number; draft: Record<string, unknown> } | { ok: false; message: string }
> {
  try {
    const k = normalizeKey(key);
    if (!k) return { ok: false, message: "Ukjent key." };

    const runtime = getCmsRuntimeStatus();

    if (runtime.mode === "local_provider") {
      return saveLocalCmsGlobalDraft(k, data);
    }

    if (runtime.mode === "reserve") {
      return { ok: false, message: reserveWriteBlockedMessage() };
    }

    const admin = serviceClient();
    if (!admin) return { ok: false, message: "Mangler database-konfigurasjon." };

    const saved = cloneRecord(data);

    const { data: existing, error: selErr } = await admin
      .from("global_content")
      .select("version")
      .eq("key", k)
      .eq("status", "draft")
      .maybeSingle();

    if (selErr) {
      return { ok: false, message: selErr.message?.trim() || "Lagring feilet." };
    }

    const prev = typeof existing?.version === "number" && Number.isFinite(existing.version) ? existing.version : 0;
    const nextVersion = prev + 1;

    const { data: row, error } = await admin
      .from("global_content")
      .upsert(
        {
          key: k,
          status: "draft",
          data: saved,
          version: nextVersion,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,status" },
      )
      .select("version, data")
      .single();

    if (error || !row) {
      return { ok: false, message: error?.message?.trim() || "Lagring feilet." };
    }

    const draft = isPlainObject(row.data) ? row.data : {};
    const version = typeof row.version === "number" && Number.isFinite(row.version) ? row.version : nextVersion;
    return { ok: true, version, draft };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lagring feilet.";
    return { ok: false, message: msg };
  }
}
