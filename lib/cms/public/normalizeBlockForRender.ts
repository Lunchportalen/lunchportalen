/**
 * Normalize a raw CMS block to the shape expected by renderBlock (id, type, data, config).
 * Single source for public [slug], backoffice preview [id], and LivePreviewPanel;
 * all use normalizeBlockForRender → renderBlock for identical output.
 * Accepts both canonical BlockNode shape ({ id, type, data, config }) and editor-serialized
 * flat shape ({ id, type, heading, body, ... }).
 *
 * Media: `imageId` / `mediaItemId` resolve on the server via resolveMediaInNormalizedBlocks;
 * here we apply the synchronous `cms:*` registry so client preview matches when keys are used.
 * display URL: src / imageUrl / assetPath / image (per block shape).
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { expandRawBlockRowToFlatRenderFields } from "@/lib/cms/blocks/blockEntryContract";
import { enforceBlockComponentSafety } from "@/lib/cms/blocks/blockContracts";
import { enforceBlockSafety } from "@/lib/cms/enforceBlockSafety";
import { parseBlockConfig, stripForbiddenDesignFromData } from "@/lib/cms/design/designContract";
import { syncResolvePublishedImagesInData } from "@/lib/cms/media/syncResolvePublishedImages";

type RawBlock = Record<string, unknown> & { id?: string; type?: string; data?: unknown; config?: unknown };

/**
 * Returns a BlockNode for renderBlock. Uses block.data when present and object;
 * otherwise treats block as flat (editor shape) and builds data from other keys.
 * Maps editor field names to render contract (e.g. assetPath→src, buttonHref→href).
 */
export function normalizeBlockForRender(
  block: RawBlock | null | undefined,
  index: number
): BlockNode {
  const id =
    typeof block?.id === "string" && block.id.trim() ? block.id.trim() : `block-${index}`;
  const type =
    typeof block?.type === "string" && block.type.trim() ? block.type.trim() : "richText";

  const draft: Record<string, unknown> =
    block?.data != null && typeof block.data === "object" && !Array.isArray(block.data)
      ? { ...(block.data as Record<string, unknown>) }
      : {};

  if (Object.keys(draft).length === 0 && block != null && typeof block === "object") {
    const o = block as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      if (k === "id" || k === "type" || k === "config" || k === "data") continue;
      if (o[k] !== undefined) draft[k] = o[k];
    }
  }

  /** U91: editor entry shape (contentData/settingsData/structureData) → flat render fields. */
  const expanded = expandRawBlockRowToFlatRenderFields({ type, ...draft } as Record<string, unknown>);
  Object.keys(draft).forEach((k) => {
    delete draft[k];
  });
  for (const k of Object.keys(expanded)) {
    draft[k] = expanded[k];
  }

  if (draft.src == null && typeof draft.assetPath === "string") draft.src = draft.assetPath;
  if (draft.src == null && typeof draft.imageUrl === "string") draft.src = draft.imageUrl;
  if (draft.buttonHref != null && draft.href == null) draft.href = draft.buttonHref;

  const data = stripForbiddenDesignFromData(draft);
  syncResolvePublishedImagesInData(data);

  enforceBlockComponentSafety(type, data);
  enforceBlockSafety(type, data);

  if (data.src == null && typeof data.assetPath === "string") data.src = data.assetPath;
  if (data.src == null && typeof data.imageUrl === "string") data.src = data.imageUrl;

  const config = parseBlockConfig(block?.config);

  return { id, type, data, ...(config ? { config } : {}) };
}
