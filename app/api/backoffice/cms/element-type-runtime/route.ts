/**
 * U96B — Element Type runtime display: merged baseline + persisted overrides.
 */
import type { NextRequest } from "next/server";
import {
  ELEMENT_TYPE_RUNTIME_OVERRIDES_KEY,
  type ElementTypeRuntimeAdminOverride,
  parseElementTypeRuntimeOverridesFromSettingsRoot,
} from "@/lib/cms/schema/elementTypeRuntimeMerge";
import { getMergedElementTypeRuntimeRecord, listElementTypeRuntimeAliases } from "@/lib/cms/schema/elementTypeRuntimeMerged.server";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { getPublishedGlobal } from "@/lib/cms/readGlobal";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function mergeOverrides(
  prev: ElementTypeRuntimeAdminOverride,
  patch: ElementTypeRuntimeAdminOverride,
): ElementTypeRuntimeAdminOverride {
  return { ...prev, ...patch };
}

function validateOverride(alias: string, ov: ElementTypeRuntimeAdminOverride): { ok: true } | { ok: false; message: string } {
  if (!getBlockTypeDefinition(alias)) return { ok: false, message: "Ukjent elementtype-alias." };
  if (ov.title !== undefined && String(ov.title).trim() === "") {
    return { ok: false, message: "Tittel kan ikke være tom." };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const merged = getMergedElementTypeRuntimeRecord();
  const pub = await getPublishedGlobal("settings");
  const root = pub?.data && isPlainObject(pub.data) ? pub.data : {};
  const overrides = parseElementTypeRuntimeOverridesFromSettingsRoot(root);

  return jsonOk(gate.ctx.rid, {
    merged,
    overrides,
    aliases: listElementTypeRuntimeAliases(),
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

  const alias = typeof body.alias === "string" ? body.alias.trim() : "";
  if (!alias || !getBlockTypeDefinition(alias)) {
    return jsonErr(gate.ctx.rid, "Ukjent eller manglende elementtype-alias.", 422, "INVALID_ALIAS");
  }

  const reset = body.reset === true;
  const pub = await getPublishedGlobal("settings");
  const publishedRoot = pub?.data && isPlainObject(pub.data) ? { ...pub.data } : {};
  const currentFile = parseElementTypeRuntimeOverridesFromSettingsRoot(publishedRoot);
  const nextByAlias = { ...currentFile.byAlias };

  if (reset) {
    delete nextByAlias[alias];
  } else {
    const overrideRaw = body.override;
    if (!isPlainObject(overrideRaw)) {
      return jsonErr(gate.ctx.rid, "override må være et objekt (eller sett reset: true).", 422, "INVALID_OVERRIDE");
    }
    const override = overrideRaw as ElementTypeRuntimeAdminOverride;
    if (Object.keys(override).length === 0) {
      return jsonErr(gate.ctx.rid, "Ingen endringer.", 422, "EMPTY_DIFF");
    }
    const v = validateOverride(alias, override);
    if (v.ok === false) {
      return jsonErr(gate.ctx.rid, v.message, 422, "INVALID_OVERRIDE");
    }
    const prev = nextByAlias[alias] ?? {};
    nextByAlias[alias] = mergeOverrides(prev, override);
  }

  const nextFile = { version: 1, byAlias: nextByAlias };
  const nextSettings: Record<string, unknown> = {
    ...publishedRoot,
    [ELEMENT_TYPE_RUNTIME_OVERRIDES_KEY]: nextFile,
  };

  const saved = await saveGlobalDraft("settings", nextSettings);
  if (saved.ok === false) {
    return jsonErr(gate.ctx.rid, saved.message, 500, "SAVE_FAILED");
  }
  const published = await publishGlobal("settings");
  if (published.ok === false) {
    return jsonErr(gate.ctx.rid, published.message, 422, "PUBLISH_FAILED");
  }

  const merged = getMergedElementTypeRuntimeRecord();
  return jsonOk(gate.ctx.rid, {
    merged,
    overrides: nextFile,
    publishedVersion: published.version,
  });
}
