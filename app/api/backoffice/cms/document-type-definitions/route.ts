/**
 * U96 — Document Type definitions: merged baseline + admin overrides (settings global).
 */
import type { NextRequest } from "next/server";
import { listBlockEditorDataTypeAliases } from "@/lib/cms/blocks/blockEditorDataTypes";
import {
  DOCUMENT_TYPE_DEFINITION_OVERRIDES_KEY,
  type DocumentTypeAdminOverride,
  parseDocumentTypeOverridesFromSettingsRoot,
} from "@/lib/cms/schema/documentTypeDefinitionMerge";
import {
  getMergedDocumentTypeDefinitionsCoreRecord,
  getMergedDocumentTypeDefinitionsRecord,
} from "@/lib/cms/schema/documentTypeDefinitionMerged.server";
import { getBaselineCompositionDefinition, listCompositionAliases } from "@/lib/cms/schema/compositionDefinitions";
import {
  getBaselineDocumentTypeDefinition,
  listDocumentTypeAliases,
} from "@/lib/cms/schema/documentTypeDefinitions";
import { listDocumentTemplateAliases } from "@/lib/cms/schema/documentTemplateDefinitions";
import { isCmsScalarDataTypeAlias } from "@/lib/cms/schema/scalarDataTypeCatalog";
import { SEMANTIC_ICON_KEYS } from "@/lib/iconRegistry";
import { getPublishedGlobal } from "@/lib/cms/readGlobal";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ICON_SET = new Set<string>(SEMANTIC_ICON_KEYS);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function mergeDocumentOverrides(prev: DocumentTypeAdminOverride, patch: DocumentTypeAdminOverride): DocumentTypeAdminOverride {
  const next: DocumentTypeAdminOverride = { ...prev, ...patch };
  if (patch.groups || prev.groups) {
    next.groups = { ...prev.groups, ...patch.groups };
  }
  if (patch.properties || prev.properties) {
    const propKeys = new Set([...Object.keys(prev.properties ?? {}), ...Object.keys(patch.properties ?? {})]);
    const properties: NonNullable<DocumentTypeAdminOverride["properties"]> = { ...prev.properties };
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

function validateOverride(alias: string, ov: DocumentTypeAdminOverride): { ok: true } | { ok: false; message: string } {
  const baseline = getBaselineDocumentTypeDefinition(alias);
  if (!baseline) return { ok: false, message: "Ukjent dokumenttype." };

  if (ov.icon !== undefined) {
    const ic = String(ov.icon).trim();
    if (!ICON_SET.has(ic)) {
      return { ok: false, message: `Ugyldig icon: ${ic}` };
    }
  }

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
      if (p?.variation !== undefined && p.variation !== "invariant" && p.variation !== "culture") {
        return { ok: false, message: `Ugyldig variation for property: ${pk}` };
      }
    }
  }

  const allDocAliases = new Set(listDocumentTypeAliases());
  if (ov.allowedChildTypes !== undefined) {
    for (const c of ov.allowedChildTypes) {
      const k = String(c).trim();
      if (!k || !allDocAliases.has(k)) {
        return { ok: false, message: `Ugyldig allowedChildTypes: ${c}` };
      }
    }
  }

  if (ov.compositionAliases !== undefined) {
    const compSet = new Set(listCompositionAliases());
    for (const c of ov.compositionAliases) {
      const k = String(c).trim();
      if (!k || !compSet.has(k)) {
        return { ok: false, message: `Ukjent composition: ${c}` };
      }
      const comp = getBaselineCompositionDefinition(k);
      if (comp && !comp.allowedDocumentTypeAliases.includes(alias)) {
        return { ok: false, message: `Composition «${k}» kan ikke brukes på «${alias}».` };
      }
    }
  }

  const templateSet = new Set(listDocumentTemplateAliases());
  if (ov.templates !== undefined) {
    for (const t of ov.templates) {
      const k = String(t).trim();
      if (!k || !templateSet.has(k)) {
        return { ok: false, message: `Ugyldig template: ${t}` };
      }
    }
  }

  const templatesEff =
    ov.templates !== undefined ? ov.templates.map((x) => String(x).trim()) : [...baseline.templates];
  if (ov.defaultTemplate !== undefined && ov.defaultTemplate !== null) {
    const dt = String(ov.defaultTemplate).trim();
    if (dt && !templatesEff.includes(dt)) {
      return { ok: false, message: "defaultTemplate må finnes i templates-listen." };
    }
  }

  return { ok: true };
}

export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const merged = getMergedDocumentTypeDefinitionsRecord();
  const mergedCore = getMergedDocumentTypeDefinitionsCoreRecord();
  const pub = await getPublishedGlobal("settings");
  const root = pub?.data && isPlainObject(pub.data) ? pub.data : {};
  const overrides = parseDocumentTypeOverridesFromSettingsRoot(root);

  return jsonOk(gate.ctx.rid, {
    merged,
    mergedCore,
    overrides,
    aliases: listDocumentTypeAliases(),
    compositionAliases: listCompositionAliases(),
    templateAliases: listDocumentTemplateAliases(),
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
  if (!alias || !listDocumentTypeAliases().includes(alias)) {
    return jsonErr(gate.ctx.rid, "Ukjent eller manglende dokumenttype-alias.", 422, "INVALID_ALIAS");
  }

  const reset = body.reset === true;
  const pub = await getPublishedGlobal("settings");
  const publishedRoot = pub?.data && isPlainObject(pub.data) ? { ...pub.data } : {};
  const currentFile = parseDocumentTypeOverridesFromSettingsRoot(publishedRoot);
  const nextByAlias = { ...currentFile.byAlias };

  if (reset) {
    delete nextByAlias[alias];
  } else {
    const overrideRaw = body.override;
    if (!isPlainObject(overrideRaw)) {
      return jsonErr(gate.ctx.rid, "override må være et objekt (eller sett reset: true).", 422, "INVALID_OVERRIDE");
    }
    const override = overrideRaw as DocumentTypeAdminOverride;
    const v = validateOverride(alias, override);
    if (v.ok === false) {
      return jsonErr(gate.ctx.rid, v.message, 422, "INVALID_OVERRIDE");
    }
    const prev = nextByAlias[alias] ?? {};
    nextByAlias[alias] = mergeDocumentOverrides(prev, override);
  }

  const nextFile = { version: 1, byAlias: nextByAlias };
  const nextSettings: Record<string, unknown> = {
    ...publishedRoot,
    [DOCUMENT_TYPE_DEFINITION_OVERRIDES_KEY]: nextFile,
  };

  const saved = await saveGlobalDraft("settings", nextSettings);
  if (saved.ok === false) {
    return jsonErr(gate.ctx.rid, saved.message, 500, "SAVE_FAILED");
  }
  const published = await publishGlobal("settings");
  if (published.ok === false) {
    return jsonErr(gate.ctx.rid, published.message, 422, "PUBLISH_FAILED");
  }

  const merged = getMergedDocumentTypeDefinitionsRecord();
  const mergedCore = getMergedDocumentTypeDefinitionsCoreRecord();
  return jsonOk(gate.ctx.rid, {
    merged,
    mergedCore,
    overrides: nextFile,
    publishedVersion: published.version,
  });
}
