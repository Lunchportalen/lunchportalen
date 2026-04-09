/**
 * U97 — Composition definitions: merged baseline + admin overrides (settings global).
 */
import type { NextRequest } from "next/server";
import { listBlockEditorDataTypeAliases } from "@/lib/cms/blocks/blockEditorDataTypes";
import {
  COMPOSITION_DEFINITION_OVERRIDES_KEY,
  type CompositionAdminOverride,
  parseCompositionOverridesFromSettingsRoot,
} from "@/lib/cms/schema/compositionDefinitionMerge";
import { getMergedCompositionDefinitionsRecord } from "@/lib/cms/schema/compositionDefinitionMerged.server";
import {
  getBaselineCompositionDefinition,
  listCompositionAliases,
} from "@/lib/cms/schema/compositionDefinitions";
import { isCmsScalarDataTypeAlias } from "@/lib/cms/schema/scalarDataTypeCatalog";
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

function mergeCompositionOverrides(prev: CompositionAdminOverride, patch: CompositionAdminOverride): CompositionAdminOverride {
  const next: CompositionAdminOverride = { ...prev, ...patch };
  if (patch.groups || prev.groups) {
    next.groups = { ...prev.groups, ...patch.groups };
  }
  if (patch.properties || prev.properties) {
    const propKeys = new Set([...Object.keys(prev.properties ?? {}), ...Object.keys(patch.properties ?? {})]);
    const properties: NonNullable<CompositionAdminOverride["properties"]> = { ...prev.properties };
    for (const k of propKeys) {
      const a = prev.properties?.[k];
      const b = patch.properties?.[k];
      if (!a && !b) continue;
      properties[k] = { ...(a ?? {}), ...(b ?? {}) };
    }
    next.properties = properties;
  }
  return next;
}

function validateOverride(alias: string, ov: CompositionAdminOverride): { ok: true } | { ok: false; message: string } {
  const baseline = getBaselineCompositionDefinition(alias);
  if (!baseline) return { ok: false, message: "Ukjent composition." };

  if (ov.groups) {
    for (const [gid, g] of Object.entries(ov.groups)) {
      if (!baseline.groups.some((x) => x.id === gid)) {
        return { ok: false, message: `Ukjent gruppe-id: ${gid}` };
      }
      if (g && typeof g === "object" && g.title !== undefined && String(g.title).trim() === "") {
        return { ok: false, message: "Gruppetittel kan ikke være tom." };
      }
    }
  }

  if (ov.properties) {
    for (const [pk, p] of Object.entries(ov.properties)) {
      const baseP = baseline.properties.find((x) => x.alias === pk);
      if (!baseP) {
        return { ok: false, message: `Ukjent property-alias: ${pk}` };
      }
      if (p?.dataTypeAlias !== undefined) {
        const dt = String(p.dataTypeAlias).trim();
        if (!listBlockEditorDataTypeAliases().includes(dt) && !isCmsScalarDataTypeAlias(dt)) {
          return { ok: false, message: `Ugyldig data type for property: ${dt}` };
        }
      }
      if (p?.groupId !== undefined) {
        const gid = String(p.groupId).trim();
        if (!baseline.groups.some((x) => x.id === gid)) {
          return { ok: false, message: `Ukjent groupId på property: ${gid}` };
        }
      }
    }
  }

  return { ok: true };
}

export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const merged = getMergedCompositionDefinitionsRecord();
  const pub = await getPublishedGlobal("settings");
  const root = pub?.data && isPlainObject(pub.data) ? pub.data : {};
  const overrides = parseCompositionOverridesFromSettingsRoot(root);

  return jsonOk(gate.ctx.rid, {
    merged,
    overrides,
    aliases: listCompositionAliases(),
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
  if (!alias || !listCompositionAliases().includes(alias)) {
    return jsonErr(gate.ctx.rid, "Ukjent eller manglende composition-alias.", 422, "INVALID_ALIAS");
  }

  const reset = body.reset === true;
  const pub = await getPublishedGlobal("settings");
  const publishedRoot = pub?.data && isPlainObject(pub.data) ? { ...pub.data } : {};
  const currentFile = parseCompositionOverridesFromSettingsRoot(publishedRoot);
  const nextByAlias = { ...currentFile.byAlias };

  if (reset) {
    delete nextByAlias[alias];
  } else {
    const overrideRaw = body.override;
    if (!isPlainObject(overrideRaw)) {
      return jsonErr(gate.ctx.rid, "override må være et objekt (eller sett reset: true).", 422, "INVALID_OVERRIDE");
    }
    const override = overrideRaw as CompositionAdminOverride;
    const v = validateOverride(alias, override);
    if (v.ok === false) {
      return jsonErr(gate.ctx.rid, v.message, 422, "INVALID_OVERRIDE");
    }
    const prev = nextByAlias[alias] ?? {};
    nextByAlias[alias] = mergeCompositionOverrides(prev, override);
  }

  const nextFile = { version: 1, byAlias: nextByAlias };
  const nextSettings: Record<string, unknown> = {
    ...publishedRoot,
    [COMPOSITION_DEFINITION_OVERRIDES_KEY]: nextFile,
  };

  const saved = await saveGlobalDraft("settings", nextSettings);
  if (saved.ok === false) {
    return jsonErr(gate.ctx.rid, saved.message, 500, "SAVE_FAILED");
  }
  const published = await publishGlobal("settings");
  if (published.ok === false) {
    return jsonErr(gate.ctx.rid, published.message, 422, "PUBLISH_FAILED");
  }

  const merged = getMergedCompositionDefinitionsRecord();
  return jsonOk(gate.ctx.rid, {
    merged,
    overrides: nextFile,
    publishedVersion: published.version,
  });
}
