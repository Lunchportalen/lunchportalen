/**
 * U26 — Read-only «management»-lag: samme registry som Settings, som JSON for verktøy/integrasjon.
 * Ingen mutasjon. Superadmin. Kontrakt: jsonOk.
 */
import type { NextRequest } from "next/server";
import {
  getBlockCreateOptionsForGovernance,
  getDocumentTypesForGovernance,
  getFieldKindGovernance,
  getPropertyEditorSystemModel,
} from "@/lib/cms/backofficeSchemaSettingsModel";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const data = {
    source: "code_registry" as const,
    documentTypes: getDocumentTypesForGovernance(),
    blockCreateOptions: getBlockCreateOptionsForGovernance(),
    fieldKindGovernance: getFieldKindGovernance(),
    propertyEditorSystem: getPropertyEditorSystemModel(),
  };

  return jsonOk(ctx.rid, data, 200);
}
