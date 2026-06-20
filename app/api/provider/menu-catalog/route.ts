export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { fetchLunchCategoryRowsForProvider } from "@/lib/cms/lunchCategory";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  applyOrderLocksToCatalog,
  loadProviderOrderLockState,
  MENU_ORDER_LOCKED_CODE,
  ProviderMenuOrderLockError,
} from "@/lib/provider-menu/providerMenuOrderLock";
import { CATALOG_WEEK_PUBLISH_HINT } from "@/lib/provider-menu/lunchCategoryCatalog";
import {
  MenuCatalogWriteError,
  persistProviderMenuCatalog,
  type MenuCatalogWriteInput,
} from "@/lib/provider-menu/menuCatalogWrite";
import { buildMenuCatalogSnapshot } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import { requireSanityWrite } from "@/lib/sanity/client";

const WRITE_ROLE = "provider_admin" as const;
const VIEW_ROLE = "provider_viewer" as const;

function parseWriteBody(body: unknown): MenuCatalogWriteInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const categoryKey = String(o.categoryKey ?? "").trim();
  if (!categoryKey) return null;
  const itemsRaw = o.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) return null;

  const items: MenuCatalogWriteInput["items"] = [];
  for (const row of itemsRaw) {
    if (!row || typeof row !== "object") return null;
    const it = row as Record<string, unknown>;
    const title = String(it.title ?? "").trim();
    if (!title) return null;
    const keyRaw = it.key;
    const key =
      keyRaw === undefined || keyRaw === null ? undefined : String(keyRaw).trim() || undefined;
    items.push({
      key,
      title,
      description: typeof it.description === "string" ? it.description : null,
      allergens: Array.isArray(it.allergens) ? it.allergens.map((a) => String(a)) : [],
      isVegetarian: it.isVegetarian === true,
    });
  }

  return { categoryKey, items };
}

async function resolveProviderViewer(rid: string) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { error: jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED") };
  }

  const userId = String(auth.user.id).trim();
  const ctx = await getProviderAdminContext(userId);
  const provider = ctx.primaryProvider;
  if (!provider) {
    return { error: jsonErr(rid, "Ingen leverandørtilgang.", 403, "FORBIDDEN") };
  }

  const canView = await hasProviderRole(userId, provider.id, VIEW_ROLE);
  if (!canView) {
    return { error: jsonErr(rid, "Du har ikke tilgang til meny.", 403, "FORBIDDEN") };
  }

  return { userId, provider };
}

export async function GET(_req: NextRequest) {
  const rid = makeRid("prov_cat");

  const resolved = await resolveProviderViewer(rid);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { provider } = resolved as { userId: string; provider: { id: string; slug: string; name: string } };

  const rows = await fetchLunchCategoryRowsForProvider(provider.id);
  const lockState = await loadProviderOrderLockState(provider.id);
  const catalog = applyOrderLocksToCatalog(buildMenuCatalogSnapshot(rows), lockState);

  return jsonOk(rid, {
    catalog,
    providerId: provider.id,
    providerSlug: provider.slug,
    weekPublishHint: CATALOG_WEEK_PUBLISH_HINT,
  });
}

export async function POST(req: NextRequest) {
  const rid = makeRid("prov_cat");

  const resolved = await resolveProviderViewer(rid);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { userId, provider } = resolved as {
    userId: string;
    provider: { id: string; slug: string; name: string };
  };

  const canWrite = await hasProviderRole(userId, provider.id, WRITE_ROLE);
  if (!canWrite) {
    return jsonErr(rid, "Kun leverandør-admin kan redigere katalogen.", 403, "FORBIDDEN");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  const parsed = parseWriteBody(body);
  if (!parsed) {
    return jsonErr(rid, "Ugyldig forespørsel. Sjekk kategori og valg.", 422, "INVALID_BODY");
  }

  try {
    const writeClient = requireSanityWrite();
    const { catalog: rawCatalog } = await persistProviderMenuCatalog(writeClient, provider.id, parsed);
    const lockState = await loadProviderOrderLockState(provider.id);
    const catalog = applyOrderLocksToCatalog(rawCatalog, lockState);
    return jsonOk(rid, {
      catalog,
      providerId: provider.id,
      providerSlug: provider.slug,
      weekPublishHint: CATALOG_WEEK_PUBLISH_HINT,
    });
  } catch (e) {
    if (e instanceof ProviderMenuOrderLockError) {
      return jsonErr(rid, e.message, 422, MENU_ORDER_LOCKED_CODE, {
        lockedKeys: e.lockedKeys ?? [],
      });
    }
    if (e instanceof MenuCatalogWriteError) {
      return jsonErr(rid, e.message, 422, "VALIDATION_ERROR", { field: e.field });
    }
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("SANITY_WRITE_TOKEN")) {
      return jsonErr(rid, "Kataloglagring er ikke tilgjengelig (mangler write-token).", 503, "SANITY_WRITE_BLOCKED");
    }
    return jsonErr(rid, "Kunne ikke lagre katalog.", 500, "SAVE_FAILED");
  }
}
