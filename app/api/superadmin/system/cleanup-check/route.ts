// Read-only database cleanup checks. No writes, no schema changes.
// Reports potential orphans and stale data for operator review.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CleanupCheckItem = {
  key: string;
  status: "ok" | "warn" | "info";
  message: string;
  count?: number;
  detail?: string;
};

export type CleanupCheckPayload = {
  ok: true;
  rid: string;
  ts: string;
  checks: CleanupCheckItem[];
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.system.cleanup-check.GET", ["superadmin"]);
  if (deny) return deny;

  const checks: CleanupCheckItem[] = [];
  const ts = new Date().toISOString();

  try {
    const admin = supabaseAdmin();

    // Orphan content_page_variants: variant rows whose page_id is not in content_pages
    try {
      const { data: pageIds } = await admin.from("content_pages").select("id");
      const ids = Array.isArray(pageIds) ? pageIds.map((r: { id?: string }) => safeStr(r?.id)).filter(Boolean) : [];
      const { data: variants, error } = await admin
        .from("content_page_variants")
        .select("page_id");
      if (error) {
        checks.push({ key: "orphan_variants", status: "warn", message: "Kunne ikke sjekke variant-forelder.", detail: safeStr(error?.message) });
      } else {
        const variantPageIds = Array.isArray(variants) ? variants : [];
        const idSet = new Set(ids);
        const orphanCount = variantPageIds.filter((r: { page_id?: string }) => !idSet.has(safeStr(r?.page_id))).length;
        if (orphanCount > 0) {
          checks.push({ key: "orphan_variants", status: "warn", message: "Variant-rader uten gyldig side.", count: orphanCount });
        } else {
          checks.push({ key: "orphan_variants", status: "ok", message: "Ingen foreldreløse varianter.", count: 0 });
        }
      }
    } catch {
      checks.push({ key: "orphan_variants", status: "info", message: "Sjekk hoppet over (tabell eller kolonne mangler)." });
    }

    // Content pages with no variants (informational)
    try {
      const { data: pages, error } = await admin.from("content_pages").select("id");
      const pageCount = Array.isArray(pages) ? pages.length : 0;
      const { data: varRows } = await admin.from("content_page_variants").select("page_id");
      const uniquePages = new Set(
        (Array.isArray(varRows) ? varRows : []).map((r: { page_id?: string }) => safeStr(r?.page_id)).filter(Boolean)
      );
      const pagesWithoutVariants = pageCount - uniquePages.size;
      if (error) {
        checks.push({ key: "pages_without_variants", status: "info", message: "Kunne ikke telle sider uten varianter." });
      } else if (pagesWithoutVariants > 0) {
        checks.push({ key: "pages_without_variants", status: "info", message: "Sider uten variant-rader.", count: pagesWithoutVariants });
      } else {
        checks.push({ key: "pages_without_variants", status: "ok", message: "Alle sider har minst én variant.", count: 0 });
      }
    } catch {
      checks.push({ key: "pages_without_variants", status: "info", message: "Sjekk hoppet over." });
    }

    const payload: CleanupCheckPayload = { ok: true, rid: ctx.rid, ts, checks };
    return jsonOk(ctx.rid, payload, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(ctx.rid, "Cleanup-sjekk feilet.", 500, "CLEANUP_CHECK_FAILED", { detail: msg });
  }
}
