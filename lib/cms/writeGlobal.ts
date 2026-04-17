import "server-only";

import { saveLocalCmsGlobalDraft } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

type StoreKey = "header" | "footer" | "settings";

type GlobalContentKey = "header" | "footer" | "settings";

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

    if (!hasSupabaseAdminConfig()) return { ok: false, message: "Mangler database-konfigurasjon." };

    const admin = supabaseAdmin();

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
