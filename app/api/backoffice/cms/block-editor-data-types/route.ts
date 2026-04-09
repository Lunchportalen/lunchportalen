/**
 * U95 — Block Editor Data Types: merged baseline + admin overrides (settings global), references.
 * GET: merged, raw overrides file, referencesByAlias.
 * PUT: merge override for one alias into settings.published path via saveGlobalDraft + publishGlobal.
 */
import type { NextRequest } from "next/server";
import { getBlockEditorDataType, listBlockEditorDataTypeAliases } from "@/lib/cms/blocks/blockEditorDataTypes";
import { getMergedBlockEditorDataTypesRecord } from "@/lib/cms/blocks/blockEditorDataTypeMerged.server";
import {
  BLOCK_EDITOR_DATA_TYPE_OVERRIDES_KEY,
  type BlockEditorDataTypeAdminOverride,
  parseOverridesFromSettingsRoot,
} from "@/lib/cms/blocks/blockEditorDataTypeMerge";
import { blockEditorDataTypeReferencesByAlias } from "@/lib/cms/blocks/blockEditorDataTypeReferences";
import { EDITOR_BLOCK_CREATE_OPTIONS } from "@/lib/cms/editorBlockCreateOptions";
import { getPublishedGlobal } from "@/lib/cms/readGlobal";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_BLOCK_TYPES = new Set(EDITOR_BLOCK_CREATE_OPTIONS.map((o) => o.type));

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function validateOverride(ov: BlockEditorDataTypeAdminOverride): { ok: true } | { ok: false; message: string } {
  if (ov.allowedBlockAliases !== undefined) {
    if (!Array.isArray(ov.allowedBlockAliases)) {
      return { ok: false, message: "allowedBlockAliases må være en liste." };
    }
    for (const x of ov.allowedBlockAliases) {
      const t = String(x ?? "").trim();
      if (!t || !VALID_BLOCK_TYPES.has(t)) {
        return { ok: false, message: `Ugyldig blokk-alias i allowlist: ${String(x)}` };
      }
    }
  }
  if (ov.groups !== undefined) {
    if (!Array.isArray(ov.groups)) {
      return { ok: false, message: "groups må være en liste." };
    }
    for (const g of ov.groups) {
      if (!g || typeof g !== "object" || Array.isArray(g)) {
        return { ok: false, message: "Hver gruppe må være et objekt med id, title og blockAliases." };
      }
      const id = String((g as { id?: unknown }).id ?? "").trim();
      const title = String((g as { title?: unknown }).title ?? "").trim();
      if (!id || !title) {
        return { ok: false, message: "Gruppe mangler id eller title." };
      }
      const ba = (g as { blockAliases?: unknown }).blockAliases;
      if (!Array.isArray(ba)) {
        return { ok: false, message: "Gruppe blockAliases må være en liste." };
      }
      for (const x of ba) {
        const t = String(x ?? "").trim();
        if (!t || !VALID_BLOCK_TYPES.has(t)) {
          return { ok: false, message: `Ugyldig blokk-alias i gruppe «${title}»: ${String(x)}` };
        }
      }
    }
  }
  if (ov.minItems !== undefined) {
    const n = Number(ov.minItems);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { ok: false, message: "minItems må være et heltall ≥ 0." };
    }
  }
  if (ov.maxItems !== undefined) {
    const n = Number(ov.maxItems);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { ok: false, message: "maxItems må være et heltall ≥ 0." };
    }
  }
  if (ov.minItems !== undefined && ov.maxItems !== undefined && ov.minItems > ov.maxItems) {
    return { ok: false, message: "minItems kan ikke være større enn maxItems." };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const merged = getMergedBlockEditorDataTypesRecord();
  const pub = await getPublishedGlobal("settings");
  const root = pub?.data && isPlainObject(pub.data) ? pub.data : {};
  const overrides = parseOverridesFromSettingsRoot(root);

  return jsonOk(gate.ctx.rid, {
    merged,
    overrides,
    referencesByAlias: blockEditorDataTypeReferencesByAlias(),
    aliases: listBlockEditorDataTypeAliases(),
  });
}

export async function PUT(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(gate.ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  if (!isPlainObject(body)) {
    return jsonErr(gate.ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");
  }

  const aliasRaw = body.alias;
  const alias = typeof aliasRaw === "string" ? aliasRaw.trim() : "";
  if (!alias || !listBlockEditorDataTypeAliases().includes(alias)) {
    return jsonErr(gate.ctx.rid, "Ukjent eller manglende data type-alias.", 422, "INVALID_ALIAS");
  }

  const reset = body.reset === true;
  const pub = await getPublishedGlobal("settings");
  const publishedRoot = pub?.data && isPlainObject(pub.data) ? { ...pub.data } : {};
  const currentFile = parseOverridesFromSettingsRoot(publishedRoot);
  const nextByAlias = { ...currentFile.byAlias };

  if (reset) {
    delete nextByAlias[alias];
  } else {
    const overrideRaw = body.override;
    if (!isPlainObject(overrideRaw)) {
      return jsonErr(gate.ctx.rid, "override må være et objekt (eller sett reset: true).", 422, "INVALID_OVERRIDE");
    }
    const override = overrideRaw as BlockEditorDataTypeAdminOverride;

    const v = validateOverride(override);
    if (v.ok === false) {
      return jsonErr(gate.ctx.rid, v.message, 422, "INVALID_OVERRIDE");
    }

    if (!getBlockEditorDataType(alias)) {
      return jsonErr(gate.ctx.rid, "Baseline for data type mangler.", 500, "BASELINE_MISSING");
    }

    nextByAlias[alias] = { ...nextByAlias[alias], ...override };
  }

  const nextFile = { version: 1, byAlias: nextByAlias };
  const nextSettings: Record<string, unknown> = {
    ...publishedRoot,
    [BLOCK_EDITOR_DATA_TYPE_OVERRIDES_KEY]: nextFile,
  };

  const saved = await saveGlobalDraft("settings", nextSettings);
  if (saved.ok === false) {
    return jsonErr(gate.ctx.rid, saved.message, 500, "SAVE_FAILED");
  }
  const published = await publishGlobal("settings");
  if (published.ok === false) {
    return jsonErr(gate.ctx.rid, published.message, 422, "PUBLISH_FAILED");
  }

  const merged = getMergedBlockEditorDataTypesRecord();
  return jsonOk(gate.ctx.rid, {
    merged,
    overrides: nextFile,
    referencesByAlias: blockEditorDataTypeReferencesByAlias(),
    publishedVersion: published.version,
  });
}
