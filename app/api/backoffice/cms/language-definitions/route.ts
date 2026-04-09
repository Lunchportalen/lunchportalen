/**
 * U98 — Language definitions: merged baseline + admin overrides (settings global).
 */
import type { NextRequest } from "next/server";
import { getPublishedGlobal } from "@/lib/cms/readGlobal";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";
import type { LanguageDefinition } from "@/lib/cms/schema/languageDefinitions";
import { listLanguageAliases } from "@/lib/cms/schema/languageDefinitions";
import {
  LANGUAGE_DEFINITION_OVERRIDES_KEY,
  type LanguageAdminOverride,
  mergeAllLanguagesWithOverrides,
  parseLanguageOverridesFromSettingsRoot,
} from "@/lib/cms/schema/languageDefinitionMerge";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function validateLanguageOverride(ov: LanguageAdminOverride): { ok: true } | { ok: false; message: string } {
  if (ov.storageLocale !== undefined && ov.storageLocale !== "nb" && ov.storageLocale !== "en") {
    return { ok: false, message: "storageLocale må være nb eller en." };
  }
  return { ok: true };
}

function validateMergedSet(merged: Record<string, LanguageDefinition>): { ok: true } | { ok: false; message: string } {
  for (const l of Object.values(merged)) {
    if (l.isMandatory && !l.enabled) {
      return { ok: false, message: `Mandatory språk kan ikke deaktiveres: ${l.alias}` };
    }
  }
  const enabled = Object.values(merged).filter((l) => l.enabled);
  if (enabled.length === 0) {
    return { ok: false, message: "Minst ett språk må være aktivert." };
  }
  const defaults = enabled.filter((l) => l.isDefault);
  if (defaults.length !== 1) {
    return { ok: false, message: "Eksakt ett aktivt språk må være default." };
  }
  const seen = new Set<string>();
  for (const l of enabled) {
    const k = l.storageLocale;
    if (seen.has(k)) {
      return { ok: false, message: `Duplikat storageLocale blant aktive språk: ${k}` };
    }
    seen.add(k);
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const pub = await getPublishedGlobal("settings");
  const root = pub?.data && isPlainObject(pub.data) ? pub.data : {};
  const overrides = parseLanguageOverridesFromSettingsRoot(root);
  const merged = mergeAllLanguagesWithOverrides(overrides);

  return jsonOk(gate.ctx.rid, {
    merged,
    overrides,
    aliases: listLanguageAliases(),
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
  if (!alias || !listLanguageAliases().includes(alias)) {
    return jsonErr(gate.ctx.rid, "Ukjent eller manglende språk-alias.", 422, "INVALID_ALIAS");
  }

  const reset = body.reset === true;
  const pub = await getPublishedGlobal("settings");
  const publishedRoot = pub?.data && isPlainObject(pub.data) ? { ...pub.data } : {};
  const currentFile = parseLanguageOverridesFromSettingsRoot(publishedRoot);
  const nextByAlias = { ...currentFile.byAlias };

  if (reset) {
    delete nextByAlias[alias];
  } else {
    const overrideRaw = body.override;
    if (!isPlainObject(overrideRaw)) {
      return jsonErr(gate.ctx.rid, "override må være et objekt (eller sett reset: true).", 422, "INVALID_OVERRIDE");
    }
    const override = overrideRaw as LanguageAdminOverride;
    const v = validateLanguageOverride(override);
    if (v.ok === false) {
      return jsonErr(gate.ctx.rid, v.message, 422, "INVALID_OVERRIDE");
    }
    const prev = nextByAlias[alias] ?? {};
    nextByAlias[alias] = { ...prev, ...override };
  }

  const nextFile = { version: 1, byAlias: nextByAlias };
  const merged = mergeAllLanguagesWithOverrides(nextFile);
  const setCheck = validateMergedSet(merged);
  if (setCheck.ok === false) {
    return jsonErr(gate.ctx.rid, setCheck.message, 422, "INVALID_LANGUAGE_SET");
  }

  const nextSettings: Record<string, unknown> = {
    ...publishedRoot,
    [LANGUAGE_DEFINITION_OVERRIDES_KEY]: nextFile,
  };

  const saved = await saveGlobalDraft("settings", nextSettings);
  if (saved.ok === false) {
    return jsonErr(gate.ctx.rid, saved.message, 500, "SAVE_FAILED");
  }
  const published = await publishGlobal("settings");
  if (published.ok === false) {
    return jsonErr(gate.ctx.rid, published.message, 422, "PUBLISH_FAILED");
  }

  return jsonOk(gate.ctx.rid, {
    merged,
    overrides: nextFile,
    publishedVersion: published.version,
  });
}
