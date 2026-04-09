import type { NextRequest } from "next/server";

import { globalPublicGetResponse } from "@/lib/cms/readGlobal";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";

function newRid(prefix: string): string {
  const t = Date.now().toString(36);
  const u = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${prefix}_${t}_${u}`;
}

export const runtime = "edge";
export const revalidate = 3600;

/** CDN / shared caches: align with route `revalidate` and Next fetch `revalidate` (3600s). */
const CDN_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

const KEY = "header" as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function jsonExactOk(ridValue: string, data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, rid: ridValue, data }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function jsonExactErr(ridValue: string, status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      rid: ridValue,
      error: "ERROR",
      message,
      status,
    }),
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

export async function GET() {
  const res = await globalPublicGetResponse(KEY);
  const headers = new Headers(res.headers);
  headers.set("cache-control", CDN_CACHE_CONTROL);
  return new Response(res.body, { status: res.status, headers });
}

export async function POST(request: NextRequest) {
  const requestId = newRid("cms_global_header");
  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonExactErr(requestId, 400, "Ugyldig JSON.");
  }
  const o = body as Record<string, unknown>;
  const action = o.action;
  if (action !== "save" && action !== "publish") {
    return jsonExactErr(requestId, 422, "action må være save eller publish.");
  }

  if (action === "save") {
    const data = o.data !== undefined ? o.data : {};
    if (!isPlainObject(data)) {
      return jsonExactErr(requestId, 422, "data må være et JSON-objekt.");
    }
    const out = await saveGlobalDraft(KEY, data);
    if (out.ok === false) return jsonExactErr(requestId, 500, out.message);
    return jsonExactOk(requestId, {
      key: KEY,
      status: "draft",
      version: out.version,
      draft: out.draft,
    });
  }

  if (o.data !== undefined) {
    if (!isPlainObject(o.data)) {
      return jsonExactErr(requestId, 422, "data må være et JSON-objekt.");
    }
    const saved = await saveGlobalDraft(KEY, o.data);
    if (saved.ok === false) return jsonExactErr(requestId, 500, saved.message);
  }

  const published = await publishGlobal(KEY);
  if (published.ok === false) return jsonExactErr(requestId, 422, published.message);
  return jsonExactOk(requestId, {
    key: KEY,
    status: "published",
    version: published.version,
    published: published.data,
  });
}
