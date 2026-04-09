import type { NextRequest } from "next/server";

import { createAiAbTrafficExperimentCore } from "@/lib/experiments/createAiAbTrafficExperimentCore";
import { createAiAbcTrafficExperimentCore } from "@/lib/experiments/createAiAbcTrafficExperimentCore";
import { createHomeTrafficExperimentCore } from "@/lib/experiments/createHomeTrafficExperimentCore";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
export const runtime = "nodejs";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function POST(request: NextRequest) {
  return withApiAiEntrypoint(request, "POST", async () => {
    const s = await scopeOr401(request);
    if (!s?.ok) return denyResponse(s);
    const ctx = s.ctx;
    const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
    if (roleDeny) return roleDeny;

    try {
      let body: unknown = null;
      try {
        const text = await request.text();
        if (text.trim()) body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }

      const o = body && typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
      const mode = typeof o?.mode === "string" ? o.mode.trim() : "";

      if (mode === "ai_ab") {
        const pageId = typeof o.pageId === "string" ? o.pageId.trim() : "";
        const blocksB = o.blocksB;
        if (!pageId || !isUuid(pageId)) {
          return jsonErr(ctx.rid, "pageId (uuid) er påkrevd for ai_ab.", 422, "VALIDATION_ERROR");
        }
        if (!Array.isArray(blocksB)) {
          return jsonErr(ctx.rid, "blocksB må være en liste.", 422, "VALIDATION_ERROR");
        }
        const out = await createAiAbTrafficExperimentCore({
          rid: ctx.rid,
          source: "api/backoffice/experiments/create",
          pageId,
          blocksB,
        });
        if (out.ok === false) {
          const status =
            out.code === "NOT_FOUND"
              ? 404
              : out.code === "EXPERIMENT_RUNNING" || out.code === "NO_DIFF"
                ? 409
                : out.code === "NOT_PUBLISHED" || out.code === "BLOCKS_B_EMPTY" || out.code === "VALIDATION"
                  ? 422
                  : 500;
          return jsonErr(ctx.rid, out.message, status, out.code);
        }
        return jsonOk(ctx.rid, { experimentId: out.experimentId, variantIds: out.variantIds, status: "running" }, 201);
      }

      if (mode === "ai_abc") {
        const pageId = typeof o.pageId === "string" ? o.pageId.trim() : "";
        const blocksB = o.blocksB;
        const blocksC = o.blocksC;
        if (!pageId || !isUuid(pageId)) {
          return jsonErr(ctx.rid, "pageId (uuid) er påkrevd for ai_abc.", 422, "VALIDATION_ERROR");
        }
        if (!Array.isArray(blocksB) || !Array.isArray(blocksC)) {
          return jsonErr(ctx.rid, "blocksB og blocksC må være lister.", 422, "VALIDATION_ERROR");
        }
        const out = await createAiAbcTrafficExperimentCore({
          rid: ctx.rid,
          source: "api/backoffice/experiments/create",
          pageId,
          blocksB,
          blocksC,
        });
        if (out.ok === false) {
          const status =
            out.code === "NOT_FOUND"
              ? 404
              : out.code === "EXPERIMENT_RUNNING" || out.code === "NO_DIFF" || out.code === "NO_DIFF_BC"
                ? 409
                : out.code === "NOT_PUBLISHED" || out.code === "BLOCKS_EMPTY" || out.code === "VALIDATION"
                  ? 422
                  : 500;
          return jsonErr(ctx.rid, out.message, status, out.code);
        }
        return jsonOk(ctx.rid, { experimentId: out.experimentId, variantIds: out.variantIds, status: "running" }, 201);
      }

      const out = await createHomeTrafficExperimentCore({ rid: ctx.rid, source: "api/backoffice/experiments/create" });
      if (out.ok === false) {
        const status =
          out.code === "NOT_FOUND"
            ? 404
            : out.code === "EXPERIMENT_RUNNING"
              ? 409
              : 500;
        return jsonErr(ctx.rid, out.message, status, out.code);
      }
      return jsonOk(ctx.rid, { experimentId: out.experimentId, variantIds: out.variantIds, status: "running" }, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create experiment failed";
      return jsonErr(ctx.rid, msg, 500, "INTERNAL_ERROR");
    }
  });
}
