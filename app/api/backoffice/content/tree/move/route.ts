import type { NextRequest } from "next/server";
import {
  type ContentTreeRootKey,
  isContentTreeRootKey,
} from "@/lib/cms/contentTreeRoots";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { isLocalDevContentReserveEnabled } from "@/lib/cms/contentLocalDevReserve";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { isLocalCmsRuntimeError, moveLocalCmsTreeNode } from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { supabaseAdmin } from "@/lib/supabase/admin";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

async function assertNoCycle(
  supabase: ReturnType<typeof supabaseAdmin>,
  pageId: string,
  parentPageId: string | null,
  rid: string
): Promise<Response | null> {
  if (!parentPageId) return null;
  if (parentPageId === pageId) {
    return jsonErr(rid, "Kan ikke sette node som sin egen forelder.", 400, "CYCLE_FORBIDDEN");
  }

  let current: string | null = parentPageId;
  const visited = new Set<string>();
  let safety = 0;

  while (current && safety < 64) {
    if (current === pageId) {
      return jsonErr(rid, "Bevegelse ville skape syklus i treet.", 400, "CYCLE_FORBIDDEN");
    }
    if (visited.has(current)) {
      return jsonErr(rid, "Oppdaget syklisk struktur i treet.", 400, "CYCLE_FORBIDDEN");
    }
    visited.add(current);
    safety += 1;

    const { data, error } = await (supabase as any)
      .from("content_pages")
      .select("id, tree_parent_id")
      .eq("id", current)
      .maybeSingle();

    if (error) {
      return jsonErr(rid, "Kunne ikke verifisere forelder.", 400, "INVALID_PARENT", { detail: String(error?.message ?? error) });
    }
    if (!data?.id) {
      return jsonErr(rid, "Forelder finnes ikke.", 400, "INVALID_PARENT");
    }

    const next = (data as { tree_parent_id: string | null }).tree_parent_id ?? null;
    current = next;
  }

  if (safety >= 64) {
    return jsonErr(rid, "Tre-dybde overstiger sikkerhetsgrense.", 400, "INVALID_PARENT");
  }

  return null;
}

export async function POST(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const body = await readJson(request);
  const pageId = typeof body?.page_id === "string" ? body.page_id.trim() : null;
  const parentPageId = body?.parent_page_id === null || body?.parent_page_id === undefined
    ? null
    : typeof body?.parent_page_id === "string" ? body.parent_page_id.trim() : null;
  const rootKeyRaw = body?.root_key;
  const rootKey =
    typeof rootKeyRaw === "string" && isContentTreeRootKey(rootKeyRaw.trim())
      ? (rootKeyRaw.trim() as ContentTreeRootKey)
      : null;
  const sortOrder = typeof body?.sort_order === "number" && Number.isFinite(body.sort_order)
    ? body.sort_order
    : typeof body?.sort_order === "string"
      ? parseInt(body.sort_order, 10)
      : 0;
  const sortOrderSafe = Number.isFinite(sortOrder) ? sortOrder : 0;

  if (!pageId) {
    return jsonErr(ctx.rid, "Mangler page_id.", 400, "BAD_REQUEST");
  }

  const mustUseRoot = parentPageId === null || parentPageId === "";
  const mustUseParent = parentPageId !== null && parentPageId !== "";

  if (mustUseRoot && !rootKey) {
    return jsonErr(ctx.rid, "Når parent_page_id er null må root_key angis (home, overlays, global, design).", 400, "BAD_REQUEST");
  }
  if (mustUseParent && rootKey) {
    return jsonErr(ctx.rid, "Når parent_page_id er satt skal root_key ikke angis.", 400, "BAD_REQUEST");
  }

  return withCmsPageDocumentGate("api/backoffice/content/tree/move/POST", async () => {
  try {
    if (isLocalCmsRuntimeEnabled()) {
      const page = moveLocalCmsTreeNode({
        pageId,
        parentPageId,
        rootKey,
        sortOrder: sortOrderSafe,
      });
      return jsonOk(ctx.rid, { ok: true, page }, 200);
    }

    if (isLocalDevContentReserveEnabled()) {
      return jsonErr(
        ctx.rid,
        "Lokal content-reserve er skrivebeskyttet. Flytting i treet er blokkert i reserve-modus.",
        503,
        "LOCAL_DEV_CONTENT_RESERVE_READONLY",
      );
    }

    const supabase = supabaseAdmin();

    if (mustUseParent && parentPageId) {
      const cycleErr = await assertNoCycle(supabase, pageId, parentPageId, ctx.rid);
      if (cycleErr) return cycleErr;
    }

    const updates: Record<string, unknown> = {
      tree_sort_order: sortOrderSafe,
      updated_at: new Date().toISOString(),
    };
    if (mustUseRoot) {
      updates.tree_parent_id = null;
      updates.tree_root_key = rootKey;
    } else {
      updates.tree_parent_id = parentPageId;
      updates.tree_root_key = null;
    }

    const { data, error } = await supabase
      .from("content_pages")
      .update(updates)
      .eq("id", pageId)
      .select("id, tree_parent_id, tree_root_key, tree_sort_order")
      .single();

    if (error) throw error;
    if (!data) {
      return jsonErr(ctx.rid, "Siden finnes ikke.", 404, "NOT_FOUND");
    }

    return jsonOk(ctx.rid, { ok: true, page: data }, 200);
  } catch (e) {
    if (isLocalCmsRuntimeError(e)) {
      return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
    }
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
  });
}
