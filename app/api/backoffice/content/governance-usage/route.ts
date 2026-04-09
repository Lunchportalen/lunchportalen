/**
 * U27 — Read-only governance usage: legacy vs envelope, documentType-fordeling, blokktyper.
 * Skanner variant-rader (cap) — ingen massemigrering.
 */
import type { NextRequest } from "next/server";
import { getMergedBlockEditorDataTypesRecord } from "@/lib/cms/blocks/blockEditorDataTypeMerged.server";
import { getMergedDocumentTypeDefinitionsRecord } from "@/lib/cms/schema/documentTypeDefinitionMerged.server";
import { summarizeGovernanceFromVariantRows } from "@/lib/cms/contentGovernanceUsage";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SCAN = 8000;
const PAGE = 500;

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(_request: NextRequest) {
  const s = await scopeOr401(_request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  try {
    const supabase = supabaseAdmin();

    const { count: totalVariantsInDb, error: countErr } = await supabase
      .from("content_page_variants")
      .select("*", { count: "exact", head: true });

    if (countErr) throw countErr;

    const rows: { page_id: string; body: unknown }[] = [];
    for (let offset = 0; offset < MAX_SCAN; offset += PAGE) {
      const { data, error } = await supabase
        .from("content_page_variants")
        .select("page_id, body")
        .order("page_id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      const batch = Array.isArray(data) ? data : [];
      if (batch.length === 0) break;
      for (const r of batch) {
        const o = r as { page_id?: string; body?: unknown };
        if (typeof o.page_id === "string" && o.page_id.trim()) {
          rows.push({ page_id: o.page_id.trim(), body: o.body });
        }
      }
      if (batch.length < PAGE) break;
    }

    const mergedDt = getMergedBlockEditorDataTypesRecord();
    const mergedDoc = getMergedDocumentTypeDefinitionsRecord();
    const base = summarizeGovernanceFromVariantRows(rows, mergedDt, mergedDoc);
    const scanCapped = rows.length >= MAX_SCAN || (typeof totalVariantsInDb === "number" && totalVariantsInDb > rows.length);

    return jsonOk(
      ctx.rid,
      {
        ...base,
        totalVariantsInDb: typeof totalVariantsInDb === "number" ? totalVariantsInDb : null,
        scanCapped,
        maxScan: MAX_SCAN,
      },
      200
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}
