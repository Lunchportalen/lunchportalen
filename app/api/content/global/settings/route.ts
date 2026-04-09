import type { NextRequest } from "next/server";

import { globalPublicGetResponse } from "@/lib/cms/readGlobal";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

const KEY = "settings" as const;

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

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  return jsonErr(s?.ctx?.rid ?? "rid_missing", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET() {
  return globalPublicGetResponse(KEY);
}

export async function POST(request: NextRequest) {
  const gate = await scopeOr401(request);
  if (!gate?.ok) return denyResponse(gate);
  const rid = gate.ctx.rid;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_JSON");
  }
  const o = body as Record<string, unknown>;
  const action = o.action;
  if (action !== "save" && action !== "publish") {
    return jsonErr(rid, "action må være save eller publish.", 422, "INVALID_ACTION");
  }

  if (action === "save") {
    const data = o.data !== undefined ? o.data : {};
    if (!isPlainObject(data)) {
      return jsonErr(rid, "data må være et JSON-objekt.", 422, "INVALID_DATA");
    }
    const out = await saveGlobalDraft(KEY, data);
    if (out.ok === false) return jsonErr(rid, out.message, 500, "SAVE_FAILED");
    return jsonOk(rid, {
      key: KEY,
      status: "draft",
      version: out.version,
      draft: out.draft,
    });
  }

  if (o.data !== undefined) {
    if (!isPlainObject(o.data)) {
      return jsonErr(rid, "data må være et JSON-objekt.", 422, "INVALID_DATA");
    }
    const saved = await saveGlobalDraft(KEY, o.data);
    if (saved.ok === false) return jsonErr(rid, saved.message, 500, "SAVE_FAILED");
  }

  const published = await publishGlobal(KEY);
  if (published.ok === false) return jsonErr(rid, published.message, 422, "PUBLISH_FAILED");
  return jsonOk(rid, {
    key: KEY,
    status: "published",
    version: published.version,
    published: published.data,
  });
}
