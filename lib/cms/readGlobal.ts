import "server-only";

import { GLOBAL_FOOTER_CACHE_TAG, GLOBAL_HEADER_CACHE_TAG } from "@/lib/cms/cache";
import { getLocalCmsPublishedGlobal } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";

/** Edge-safe RID (matches lib/http/rid makeRid shape; avoid Node `crypto` so global routes can stay on edge). */
function globalPublicRid(): string {
  const timePart = Date.now().toString(36);
  const uuidPart = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `LP_${timePart}_${uuidPart}`;
}

function envTrim(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function supabaseUrl(): string | null {
  const server = envTrim("SUPABASE_URL");
  if (server) return server;
  const pub = envTrim("NEXT_PUBLIC_SUPABASE_URL");
  return pub || null;
}

function supabaseAnonKey(): string | null {
  const k = envTrim("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return k || null;
}

function normalizeKey(key: string): boolean {
  return key === "header" || key === "footer" || key === "settings";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

type FetchPublishedCached = { cache: "force-cache"; tags: string[]; revalidate?: number };
type FetchPublishedNoStore = { cache: "no-store" };

/**
 * Published row via Supabase PostgREST (HTTP fetch) so Next.js can apply Data Cache + tags + revalidateTag.
 */
async function fetchPublishedGlobal(
  key: string,
  opts: FetchPublishedCached | FetchPublishedNoStore,
): Promise<{ data: Record<string, unknown>; version: number } | null> {
  try {
    const baseRaw = supabaseUrl();
    const anonKey = supabaseAnonKey();
    if (!baseRaw || !anonKey) return null;
    const origin = baseRaw.replace(/\/$/, "");

    const params = new URLSearchParams({
      select: "data,version",
      key: `eq.${key}`,
      status: "eq.published",
      limit: "1",
    });

    // Absolute HTTPS URL for PostgREST (Edge-safe fetch; no relative URLs).
    let url: string;
    try {
      url = new URL(`/rest/v1/global_content?${params}`, `${origin}/`).toString();
    } catch {
      return null;
    }

    const init: RequestInit & { next?: { tags?: string[]; revalidate?: number } } =
      opts.cache === "force-cache"
        ? {
            method: "GET",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Accept: "application/json",
            },
            cache: "force-cache",
            next: { tags: opts.tags, revalidate: opts.revalidate ?? 3600 },
          }
        : {
            method: "GET",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Accept: "application/json",
            },
            cache: "no-store",
          };

    const res = await fetch(url, init);
    if (!res.ok) return null;

    const rows: unknown = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];
    if (!isPlainObject(row)) return null;
    const raw = row.data;
    const data = isPlainObject(raw) ? raw : {};
    const version = typeof row.version === "number" && Number.isFinite(row.version) ? row.version : 1;
    return { data, version };
  } catch {
    return null;
  }
}

/**
 * Published row only (PostgREST + RLS: anon sees status = published).
 * Header/footer: Next fetch Data Cache with tags global-header / global-footer.
 * Never throws.
 */
export async function getPublishedGlobal(key: string): Promise<{ data: Record<string, unknown>; version: number } | null> {
  if (!normalizeKey(key)) return null;

  if (getCmsRuntimeStatus().mode !== "remote_backend") {
    return getLocalCmsPublishedGlobal(key as "header" | "footer" | "settings");
  }

  if (key === "header") {
    return fetchPublishedGlobal(key, {
      cache: "force-cache",
      tags: [GLOBAL_HEADER_CACHE_TAG],
      revalidate: 3600,
    });
  }
  if (key === "footer") {
    return fetchPublishedGlobal(key, {
      cache: "force-cache",
      tags: [GLOBAL_FOOTER_CACHE_TAG],
      revalidate: 3600,
    });
  }

  return fetchPublishedGlobal(key, { cache: "no-store" });
}

/**
 * Public GET: body is `{ ok: true, rid, data }` (UTF-8 JSON).
 * Header/footer: CDN-friendly cache headers aligned with `revalidate = 3600` on the route.
 */
export async function globalPublicGetResponse(key: string): Promise<Response> {
  const row = await getPublishedGlobal(key);
  const data = row && isPlainObject(row.data) ? row.data : {};
  const rid = globalPublicRid();

  const cacheControl =
    key === "header" || key === "footer"
      ? "public, s-maxage=3600, stale-while-revalidate=86400"
      : "no-store";

  return new Response(JSON.stringify({ ok: true, rid, data }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      "x-rid": rid,
    },
  });
}
