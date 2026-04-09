import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";

import { sanitizeBlockListForPersistence } from "@/lib/ai/buildHomeFromIntentBody";

const STRONGER_HEADLINE_SUFFIX = "Sterkere budskap: mer kontroll, mindre støy.";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function cloneBlock(b: BlockNode): BlockNode {
  return JSON.parse(JSON.stringify(b)) as BlockNode;
}

/**
 * Deterministic CRO/SEO-style improvements. Never removes blocks; preserves schema-ish shape.
 */
export function improveBlocks(blocks: unknown): BlockList {
  const list = Array.isArray(blocks) ? blocks : [];
  const next: BlockNode[] = [];

  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    if (!isRecord(raw)) {
      next.push({ id: `recovered-${i}`, type: "richText", data: {} });
      continue;
    }
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "block";
    const type = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim() : "richText";
    const base: BlockNode = { id, type, data: {} };
    if (raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)) {
      base.data = { ...(raw.data as Record<string, unknown>) };
    } else {
      const data: Record<string, unknown> = {};
      for (const k of Object.keys(raw)) {
        if (k === "id" || k === "type") continue;
        if (raw[k] !== undefined) data[k] = raw[k];
      }
      base.data = data;
    }

    let node = cloneBlock(base);

    if (node.type === "hero") {
      const d = { ...(node.data ?? {}) };
      const extra = STRONGER_HEADLINE_SUFFIX;
      const combined = [d.title, d.heading]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .join("\n");
      const withExtra = combined.includes(extra) ? combined : combined.length > 0 ? `${combined}\n${extra}` : extra;
      d.title = withExtra;
      delete d.heading;
      node = { ...node, data: d };
    }

    if (node.type === "cta") {
      const d = { ...(node.data ?? {}) };
      if (!String(d.buttonLabel ?? "").trim()) d.buttonLabel = "Les mer";
      if (!String(d.href ?? "").trim()) d.href = "/registrering";
      node = { ...node, data: d };
    }

    if (node.type === "cards") {
      const d = { ...(node.data ?? {}) };
      let items = Array.isArray(d.items) ? [...d.items] : [];
      items = items.map((it) =>
        it && typeof it === "object" && !Array.isArray(it) ? { ...(it as Record<string, unknown>) } : {},
      );
      while (items.length < 3) {
        items.push({ title: "—", text: "" });
      }
      d.items = items;
      node = { ...node, data: d };
    }

    next.push(node);
  }

  return sanitizeBlockListForPersistence({ version: 1, blocks: next });
}
