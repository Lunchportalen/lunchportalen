import "server-only";

import { revalidateTag } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { GLOBAL_FOOTER_CACHE_TAG, GLOBAL_HEADER_CACHE_TAG } from "@/lib/cms/cache";
import { publishLocalCmsGlobal } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
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
    global: { headers: { "X-Client-Info": "lunchportalen-cms-publish-global" } },
  });
  return _service;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function normalizeKey(key: string): boolean {
  return key === "header" || key === "footer" || key === "settings";
}

function reserveWriteBlockedMessage() {
  return "Reserve-modus er skrivebeskyttet.";
}

/**
 * Publish: read draft + current published version, then upsert published row (application layer, no RPC).
 */
export async function publishGlobal(
  key: string,
): Promise<{ ok: true; data: Record<string, unknown>; version: number } | { ok: false; message: string }> {
  try {
    if (!normalizeKey(key)) return { ok: false, message: "Ukjent key." };

    const runtime = getCmsRuntimeStatus();

    if (runtime.mode === "local_provider") {
      return publishLocalCmsGlobal(key as "header" | "footer" | "settings");
    }

    if (runtime.mode === "reserve") {
      return { ok: false, message: reserveWriteBlockedMessage() };
    }

    const admin = serviceClient();
    if (!admin) return { ok: false, message: "Mangler database-konfigurasjon." };

    const { data: draftRow, error: draftErr } = await admin
      .from("global_content")
      .select("data")
      .eq("key", key)
      .eq("status", "draft")
      .maybeSingle();

    if (draftErr) {
      return { ok: false, message: draftErr.message?.trim() || "Publisering feilet." };
    }
    if (!draftRow) {
      return { ok: false, message: "Ingen utkast å publisere." };
    }

    const raw = draftRow.data;
    const publishData = isPlainObject(raw) ? raw : {};

    const { data: pubRow, error: pubErr } = await admin
      .from("global_content")
      .select("version")
      .eq("key", key)
      .eq("status", "published")
      .maybeSingle();

    if (pubErr) {
      return { ok: false, message: pubErr.message?.trim() || "Publisering feilet." };
    }

    const prevPub = typeof pubRow?.version === "number" && Number.isFinite(pubRow.version) ? pubRow.version : 0;
    const newVersion = prevPub + 1;

    const { error: upErr } = await admin.from("global_content").upsert(
      {
        key,
        status: "published",
        data: publishData,
        version: newVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key,status" },
    );

    if (upErr) {
      return { ok: false, message: upErr.message?.trim() || "Publisering feilet." };
    }

    if (key === "header") revalidateTag(GLOBAL_HEADER_CACHE_TAG);
    if (key === "footer") revalidateTag(GLOBAL_FOOTER_CACHE_TAG);

    return { ok: true, data: publishData, version: newVersion };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Publisering feilet.";
    return { ok: false, message: msg };
  }
}
