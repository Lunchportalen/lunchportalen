/**
 * POST /api/backoffice/cms/menu-draft
 *
 * Patch Sanity `menu` by mealType — writes to the draft layer only (no publish).
 * Superadmin only.
 */
import type { NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { requireSanityWrite } from "@/lib/cms/sanityWriteClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PatchOk = { title: string; description: string; allergens: string[] };

function validatePatch(raw: unknown): { ok: true; data: PatchOk } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "patch må være et objekt." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string") return { ok: false, error: "title må være tekst." };
  if (typeof o.description !== "string") return { ok: false, error: "description må være tekst." };
  if (!Array.isArray(o.allergens)) return { ok: false, error: "allergens må være en liste." };
  const title = o.title.trim();
  const description = o.description.trim();
  const allergens = o.allergens.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (title.length < 2) return { ok: false, error: "Tittel må være minst 2 tegn." };
  if (title.length > 120) return { ok: false, error: "Tittel over 120 tegn." };
  if (description.length > 4000) return { ok: false, error: "Beskrivelse over 4000 tegn." };
  if (allergens.length > 32) return { ok: false, error: "For mange allergener." };
  for (const a of allergens) {
    if (a.length > 64) return { ok: false, error: "Allergen for langt." };
  }
  return { ok: true, data: { title, description, allergens } };
}

function resolveDraftDocumentId(rows: Array<{ _id?: string }>): string | null {
  let publishedId: string | null = null;
  let draftOnlyId: string | null = null;
  for (const r of rows) {
    const id = typeof r._id === "string" ? r._id.trim() : "";
    if (!id) continue;
    if (id.startsWith("drafts.")) {
      if (!draftOnlyId) draftOnlyId = id;
    } else if (!publishedId) {
      publishedId = id;
    }
  }
  if (publishedId) return `drafts.${publishedId}`;
  return draftOnlyId;
}

export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const mealKey = normalizeMealTypeKey(o.mealType);
  if (!mealKey) {
    return jsonErr(ctx.rid, "mealType er ugyldig eller mangler.", 422, "MISSING_MEAL_TYPE");
  }

  const patchResult = validatePatch(o.patch);
  if (patchResult.ok === false) {
    return jsonErr(ctx.rid, patchResult.error, 422, "INVALID_PATCH");
  }

  let client;
  try {
    client = requireSanityWrite();
  } catch {
    return jsonErr(ctx.rid, "Sanity write er ikke konfigurert (SANITY_WRITE_TOKEN).", 503, "SANITY_WRITE_DISABLED");
  }

  let rows: Array<{ _id?: string }>;
  try {
    const fetched = await client.fetch(`*[_type == "menu" && mealType == $k]{ _id }`, { k: mealKey });
    rows = Array.isArray(fetched) ? (fetched as Array<{ _id?: string }>) : [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(ctx.rid, "Kunne ikke slå opp meny i CMS.", 500, "SANITY_FETCH_FAILED", msg);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonErr(ctx.rid, "Fant ingen meny-dokument for denne mealType.", 404, "MENU_NOT_FOUND");
  }

  const draftDocId = resolveDraftDocumentId(rows);
  if (!draftDocId) {
    return jsonErr(ctx.rid, "Kunne ikke bestemme utkast-ID for meny.", 500, "SANITY_ID_ERROR");
  }

  try {
    await client
      .patch(draftDocId)
      .set({
        title: patchResult.data.title,
        description: patchResult.data.description,
        allergens: patchResult.data.allergens,
      })
      .commit({ autoGenerateArrayKeys: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(ctx.rid, "Kunne ikke skrive til CMS-utkast.", 500, "SANITY_PATCH_FAILED", msg);
  }

  return jsonOk(
    ctx.rid,
    {
      mealType: mealKey,
      draftDocumentId: draftDocId,
      saved: true as const,
      published: false as const,
    },
    200
  );
}
