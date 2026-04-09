import type { NextRequest } from "next/server";

import { getEvents, getSystemIntelligence, logEvent, type IntelligenceDomainType } from "@/lib/ai/intelligence";
import { IntelligenceSchemaValidationError, IntelligenceStoreFetchError } from "@/lib/ai/schema/errors";
import { rebuildGtmLearningFromOutcomePayloads } from "@/lib/gtm/learning";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizePostType(t: string): IntelligenceDomainType | null {
  const x = t.trim();
  if (x === "gtm" || x === "gtm_outcome") return "gtm";
  if (x === "conversion" || x === "gtm_conversion") return "conversion";
  if (x === "analytics" || x === "editor_metric") return "analytics";
  return null;
}

function safePayload(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  if (Object.keys(o).length > 64) return { _truncated: true };
  return o;
}

function companyIdForInsert(ctx: { scope: { role: string | null; companyId: string | null } }): string | null {
  return ctx.scope.companyId;
}

function isGtmLearningPayload(e: { type: string; payload: Record<string, unknown> }): boolean {
  if (e.type !== "gtm") return false;
  return e.payload.kind === "gtm_outcome" || e.payload.kind == null;
}

async function rebuildGtmFromStore(companyScopeId: string | null | undefined) {
  const refresh = await getEvents({
    types: ["gtm"],
    limit: 2000,
    companyScopeId: companyScopeId ?? undefined,
  });
  const chrono = [...refresh].sort((a, b) => a.timestamp - b.timestamp);
  const payloads = chrono.filter(isGtmLearningPayload).map((e) => e.payload);
  return rebuildGtmLearningFromOutcomePayloads(payloads);
}

/** GET: aggregate GTM learning and/or full system intelligence (superadmin). POST: append event (scoped company). */
export async function GET(req: NextRequest) {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const deny = requireRoleOr403(gate.ctx, ["superadmin", "company_admin"]);
    if (deny) return deny;
    const ctx = gate.ctx;
    if (ctx.scope.role === "company_admin" && !ctx.scope.companyId) {
      return jsonErr(ctx.rid, "Mangler firmakontekst.", 403, "FORBIDDEN");
    }

    const url = new URL(req.url);
    const aggregate = url.searchParams.get("aggregate");
    const scope = url.searchParams.get("scope");

    const companyScopeId = ctx.scope.role === "company_admin" ? ctx.scope.companyId : null;

    try {
      if (scope === "system" && ctx.scope.role === "superadmin") {
        const intel = await getSystemIntelligence({
          companyScopeId: undefined,
          limit: 1000,
          recentEventLimit: 80,
        });
        return jsonOk(ctx.rid, intel, 200);
      }

      if (aggregate === "gtm") {
        const gtmLearning = await rebuildGtmFromStore(companyScopeId);
        return jsonOk(ctx.rid, { gtmLearning }, 200);
      }
    } catch (e) {
      if (e instanceof IntelligenceStoreFetchError) {
        return jsonErr(ctx.rid, e.message, 500, "INTELLIGENCE_FETCH_FAILED");
      }
      throw e;
    }

    return jsonErr(ctx.rid, "Ukjent eller manglende query (bruk aggregate=gtm eller scope=system).", 400, "BAD_QUERY");
  });
}

export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const deny = requireRoleOr403(gate.ctx, ["superadmin", "company_admin"]);
    if (deny) return deny;
    const ctx = gate.ctx;
    if (ctx.scope.role === "company_admin" && !ctx.scope.companyId) {
      return jsonErr(ctx.rid, "Mangler firmakontekst.", 403, "FORBIDDEN");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
    }
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

    const rawType = typeof o.type === "string" ? o.type.trim() : "";
    const source = typeof o.source === "string" ? o.source.trim() : "gtm_dashboard";
    const domain = normalizePostType(rawType);
    if (!domain) {
      return jsonErr(ctx.rid, "Ugyldig type (bruk gtm, conversion eller analytics).", 422, "INVALID_TYPE");
    }

    const pageId = typeof o.pageId === "string" && o.pageId.trim() ? o.pageId.trim() : null;
    const payload = safePayload(o.payload);

    if (typeof payload.kind !== "string") {
      if (rawType === "gtm_outcome") payload.kind = "gtm_outcome";
      else if (rawType === "gtm_conversion") payload.kind = "gtm_conversion";
      else if (rawType === "editor_metric") payload.kind = "editor_metric";
    }

    if (domain === "gtm" && payload.kind === "gtm_outcome") {
      const lead = payload.lead;
      const classification = payload.classification;
      const templateKey = typeof payload.templateKey === "string" ? payload.templateKey.trim() : "";
      if (!lead || typeof lead !== "object" || !classification || typeof classification !== "object" || !templateKey) {
        return jsonErr(ctx.rid, "gtm_outcome krever lead, classification og templateKey.", 422, "INVALID_GTM_PAYLOAD");
      }
    }

    let inserted: Awaited<ReturnType<typeof logEvent>>;
    try {
      inserted = await logEvent({
        type: domain,
        source: source || "backoffice_client",
        payload,
        page_id: pageId,
        company_id: companyIdForInsert(ctx),
        source_rid: ctx.rid,
      });
    } catch (e) {
      if (e instanceof IntelligenceSchemaValidationError) {
        return jsonErr(ctx.rid, e.message, 400, "INTELLIGENCE_VALIDATION_FAILED");
      }
      throw e;
    }

    if (inserted.ok === false) {
      return jsonErr(ctx.rid, inserted.error, 500, "INTELLIGENCE_APPEND_FAILED");
    }

    const companyScopeId = ctx.scope.role === "company_admin" ? ctx.scope.companyId : null;
    let gtmLearning: Awaited<ReturnType<typeof rebuildGtmFromStore>>;
    try {
      gtmLearning = await rebuildGtmFromStore(companyScopeId);
    } catch (e) {
      if (e instanceof IntelligenceStoreFetchError) {
        return jsonErr(ctx.rid, e.message, 500, "INTELLIGENCE_FETCH_FAILED");
      }
      throw e;
    }

    return jsonOk(ctx.rid, { id: inserted.event.id, gtmLearning }, 200);
  });
}
