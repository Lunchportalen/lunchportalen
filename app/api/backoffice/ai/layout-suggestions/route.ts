import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { getLayoutSuggestions } from "@/lib/ai/tools/layoutSuggestions";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseBlocks(raw: unknown): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.id === "string" && typeof b.type === "string")
    .map((b) => ({
      id: String(b.id),
      type: String(b.type),
      data: b.data != null && typeof b.data === "object" && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : undefined,
    }));
}

export async function POST(req: NextRequest) {
  const rid = makeRid();
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin", "company_admin"]);
  if (deny) return deny;
  if (!isAIEnabled()) return jsonErr(rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(rid, "Body must be an object.", 400, "BAD_REQUEST");

  const blocks = parseBlocks(o.blocks);
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const hasBlocks = blocks.length > 0;
  const hasTitle = title.length > 0;
  if (!hasBlocks && !hasTitle) {
    return jsonErr(rid, "Missing both blocks and title; provide blocks or title for context.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const { suggestions, message } = getLayoutSuggestions({
    blocks,
    title: hasTitle ? title : undefined,
    locale,
  });

  return jsonOk(rid, { suggestions, message }, 200);
}
