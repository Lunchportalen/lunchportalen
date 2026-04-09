/**
 * U98 — Oppretter manglende locale-variant ved å klone nb + tømme cultureFields (sikker seed).
 */

import { parseBodyEnvelope, serializeBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import type { CmsStorageLocale } from "@/lib/cms/schema/languageDefinitions";
import { cmsPageDetailQueryString } from "./contentWorkspace.preview";
import { fetchPatchContentPage } from "./contentWorkspace.persistence";

export async function ensureMissingStorageLocaleVariant(params: {
  pageId: string;
  targetLocale: CmsStorageLocale;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { pageId, targetLocale } = params;
  if (targetLocale === "nb") return { ok: false, message: "Ingen seed nødvendig for nb." };

  const nbRes = await fetch(
    `/api/backoffice/content/pages/${encodeURIComponent(pageId)}?${cmsPageDetailQueryString("nb")}`,
    { method: "GET", credentials: "include", cache: "no-store" },
  );
  const nbJson = (await nbRes.json()) as { ok?: boolean; data?: { page?: { body?: unknown } } };
  if (!nbRes.ok || nbJson?.ok !== true) {
    return { ok: false, message: "Kunne ikke lese nb-variant for seed." };
  }
  const nbBody = nbJson.data?.page?.body;
  const e = parseBodyEnvelope(nbBody);
  const seed = serializeBodyEnvelope({
    documentType: e.documentType,
    invariantFields: { ...e.invariantFields },
    cultureFields: {},
    blocksBody: e.blocksBody,
  });
  const patchRes = await fetchPatchContentPage(pageId, { body: seed }, { editorLocale: targetLocale });
  const pj = (await patchRes.json()) as { ok?: boolean; message?: string };
  if (!patchRes.ok || pj?.ok !== true) {
    return { ok: false, message: pj?.message || `HTTP ${patchRes.status}` };
  }
  return { ok: true };
}
