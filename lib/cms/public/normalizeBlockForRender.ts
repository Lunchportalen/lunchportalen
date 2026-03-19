/**
 * Normalize a raw CMS block to the shape expected by renderBlock (id, type, data).
 * Single source for public [slug], backoffice preview [id], and LivePreviewPanel;
 * all use normalizeBlockForRender → renderBlock for identical output.
 * Accepts both canonical BlockNode shape ({ id, type, data }) and editor-serialized
 * flat shape ({ id, type, heading, body, ... }).
 *
 * Media resolution: display URL is derived here only. src = assetPath (image block) or
 * imageUrl (e.g. hero) when present as string; otherwise unchanged. renderBlock uses
 * data.src and does not resolve mediaItemId—blocks must store the URL/path they need.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";

type RawBlock = Record<string, unknown> & { id?: string; type?: string; data?: unknown };

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

  const data: Record<string, unknown> =
    block?.data != null && typeof block.data === "object" && !Array.isArray(block.data)
      ? { ...(block.data as Record<string, unknown>) }
      : {};

  if (Object.keys(data).length === 0 && block != null && typeof block === "object") {
    const o = block as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      if (k !== "id" && k !== "type" && o[k] !== undefined) data[k] = o[k];
    }
  }

  // Single display-URL contract: src is the resolved image URL for rendering.
  if (data.src == null && typeof data.assetPath === "string") data.src = data.assetPath;
  if (data.src == null && typeof data.imageUrl === "string") data.src = data.imageUrl;
  if (data.buttonHref != null && data.href == null) data.href = data.buttonHref;

  return { id, type, data };
}
