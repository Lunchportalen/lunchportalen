/**
 * Local stubs for ContentWorkspace (baseline rebuild).
 * Replaces imports to non-existent @/lib and ./ modules so backoffice builds.
 * BlockList / BlockNode / newBlockId are re-exported from canonical lib/cms/model.
 */

import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";
export type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";
export { newBlockId } from "@/lib/cms/model/blockId";

export function getForsideBody(): { blocks: unknown[] } {
  return { blocks: [] };
}

type BlockTypeLabel =
  | "hero"
  | "richText"
  | "image"
  | "cta"
  | "divider"
  | "banners"
  | "code";

export function getBlockLabel(_type: BlockTypeLabel | string): string {
  return "Blokk";
}

export function isForside(slug: string, title: string): boolean {
  const sl = (slug ?? "").trim();
  const t = (title ?? "").toLowerCase().trim();
  return sl === "" || sl === "/" || sl === "index" || sl === "hjem" || sl === "front" || sl.toLowerCase() === "forside" || t === "forside" || (t.includes("lunchportalen") && t.includes("firmalunsj"));
}

export function formatDateTimeNO(d: Date | string | null | undefined): string {
  if (d == null) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleString("nb-NO");
}

function normalizeBlocks(blocks: BlockNode[]): BlockNode[] {
  return blocks.map((b) => ({ ...b, data: b.data ?? {} }));
}

export function tryParseBlockListFromBody(_body: unknown): { ok: true; list: BlockList } | { ok: false } {
  const list: BlockList = { version: 1, blocks: [] };
  return { ok: true, list: { ...list, blocks: normalizeBlocks(list.blocks) } };
}

export type BlockType = string;

export function BlockAddModal(_props: Record<string, unknown>) {
  return null;
}

export function BlockEditModal(_props: Record<string, unknown>) {
  return null;
}

export function validateModel(_model: BlockList | unknown[] | null): {
  byId: Record<string, string[]>;
  total: number;
  firstId?: string | null;
} {
  return { byId: {}, total: 0 };
}

export function Editor2Shell(_props: Record<string, unknown>) {
  return null;
}

export function MediaPickerModal(_props: Record<string, unknown>) {
  return null;
}

export function parseBodyEnvelope(body: unknown): {
  documentType: string | null;
  fields: Record<string, unknown>;
  blocksBody: string | unknown;
} {
  if (body != null && typeof body === "object" && "documentType" in body) {
    const b = body as Record<string, unknown>;
    const blocksBody = b.blocksBody;
    return {
      documentType: (b.documentType as string) ?? null,
      fields: (b.fields as Record<string, unknown>) ?? {},
      blocksBody: blocksBody !== undefined && blocksBody !== null ? blocksBody : "",
    };
  }
  if (body != null && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.blocks)) {
      return { documentType: null, fields: {}, blocksBody: body };
    }
  }
  if (typeof body === "string") {
    return { documentType: null, fields: {}, blocksBody: body };
  }
  return { documentType: null, fields: {}, blocksBody: "" };
}

export function serializeBodyEnvelope(_x: {
  documentType: string | null;
  fields: Record<string, unknown>;
  blocksBody: unknown;
}): unknown {
  return {};
}

export const documentTypes: { alias: string; name: string; allowedChildren?: string[] }[] = [
  { alias: "page", name: "Page", allowedChildren: ["page"] },
];

export function getDocType(alias: string): { alias: string; name: string; allowedChildren?: string[] } | null {
  return documentTypes.find((d) => d.alias === alias) ?? null;
}
